var assert = require('chai').assert
var memoryStream = require('memorystream')

describe('Stream Instance', function () {
  // our logger is a singleton, but we need a clean instance
  delete require.cache[require.resolve('./../dadi/index.js')]
  var logger = require('./../dadi/index.js')
  var memstream = new memoryStream()
  
  logger.init({
    accessLog: {
      enabled: false // no access log, only expecting single messages
    },
    enabled: true,
    filename: 'test',
    level: 'info',
    path: 'log/',
    stream: memstream
  }, null, 'test')
  
  it('should log to the provided stream instance', function (done) {
    memstream.once('data', function (chunk) {
      var output = JSON.parse(chunk.toString())
      assert(output.msg === 'test')
      done()
    })

    logger.info('test')
  })
})
