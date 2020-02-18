/**
 * @module Log
 */
const bunyan = require('bunyan') // underlying logger
const KinesisStream = require('aws-kinesis-writable') // kinesis
const LogFilter = require('@dadi/log-filter')
const mkdirp = require('mkdirp') // recursive mkdir
const moment = require('moment') // datestamps and timing
const path = require('path')

let logPath // where to log
let accessLogPath // where to send accessLogs
let log // logger instances
let accessLog // access log gets it's own instance
let env // development, production, etc

let defaults = {
  enabled: false,
  level: 'info',
  path: './log',
  extension: '.log',
  accessLog: {
    enabled: false
  }
}

let trackRequestCount = true
let stats = {
  requests: 0 // total request count
}

function setOptions (options, awsConfig, environment) {
  env = environment

  options = Object.assign({}, defaults, options)

  logPath = path.resolve(
    options.path + '/' + options.filename + '.' + env + '.' + options.extension
  )
  accessLogPath = path.resolve(
    options.path + '/' + options.filename + '.access.' + options.extension
  )

  // create log directory if it doesn't exist, idempotent
  mkdirp(path.resolve(options.path), {}, function (err, made) {
    if (err) {
      module.exports.error(err)
    }
  })

  log = bunyan.createLogger({
    name: 'dadi-' + options.filename,
    serializers: bunyan.stdSerializers,
    streams: getStreams(options, 'error')
  })

  initAccessLog(options, awsConfig)
}

function getStreams (options, defaultLevel) {
  let level = options.level || defaultLevel || 'error'
  let streamInstance = getStreamInstance(options, level)

  if (streamInstance) {
    return streamInstance
  }

  if (defaultLevel === 'access') {
    return [
      {
        path: accessLogPath
      }
    ]
  } else {
    return [
      { level: 'info', path: logPath },
      { level: 'warn', path: logPath },
      { level: 'error', path: logPath }
    ]
  }
}

function getStreamInstance (options, level) {
  if (options.stream && typeof options.stream === 'object') {
    return [
      {
        level,
        stream: options.stream
      }
    ]
  }
}

function initAccessLog (options, awsConfig) {
  if (options.accessLog.enabled) {
    accessLog = bunyan.createLogger({
      name: 'access',
      serializers: bunyan.stdSerializers,
      streams: getStreams(options, 'access')
    })
  }

  if (
    accessLog &&
    options.accessLog.kinesisStream &&
    options.accessLog.kinesisStream !== '' &&
    awsConfig !== null
  ) {
    accessLog.addStream({
      name: 'Kinesis Log Stream',
      level: 'info',
      stream: new KinesisStream({
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
        region: awsConfig.region,
        streamName: options.accessLog.kinesisStream,
        partitionKey: 'dadi-web'
      })
    })

    let logStream = accessLog.streams.find(
      stream => stream.name === 'Kinesis Log Stream'
    )

    logStream.stream.on('error', err => {
      // dump kinesis errors
      console.log(err)
      log.warn(err)
    })
  }
}

const self = (module.exports = {
  options: {},

  init: function (options, awsConfig, environment) {
    this.options = options
    if (!environment) environment = 'development' // default to dev
    setOptions(options, awsConfig, environment)
  },

  enabled: function (level) {
    return (
      this.options.enabled &&
      bunyan.resolveLevel(level) >= bunyan.resolveLevel(this.options.level)
    )
  },

  access: function access () {
    if (this.options.accessLog && this.options.accessLog.enabled) {
      try {
        accessLog.info.apply(accessLog, arguments)
      } catch (err) {
        log.error(err)
      }
    }
  },
  // bubble up enabled levels to our Bunyan instance
  debug: function debug () {
    if (self.enabled('debug')) log.debug.apply(log, arguments)
  },

  info: function info () {
    if (self.enabled('info')) log.info.apply(log, arguments)
  },

  warn: function warn () {
    if (self.enabled('warn')) log.warn.apply(log, arguments)
  },

  error: function error () {
    if (self.enabled('error')) log.error.apply(log, arguments)
  },

  trace: function trace () {
    if (self.enabled('trace')) log.trace.apply(log, arguments)
  },

  get: function get () {
    return log
  },

  getAccessLog: function getAccessLog () {
    return accessLog
  },

  // middleware for handling Connect style requests
  requestLogger: function (req, res, next) {
    let start = Date.now()
    let _end = res.end // set up a tap in res.end
    res.end = function () {
      let duration = Date.now() - start

      let clientIpAddress = req.connection.remoteAddress

      if (req.headers['x-forwarded-for']) {
        clientIpAddress = getClientIpAddress(req.headers['x-forwarded-for'])
      }

      let logFilter = new LogFilter(req, self.options.filter || [])
      let requestPath = logFilter.filterPath()

      let accessRecord =
        `${clientIpAddress || ''}` +
        ` -` +
        ` ${moment().format()}` +
        ` ${req.method} ${requestPath} HTTP/ ${req.httpVersion}` +
        ` ${res.statusCode}` +
        ` ${
          res.getHeader('content-length') ? res.getHeader('content-length') : ''
        }` +
        `${req.headers['referer'] ? ' ' + req.headers['referer'] : ''}` +
        ` ${req.headers['user-agent']}`

      // write to the access log first
      self.access(accessRecord)

      // log the request method and url, and the duration
      self.info(
        { module: 'router' },
        `${req.method} ${requestPath} ${res.statusCode} ${duration}ms`
      )

      if (trackRequestCount) stats.requests++

      _end.apply(res, arguments)
    }

    next()
  },

  stats: stats
})

/**
 * Get the client IP address from the load balancer's x-forwarded-for header
 */
const getClientIpAddress = function (input) {
  // matches all of the addresses in the private ranges and 127.0.0.1 as a bonus
  let privateIpAddress = /(^127.0.0.1)|(^10.)|(^172.1[6-9].)|(^172.2[0-9].)|(^172.3[0-1].)|(^192.168.)/
  let validIpAddress = /(\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})/

  let ips = input.split(',')
  let result = ''

  ips.forEach(ip => {
    if (
      isValidIPv6(ip) ||
      (ip.match(validIpAddress) && !ip.match(privateIpAddress))
    ) {
      result = ip
    }
  })

  return result.trim()
}

const isValidIPv6 = function (input) {
  let pattern = /^((?:[0-9A-Fa-f]{1,4}))((?::[0-9A-Fa-f]{1,4}))*::((?:[0-9A-Fa-f]{1,4}))((?::[0-9A-Fa-f]{1,4}))*|((?:[0-9A-Fa-f]{1,4}))((?::[0-9A-Fa-f]{1,4})){7}$/
  return pattern.test(input)
}

// Catch possibly unhandled rejections
process.on('unhandledRejection', function (reason, p) {
  self.error(reason)
})
