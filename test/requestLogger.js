var assert = require('chai').assert;
var memoryStream = require('memorystream');

function generateMockRequestAndResponse(statusCode, forwarded, ip, url){
  var req = {
    connection: {
      remoteAddress: ip || '8.8.8.8'
    },
    headers: {
      'referer': 'http://google.com',
      'user-agent': 'Mozilla/5.0 (Windows NT x.y; WOW64; rv:10.0) Gecko/20100101 Firefox/10.0'
    },
    httpVersion: '1.1',
    method: 'GET',
    url: url || '/test',
    path: url || '/test'
  };
  if(forwarded){
    req.connection.remoteAddress = '8.8.4.4';
    req.headers['x-forwarded-for'] = ip || '8.8.8.8';
  }
  var res = {
    end: function(){ return true; },
    statusCode: statusCode || 200
  };
  return {res: res, req: req, next: function(){ res.end(); }};
}

describe('Request Logger', function(){
  var testHttp = generateMockRequestAndResponse();
  //our logger is a singleton, but we need a clean instance
  delete require.cache[require.resolve('./../dadi/index.js')];
  var logger = require('./../dadi/index.js');
  var memstream = new memoryStream();

  logger.init({
    accessLog: {
      enabled: true
    },
    enabled: true,
    filename: 'test',
    level: "trace",
    path: 'log/',
    testStream: [{level: "trace", stream: memstream}]
  }, null, 'test');

  it('should log a request', function(done){
    var chunks = 0;
    memstream.on('data', function(chunk){
      var output = JSON.parse(chunk.toString());
      chunks++;
      if(output.name === 'dadi.test'){
        assert(output.msg.indexOf('GET /test') !== -1, 'contains method and path');
        assert(output.msg.indexOf('200') !== -1, 'contains status');
      }else if(output.name === 'access'){
        assert(output.msg.indexOf('8.8.8.8') !== -1, 'contains IP address');
        assert(output.msg.indexOf('http://google.com') !== -1, 'contains referer');
        assert(output.msg.indexOf('GET /test') !== -1, 'contains method and path');
        assert(output.msg.indexOf('Mozilla/5.0') !== -1, 'contains user agent');
      }
      if(chunks >= 2) return done();
    });
    logger.requestLogger(testHttp.req, testHttp.res, testHttp.next);
  });

  it('should keep a count of requests', function(){
    assert(logger.stats.requests === 1, 'correct amount of requests logged');
  });
});
