const assert = require('chai').assert
const MemoryStream = require('memorystream')

describe('Stream Instance', function () {
  // our logger is a singleton, but we need a clean instance
  delete require.cache[require.resolve('./../dadi/index.js')]
  let logger = require('./../dadi/index.js')
  let memstream = new MemoryStream()

  logger.init(
    {
      accessLog: {
        enabled: false // no access log, only expecting single messages
      },
      enabled: true,
      filename: 'test',
      level: 'info',
      path: 'log/',
      stream: memstream
    },
    null,
    'test'
  )

  it('should log to the provided stream instance', function (done) {
    memstream.once('data', function (chunk) {
      let output = JSON.parse(chunk.toString())
      assert(output.msg === 'test')
      done()
    })

    logger.info('test')
  })
})
