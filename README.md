# DADI Logger

[![npm (scoped)](https://img.shields.io/npm/v/@dadi/logger.svg?maxAge=10800&style=flat-square)](https://www.npmjs.com/package/@dadi/logger)&nbsp;[![coverage](https://img.shields.io/badge/coverage-72%25-yellow.svg?style=flat-square)](https://github.com/dadi/logger)&nbsp;[![Build](http://ci.dadi.technology/dadi/logger/badge?branch=master&service=shield)](http://ci.dadi.technology/dadi/logger)&nbsp;[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)

## Overview



### Usage

#### Install

```
npm install @dadi/logger --save
```

#### Configure

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
  accessLog: {
    enabled: true, // If true, HTTP access logging is enabled. The log file name is similar to the setting used for normal logging, with the addition of 'access'. For example `web.access.log`
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

### Log Rotation

> Automatic log rotation was removed from DADI Logger in v1.1.0 due to the number
of applications relying on it that were being run on multiple CPU cores using Node's cluster module. **Log rotation should now be configured via your operating system.**

The below details are for a system running Ubuntu 14.04.

You can get detailed information about the `logrotate` tool from https://support.rackspace.com/how-to/understanding-logrotate-utility/

**Example `logrotate` configuration file for a DADI Web log file**

File: `/etc/logrotate.d/web-production`

```
/data/apps/web/log/web.production.log {
    su root root
    daily
    rotate 14
    missingok
    notifempty
    copytruncate
    compress
}
```
