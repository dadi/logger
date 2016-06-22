DADI Logger

[![npm version](https://badge.fury.io/js/%40dadi%2Flogger.png)](https://badge.fury.io/js/%40dadi%2Flogger)

### Install

```
npm install @dadi/logger --save
```

### Configure

DADI Logger can be initialised with three parameters: log configuration,
AWS configuration and run environment. Only the first parameter is required: environment
defaults to `development`.

```js
var logConfig = {
  enabled: true, // If true, logging is enabled using the following settings
  level: "info", // Sets the logging level
  path: "./log", // The absolute or relative path to the directory for log files
  filename: "my_web_app", // The name to use for the log file, without extension
  extension: "log", // The extension to use for the log file
  fileRotationPeriod: "1d", // The period at which to rotate the log file. This is a string of the format '$number$scope' where '$scope' is one of 'ms' (milliseconds), 'h' (hours), 'd' (days), 'w' (weeks), 'm' (months), 'y' (years). The following names can be used 'hourly' (= '1h'), 'daily (= '1d'), 'weekly' ('1w'), 'monthly' ('1m'), 'yearly' ('1y')."
  fileRetentionCount: 7, // The number of rotated log files to keep
  accessLog: {
    enabled: true, // If true, HTTP access logging is enabled. The log file name is similar to the setting used for normal logging, with the addition of 'access'. For example `web.access.log`
    fileRotationPeriod: "1d",
    fileRetentionCount: 7    // keep 7 back copies
    kinesisStream: "stream_name" // An AWS Kinesis stream to write to log records to
    }
  }
}

var awsConfig = {
  accessKeyId: "",
  secretAccessKey: "",
  region: ""
}

var env = 'development'

var logger = require('@dadi/logger')
logger.init(logConfig, awsConfig, env)
```

### Add HTTP request logging

```js
app.use(logger.requestLogger)
```

### Add logging to other modules

```js
var logger = require('@dadi/logger')
logger.info('ImageHandler.get: ' + this.req.url)
```
