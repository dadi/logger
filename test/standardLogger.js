var assert = require('chai').assert;
var memoryStream = require('memorystream');

describe('Standard Logger', function(){
  //our logger is a singleton, but we need a clean instance
  delete require.cache[require.resolve('./../dadi/index.js')];
  var logger = require('./../dadi/index.js');
  var memstream = new memoryStream();

  logger.init({
    accessLog: {
      enabled: false
    },
    enabled: true,
    filename: 'test',
    level: "trace",
    path: 'log/',
    testStream: [{level: "trace", stream: memstream}]
  }, null, 'test');

  it('should log at the trace level', function(done){
    memstream.once('data', function(chunk){
      var output = JSON.parse(chunk.toString());
      assert(output.level === 10, 'trace level');
      done();
    });

    logger.trace('trace');
  });

  it('should log at the debug level', function(done){
    memstream.once('data', function(chunk){
      var output = JSON.parse(chunk.toString());
      assert(output.level === 20, 'debug level');
      done();
    });

    logger.debug('debug');
  });

  it('should log at the info level', function(done){
    memstream.once('data', function(chunk){
      var output = JSON.parse(chunk.toString());
      assert(output.level === 30, 'info level');
      done();
    });

    logger.info('info');
  });

  it('should log at the warn level', function(done){
    memstream.once('data', function(chunk){
      var output = JSON.parse(chunk.toString());
      assert(output.level === 40, 'warn level');
      done();
    });

    logger.warn('warn');
  });

  it('should log at the error level', function(done){
    memstream.once('data', function(chunk){
      var output = JSON.parse(chunk.toString());
      assert(output.level === 50, 'error level');
      done();
    });

    logger.error('error');
  });

  //@TODO re-enable once fatal is implemented
  // it('should log at the fatal level', function(done){
  //   memstream.once('data', function(chunk){
  //     var output = JSON.parse(chunk.toString());
  //     assert(output.level === 60, 'fatal level');
  //     done();
  //   });
  //
  //   logger.fatal('fatal');
  // });

});
