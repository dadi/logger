DADI Logger

[![npm version](https://badge.fury.io/js/%40dadi%2Flogger.png)](https://badge.fury.io/js/%40dadi%2Flogger)

```
npm install @dadi/logger --save
```

```
var logger = require('@dadi/logger')
logger.init(config.get('logging'), config.get('aws'), config.get('env'))
```

```
app.use(logger.requestLogger)
```

```
var logger = require('@dadi/logger')
logger.info('ImageHandler.get: ' + this.req.url)
```
