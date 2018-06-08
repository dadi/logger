/**
 * @module Log
 */
var bunyan = require('bunyan') // underlying logger
var KinesisStream = require('aws-kinesis-writable') // kinesis
var mkdirp = require('mkdirp') // recursive mkdir
var moment = require('moment') // datestamps and timing
var path = require('path')

var logPath // where to log
var accessLogPath // where to stick accessLogs
var log // logger instances
var accessLog // access log gets it's own instance
var env // development, production, etc

var defaults = {
  enabled: false,
  level: 'info',
  path: './log',
  extension: '.log',
  accessLog: {
    enabled: false
  }
}

var trackRequestCount = true
var stats = {
  requests: 0 // total request count
}

function setOptions (options, awsConfig, environment) {
  env = environment

  options = Object.assign({}, defaults, options)

  logPath = path.resolve(options.path + '/' + options.filename + '.' + env + '.' + options.extension)
  accessLogPath = path.resolve(options.path + '/' + options.filename + '.access.' + options.extension)

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
  const level = options.level || defaultLevel || 'error'
  const streamInstance = getStreamInstance(options, level)

  if (streamInstance) {
    return streamInstance
  }

  if (defaultLevel === 'access') {
    return [{
      path: accessLogPath
    }]
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
    return [{
      level,
      stream: options.stream
    }]
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

  if (accessLog &&
    options.accessLog.kinesisStream &&
    options.accessLog.kinesisStream !== '' &&
    awsConfig !== null) {
    accessLog.addStream(
      {
        name: 'Kinesis Log Stream',
        level: 'info',
        stream: new KinesisStream({
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
          region: awsConfig.region,
          streamName: options.accessLog.kinesisStream,
          partitionKey: 'dadi-web'
        })
      }
    )

    var logStream = accessLog.streams.find(stream => stream.name === 'Kinesis Log Stream')
    logStream.stream.on('error', function (err) { // dump kinesis errors
      console.log(err)
      log.warn(err)
    })
  }
}

var self = module.exports = {
  options: {},

  init: function (options, awsConfig, environment) {
    this.options = options
    if (!environment) environment = 'development' // default to dev
    setOptions(options, awsConfig, environment)
  },

  enabled: function (level) {
    return this.options.enabled && (bunyan.resolveLevel(level) >= bunyan.resolveLevel(this.options.level))
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
    var start = Date.now()
    var _end = res.end // set up a tap in res.end
    res.end = function () {
      var duration = Date.now() - start

      var clientIpAddress = req.connection.remoteAddress

      if (req.headers['x-forwarded-for']) {
        clientIpAddress = getClientIpAddress(req.headers['x-forwarded-for'])
      }

      let accessRecord = `${(clientIpAddress || '')}` +
      ` -` +
      ` ${moment().format()}` +
      ` ${req.method} ${req.url} HTTP/ ${req.httpVersion}` +
      ` ${res.statusCode}` +
      ` ${(res._headers ? res._headers['content-length'] : '')}` +
      `${(req.headers['referer'] ? (' ' + req.headers['referer']) : '')}` +
      ` ${req.headers['user-agent']}`

      // write to the access log first
      self.access(accessRecord)

      // log the request method and url, and the duration
      self.info({module: 'router'}, `${req.method} ${req.url} ${res.statusCode} ${duration}ms`)

      if (trackRequestCount) stats.requests++

      _end.apply(res, arguments)
    }

    next()
  },

  stats: stats
}

/**
 * Get the client IP address from the load balancer's x-forwarded-for header
 */
var getClientIpAddress = function (input) {
  // matches all of the addresses in the private ranges and 127.0.0.1 as a bonus
  var privateIpAddress = /(^127.0.0.1)|(^10.)|(^172.1[6-9].)|(^172.2[0-9].)|(^172.3[0-1].)|(^192.168.)/
  var validIpAddress = /(\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})/

  var ips = input.split(',')
  var result = ''

  ips.forEach(ip => {
    if (isValidIPv6(ip) || (ip.match(validIpAddress) && !ip.match(privateIpAddress))) {
      result = ip
    }
  })

  return result.trim()
}

var isValidIPv6 = function (input) {
  var pattern = /^((?:[0-9A-Fa-f]{1,4}))((?::[0-9A-Fa-f]{1,4}))*::((?:[0-9A-Fa-f]{1,4}))((?::[0-9A-Fa-f]{1,4}))*|((?:[0-9A-Fa-f]{1,4}))((?::[0-9A-Fa-f]{1,4})){7}$/
  return pattern.test(input)
}

// Catch possibly unhandled rejections
process.on('unhandledRejection', function (reason, p) {
  self.error(reason)
})
