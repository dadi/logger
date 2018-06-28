const assert = require('chai').assert
const MemoryStream = require('memorystream')

describe('Standard Logger', function () {
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
      level: 'trace',
      path: 'log/',
      stream: memstream
    },
    null,
    'test'
  )

  it('should log at the trace level', function (done) {
    memstream.once('data', function (chunk) {
      let output = JSON.parse(chunk.toString())
      assert(output.level === 10, 'trace level')
      done()
    })

    logger.trace('trace')
  })

  it('should log at the debug level', function (done) {
    memstream.once('data', function (chunk) {
      let output = JSON.parse(chunk.toString())
      assert(output.level === 20, 'debug level')
      done()
    })

    logger.debug('debug')
  })

  it('should log at the info level', function (done) {
    memstream.once('data', function (chunk) {
      let output = JSON.parse(chunk.toString())
      assert(output.level === 30, 'info level')
      done()
    })

    logger.info('info')
  })

  it('should log at the warn level', function (done) {
    memstream.once('data', function (chunk) {
      let output = JSON.parse(chunk.toString())
      assert(output.level === 40, 'warn level')
      done()
    })

    logger.warn('warn')
  })

  it('should log at the error level', function (done) {
    memstream.once('data', function (chunk) {
      let output = JSON.parse(chunk.toString())
      assert(output.level === 50, 'error level')
      done()
    })

    logger.error('error')
  })

  it('should add a Kinesis log stream if configured', function (done) {
    let loggerTwo = require('./../dadi/index.js')
    let memstreamTwo = new MemoryStream()

    loggerTwo.init(
      {
        accessLog: {
          enabled: true,
          kinesisStream: 'testKinesis'
        },
        enabled: true,
        filename: 'test',
        level: 'trace',
        path: 'log/',
        stream: memstreamTwo
      },
      {
        accessKeyId: '',
        secretAccessKey: '',
        region: ''
      },
      'test'
    )

    let log = loggerTwo.getAccessLog()

    assert(log.streams.length === 2)
    assert(log.streams[1].name === 'Kinesis Log Stream')
    done()
  })

  // @TODO re-enable once fatal is implemented
  // it('should log at the fatal level', function(done){
  //   memstream.once('data', function(chunk){
  //     let output = JSON.parse(chunk.toString())
  //     assert(output.level === 60, 'fatal level')
  //     done()
  //   })
  //
  //   logger.fatal('fatal')
  // })
})
