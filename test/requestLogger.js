const assert = require('chai').assert
const http = require('http')
const MemoryStream = require('memorystream')

/*
 * Generate a Mock httpServer Request and Response
 * @PARAM statusCode - a RFC2616 status code
 * @PARAM forwarded - A boolean on whether or not to use the x-forwarded-for header, as if behind an ELB
 * @PARAM ip - The ip to insert into the request
 * @PARAM url - the url/path
 */
function generateMockRequestAndResponse (statusCode, forwarded, ip, url) {
  let req = {
    connection: {
      remoteAddress: ip || '8.8.8.8'
    },
    headers: {
      host: 'http://0.0.0.0',
      referer: 'http://google.com',
      'user-agent':
        'Mozilla/5.0 (Windows NT x.y; WOW64; rv:10.0) Gecko/20100101 Firefox/10.0'
    },
    httpVersion: '1.1',
    method: 'GET',
    url: url || '/test',
    path: url || '/test'
  }

  if (forwarded) {
    req.connection.remoteAddress = '8.8.4.4'
    req.headers['x-forwarded-for'] = ip || '8.8.8.8'
  }

  let res = new http.ServerResponse(req)
  res.statusCode = statusCode || 200
  res.setHeader('content-length', 305)

  return {
    res: res,
    req: req,
    next: function () {
      res.end()
    }
  }
}

describe('Request Logger', function () {
  let logger
  let memstream

  beforeEach(function (done) {
    // our logger is a singleton, but we need a clean instance
    delete require.cache[require.resolve('./../dadi/index.js')]
    logger = require('./../dadi/index.js')
    memstream = new MemoryStream() // save ourselves from the fs rabbit hole

    logger.init(
      {
        accessLog: {
          enabled: true
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

    done()
  })

  it('should log a request', function (done) {
    let testHttp = generateMockRequestAndResponse()
    let chunks = 0
    memstream.on('data', function (chunk) {
      let output = JSON.parse(chunk.toString())
      chunks++
      if (output.name === 'dadi-test') {
        assert(
          output.msg.indexOf('GET /test') !== -1,
          'contains method and path'
        )
        assert(output.msg.indexOf('200') !== -1, 'contains status')
      } else if (output.name === 'access') {
        assert(output.msg.indexOf('8.8.8.8') !== -1, 'contains IP address')
        assert(
          output.msg.indexOf('http://google.com') !== -1,
          'contains referer'
        )
        assert(
          output.msg.indexOf('GET /test') !== -1,
          'contains method and path'
        )
        assert(output.msg.indexOf('Mozilla/5.0') !== -1, 'contains user agent')
      }
      if (chunks >= 2) {
        memstream.removeAllListeners('data')
        return done() // only finish after accesslog and info
      }
    })
    logger.requestLogger(testHttp.req, testHttp.res, testHttp.next) // fire
  })

  it('should keep a count of requests', function (done) {
    let testHttp = generateMockRequestAndResponse()
    let chunks = 0
    memstream.on('data', function (chunk) {
      let output = JSON.parse(chunk.toString())
      chunks++
      if (output.name === 'dadi-test') {
        assert(
          output.msg.indexOf('GET /test') !== -1,
          'contains method and path'
        )
        assert(output.msg.indexOf('200') !== -1, 'contains status')
      } else if (output.name === 'access') {
        assert(output.msg.indexOf('8.8.8.8') !== -1, 'contains IP address')
        assert(
          output.msg.indexOf('http://google.com') !== -1,
          'contains referer'
        )
        assert(
          output.msg.indexOf('GET /test') !== -1,
          'contains method and path'
        )
        assert(output.msg.indexOf('Mozilla/5.0') !== -1, 'contains user agent')
      }
      if (chunks >= 2) {
        assert(logger.stats.requests === 1, 'correct amount of requests logged')
        return done() // only finish after accesslog and info
      }
    })
    logger.requestLogger(testHttp.req, testHttp.res, testHttp.next) // fire
  })

  it('should handle x-forwarded-for correctly', function (done) {
    let chunks = 0
    let testHttp = generateMockRequestAndResponse(200, true)
    memstream.on('data', function (chunk) {
      let output = JSON.parse(chunk.toString())
      chunks++
      if (output.name === 'dadi-test') {
        assert(
          output.msg.indexOf('GET /test') !== -1,
          'contains method and path'
        )
        assert(output.msg.indexOf('200') !== -1, 'contains status')
      } else if (output.name === 'access') {
        assert(output.msg.indexOf('8.8.8.8') !== -1, 'contains IP address')
        assert(
          output.msg.indexOf('http://google.com') !== -1,
          'contains referer'
        )
        assert(
          output.msg.indexOf('GET /test') !== -1,
          'contains method and path'
        )
        assert(output.msg.indexOf('Mozilla/5.0') !== -1, 'contains user agent')
      }
      if (chunks >= 2) return done() // only finish after accesslog and info
    })
    logger.requestLogger(testHttp.req, testHttp.res, testHttp.next) // fire
  })

  it('should handle IPv6 address', function (done) {
    let chunks = 0
    let testHttp = generateMockRequestAndResponse(
      200,
      false,
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
    )
    memstream.on('data', function (chunk) {
      let output = JSON.parse(chunk.toString())
      chunks++

      if (output.name === 'dadi-test') {
        assert(
          output.msg.indexOf('GET /test') !== -1,
          'contains method and path'
        )
        assert(output.msg.indexOf('200') !== -1, 'contains status')
      } else if (output.name === 'access') {
        assert(
          output.msg.indexOf('2001:0db8:85a3:0000:0000:8a2e:0370:7334') !== -1,
          'contains IP address'
        )
        assert(
          output.msg.indexOf('http://google.com') !== -1,
          'contains referer'
        )
        assert(
          output.msg.indexOf('GET /test') !== -1,
          'contains method and path'
        )
        assert(output.msg.indexOf('Mozilla/5.0') !== -1, 'contains user agent')
      }
      if (chunks >= 2) return done() // only finish after accesslog and info
    })
    logger.requestLogger(testHttp.req, testHttp.res, testHttp.next) // fire
  })

  describe('Filtered parameters', function () {
    beforeEach(function (done) {
    // our logger is a singleton, but we need a clean instance
      delete require.cache[require.resolve('./../dadi/index.js')]
      logger = require('./../dadi/index.js')
      memstream = new MemoryStream() // save ourselves from the fs rabbit hole

      done()
    })

    it('should remove sensitive parameters from querystring when writing to log', function (done) {
      logger.init(
        {
          accessLog: {
            enabled: true
          },
          enabled: true,
          filename: 'test',
          level: 'trace',
          path: 'log/',
          stream: memstream,
          filter: ['password']
        },
        null,
        'test'
      )

      let testHttp = generateMockRequestAndResponse()
      let chunks = 0

      testHttp.req.url = testHttp.req.url + '?username=ed&password=octopus'

      memstream.on('data', function (chunk) {
        let output = JSON.parse(chunk.toString())
        chunks++

        if (output.name === 'dadi-test') {
          assert(
            output.msg.indexOf('octopus') === -1,
            'path contains unfiltered parameters'
          )
        } else if (output.name === 'access') {
          assert(
            output.msg.indexOf('octopus') === -1,
            'path contains unfiltered parameters'
          )
        }

        if (chunks >= 2) {
          memstream.removeAllListeners('data')
          return done() // only finish after accesslog and info
        }
      })

      logger.requestLogger(testHttp.req, testHttp.res, testHttp.next) // fire
    })

    it('should not remove unspecified parameters from querystring when writing to log', function (done) {
      logger.init(
        {
          accessLog: {
            enabled: true
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

      let testHttp = generateMockRequestAndResponse()
      let chunks = 0

      testHttp.req.url = testHttp.req.url + '?username=ed&password=octopus'

      memstream.on('data', function (chunk) {
        let output = JSON.parse(chunk.toString())
        chunks++

        if (output.name === 'dadi-test') {
          assert(
            output.msg.indexOf('octopus') > 0,
            'path does not contain all parameters'
          )
        } else if (output.name === 'access') {
          assert(
            output.msg.indexOf('octopus') > 0,
            'path does not contain all parameters'
          )
        }

        if (chunks >= 2) {
          memstream.removeAllListeners('data')
          return done() // only finish after accesslog and info
        }
      })

      logger.requestLogger(testHttp.req, testHttp.res, testHttp.next) // fire
    })
  })
})
