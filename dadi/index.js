/**
 * @module Log
 */
var bunyan = require('bunyan'); //underlying logger
var KinesisStream = require('aws-kinesis-writable'); //kinesis
var fs = require('fs'); //to hand filestreams to bunyan
var mkdirp = require('mkdirp'); //recursive mkdir
var moment = require('moment'); //datestamps and timing
var path = require('path');
var util = require('util');
var _ = require('underscore');

var enabled; //allow logging?
var logPath; //where to log
var accessLogPath; //where to stick accessLogs
var log; //logger instances
var accessLog; //access log gets it's own instance
var opts;
var env; //development, production, etc

var trackRequestCount = true;
var stats = {
  requests: 0 //total request count
};


function setOptions(options, awsConfig, environment) {
  env = environment;

  enabled = options.enabled;
  logPath = path.resolve(options.path + '/' + options.filename + '.' + env + '.' + options.extension);
  accessLogPath = path.resolve(options.path + '/' + options.filename + '.access.' + options.extension);

  // create log directory if it doesn't exist, idempotent
  mkdirp(path.resolve(options.path), {}, function(err, made) {
    if (err) {
      module.exports.error(err);
    }

    if (made) {
      module.exports.info('Log directory created at ' + made);
    }
  })

  log = bunyan.createLogger({
    name: 'dadi-' + options.filename,
    serializers: bunyan.stdSerializers,
    streams: getStreams(options)
  });

  if (env === 'development') {
    log.addStream({ level: 'debug', stream: process.stdout });
  } //cli logs in dev

  initAccessLog(options, awsConfig);
}

function getStreams(options) {
  if(options.testStream) { //override for testing
    return options.testStream;
  } else if(options.fileRotationPeriod !== '') {
    return [
      { level: 'info', type: 'rotating-file', path: logPath, period: options.fileRotationPeriod, count: options.fileRetentionCount },
      { level: 'warn', type: 'rotating-file', path: logPath, period: options.fileRotationPeriod, count: options.fileRetentionCount },
      { level: 'error', type: 'rotating-file', path: logPath, period: options.fileRotationPeriod, count: options.fileRetentionCount }
    ]
  } else {
    return [
      { level: 'info', path: logPath },
      { level: 'warn', path: logPath },
      { level: 'error', path: logPath }
    ]
  }
}

function initAccessLog(options, awsConfig) {
  if (options.accessLog.enabled) {
    if(options.testStream){ //test intercept
      accessLog = bunyan.createLogger({
          name: 'access',
          serializers: bunyan.stdSerializers,
          streams: options.testStream
      });
    }else{
      accessLog = bunyan.createLogger({ //fills up quickly, always rotate
          name: 'access',
          serializers: bunyan.stdSerializers,
          streams: [
            {
              type: 'rotating-file',
              path: accessLogPath,
              period: options.accessLog.fileRotationPeriod,
              count: options.accessLog.fileRetentionCount
            }
          ]
      });
    }
  }

  if (options.accessLog.enabled &&
    options.accessLog.kinesisStream !== '' &&
    awsConfig !== null) {
    // Create a log stream
    accessLog.addStream(
      {
        name: 'Kinesis Log Stream',
        level: 'info',
        stream: new KinesisStream ({
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
          region:          awsConfig.region,
          streamName:      options.accessLog.kinesisStream,
          partitionKey:    'dadi-web'
        })
      }
    );

    var logStream = _.findWhere(accessLog.streams, { 'name' : 'Kinesis Log Stream' });
    logStream.stream.on('error', function (err) { //dump kinesis errors
      console.log(err);
      log.warn(err);
    });
  }
}

var self = module.exports = {

  options: {},

  init: function(options, awsConfig, environment) {
    this.options = options;
    if (!environment) environment = 'development'; //default to dev
    setOptions(options, awsConfig, environment)
  },

  enabled: function(level) {
    return this.options.enabled && (bunyan.resolveLevel(level) >= bunyan.resolveLevel(this.options.level));
  },

  access: function access() {
    if (this.options.accessLog.enabled) {
      try {
        accessLog.info.apply(accessLog, arguments);
      }
      catch (err) {
        log.error(err);
      }
    }
  },
  //bubble up enabled levels to our Bunyan instance
  debug: function debug() {
    if (self.enabled('debug')) log.debug.apply(log, arguments);
  },

  info: function info() {
    if (self.enabled('info')) log.info.apply(log, arguments);
  },

  warn: function warn() {
    if (self.enabled('warn')) log.warn.apply(log, arguments);
  },

  error: function error() {
    if (self.enabled('error')) log.error.apply(log, arguments);
  },

  trace: function trace() {
    if (self.enabled('trace')) log.trace.apply(log, arguments);
  },

  get: function get() {
    return log;
  },

  getAccessLog: function getAccessLog() {
    return accessLog;
  },
  //middleware for handling Connect style requests
  requestLogger: function (req, res, next) {
    var start = Date.now();
    var _end = res.end; //set up a tap in res.end
    res.end = function () {
      var duration = Date.now() - start;

      var clientIpAddress = req.connection.remoteAddress;
      if (req.headers.hasOwnProperty('x-forwarded-for')) {
        clientIpAddress = getClientIpAddress(req.headers['x-forwarded-for']);
      }

      var accessRecord = (clientIpAddress || '') +
      ' -' +
      ' ' + moment().format() +
      ' ' + req.method + ' ' + req.url + ' ' + 'HTTP/' + req.httpVersion +
      ' ' + res.statusCode +
      ' ' + (res._headers ? res._headers['content-length'] : '') +
      (req.headers["referer"] ? (' ' + req.headers["referer"]) : '') +
      ' ' + req.headers["user-agent"];

      // write to the access log first
      self.access(accessRecord);

      // log the request method and url, and the duration
      self.info({module: 'router'}, req.method +
        ' ' + req.url +
        ' ' + res.statusCode +
        ' ' + duration + 'ms');

      if(trackRequestCount) stats.requests++;

      _end.apply(res, arguments);
    };
    next();
  },

  stats: stats
}
//parse IPs from logs
var getClientIpAddress = function (input) {

  // matches all of the addresses in the private ranges and 127.0.0.1 as a bonus
  var privateIpAddress = /(^127.0.0.1)|(^10.)|(^172.1[6-9].)|(^172.2[0-9].)|(^172.3[0-1].)|(^192.168.)/;
  var validIpAddress = /(\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})/;

  var ips = input.split(',');
  var result = '';
  //grab the last thing which matches an ip but isn't private
  _.each(ips, function (ip) {
    if (ip.match(validIpAddress)) {
      if (!ip.match(privateIpAddress)) {
        result = ip;
      }
    }
  });
  
  return result.trim();
};

// Catch possibly unhandled rejections
process.on('unhandledRejection', function (reason, p) {
  self.error(reason);
});
