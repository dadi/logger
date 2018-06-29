# DADI Logger

[![npm (scoped)](https://img.shields.io/npm/v/@dadi/logger.svg?maxAge=10800&style=flat-square)](https://www.npmjs.com/package/@dadi/logger)
[![Coverage Status](https://coveralls.io/repos/github/dadi/logger/badge.svg?branch=master)](https://coveralls.io/github/dadi/logger?branch=master)
[![Build Status](https://travis-ci.org/dadi/logger.svg?branch=master)](https://travis-ci.org/dadi/logger)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square)](https://github.com/semantic-release/semantic-release)

## Overview

* [Install](#install)
* [Configure](#configure)
* [Using the logger](#using-the-logger)
* [Namespacing](#namespacing-log-messages)
* [HTTP request logging](#http-request-logging)
* [Log rotation](#log-rotation)
* [Viewing the logs](#viewing-the-logs)

### Usage

#### Install

```
npm install @dadi/logger --save
```

#### Configure

DADI Logger can be initialised with three parameters: log configuration,
AWS configuration and run environment. Only the first parameter is required: environment
defaults to `development`.

Property|Description|Default|Example
--------|-----------|-------|-------
enabled|If true, logging is enabled using the following settings|false|true
level|The threshold for writing to the log. Levels: `debug`, `info`, `warn`, `error`, `trace` |"info"|"warn"
stream|The stream instance to write the log to||`process.stdout`
path|The absolute or relative path to the directory for log files|"./log"|"/var/log/"
filename|The filename to use for logs, without extension| |"web"
extension|The file extension to use for logs|".log"|".txt"
accessLog| | | |
enabled|If true, HTTP access logging is enabled. The log file name is similar to the setting used for normal logging, with the addition of 'access'. For example `web.access.log`|false|true
kinesisStream|An AWS Kinesis stream to write to log records to| | |

```js
let logConfig = {
  enabled: true,
  level: "info",
  path: "./log",
  filename: "my_web_app",
  extension: "log",
  accessLog: {
    enabled: true,
    kinesisStream: "stream_name"
  }
}

let awsConfig = {
  accessKeyId: "",
  secretAccessKey: "",
  region: ""
}

const logger = require('@dadi/logger')
logger.init(logConfig, awsConfig, 'production')
```

### Using the logger

Once the logger has been initialised it's as simple as requiring the module and calling a log method:

```js
const logger = require('@dadi/logger')

logger.info('ImageHandler.get(): ' + req.url)
```

### Namespacing log messages

Log messages can be "namespaced" based on any criteria you can think of, but we like to use a "module" namespace to make it easier to track down messages from different modules.

```js
const logger = require('@dadi/logger')

logger.info({ module: 'ImageHandler' }, 'GET: ' + req.url)
```

### HTTP request logging

You can easily add an application-level middleware to log all HTTP requests. The `requestLogger` function will executed every time the app receives a request.

DADI API, CDN and Web all use this HTTP request logger.

#### Express

```js
const express = require('express')
const app = express()

const logger = require('@dadi/logger')
logger.init(logConfig)

app.use(logger.requestLogger)
```

#### Connect
```js
const connect = require('connect')
const app = connect()

const logger = require('@dadi/logger')
logger.init(logConfig)

app.use(logger.requestLogger)
```

#### Excluding sensitive parameters

It is possible to prevent sensitive querystring parameters from being written to log files by specifying an array of parameters in the configuration.

```json
let logConfig = {
  "enabled": true,
  "level": "info",
  "path": "./log",
  "filename": "my_web_app",
  "filter": ["password"],
  "extension": "log",
  "accessLog": {
    "enabled": true
  }
}
```

```
// Request URL:
/profile?username=ed&password=octopus

// Written to log as:
/profile?username=ed&password=%5BFILTERED%5D
```

#### The HTTP log record

The request log contains a stream of JSON records. Each record contains a msg property containing details about the HTTP request, formatted using the nginx server log format.

**Raw log record**
```
{"name":"access","hostname":"localhost","pid":3002,"level":30,"msg":"127.0.0.1 - 2016-07-28T13:24:13+08:00 GET /news?page=3 HTTP/1.1 200 17529 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.86 Safari/537.36","time":"2016-07-28T05:24:13.460Z","v":0}
```

**Nginx log record, extracted from `msg`**
```
127.0.0.1 - 2016-07-28T13:24:13+08:00 GET /news?page=3 HTTP/1.1 200 17529 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.86 Safari/537.36
```

This record consists of the following fields:

`remote address` - `time` `request` `status_code` `bytes_sent` `http_referer (optional)` `http_user_agent`

For example:

* remote address: `127.0.0.1`
* time: `2016-07-28T13:24:13+08:00`
* request: `GET /news?page=3 HTTP/1.1`
* status_code: `200`
* bytes_sent: `17529`
* http_referer (optional):
* http_user_agent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.86 Safari/537.36`

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

### Viewing the logs

DADI Logger uses [Bunyan](https://github.com/trentm/node-bunyan) to log errors and events. The Bunyan log output is a stream of JSON objects. A CLI tool is provided for pretty-printing Bunyan logs and for filtering.

#### Install the CLI

To make reading the application logs easier install the Bunyan CLI tool globally:

```
$ npm install -g bunyan
```

#### Pipe the stdout log when running your app

```
$ npm start | bunyan
```

#### Formats

A formatting option can be passed to the command to view shorter output. See the full range of options available [here](https://github.com/trentm/node-bunyan)

```
$ npm start | bunyan -o short
```

#### Pass the log contents to the CLI tool

```
$ tail log/web.log | bunyan
```
```
[2015-10-27T09:14:01.856Z]  INFO: web/67025 on localhost: 5 rewrites/redirects loaded. (module=router)
[2015-10-27T09:14:03.380Z]  INFO: web/67025 on localhost: Generating new access token for "/home" (module=auth)
[2015-10-27T09:14:04.510Z]  INFO: web/67025 on localhost: Token received. (module=auth)
[2015-10-27T09:14:04.517Z]  INFO: web/67025 on localhost: Generating new access token for datasource movies (module=auth/bearer)
[2015-10-27T09:14:04.623Z]  INFO: web/67025 on localhost: https://127.0.0.1:3000/1.0/app/movies?count=3&page=1&filter={"state":"published"}&fields={}&sort={} (module=helper)
[2015-10-27T09:14:04.643Z]  INFO: web/67025 on localhost: GET /home 200 65ms (module=router)
[2015-10-27T09:16:46.331Z]  INFO: web/67025 on localhost: Server stopped, process exiting. (module=server)
```

#### Filtering logs

Logs can be filtered by any valid Javascript condition. Here, `this` refers to the log record as JSON.

**Example: filter logs by module**

```
$ tail -n30 log/web.log | bunyan -c 'this.module=="router"'
```
```
[2015-10-27T09:14:01.856Z]  INFO: web/67025 on localhost: Rewrite module loaded. (module=router)
[2015-10-27T09:14:01.856Z]  INFO: web/67025 on localhost: 5 rewrites/redirects loaded. (module=router)
[2015-10-27T09:14:04.643Z]  INFO: web/67025 on localhost: GET /home 200 65ms (module=router)
```

**Example: filter logs by message contents**

```
$ tail log/web.log | bunyan -c 'this.msg.indexOf("GET") > -1' -o short
```
```
09:11:57.618Z  INFO web: GET /home 200 460ms (module=router)
09:13:18.325Z  INFO web: GET /home 200 2ms (module=router)
```

**Example: filter logs by level**

```
$ tail log/web.log | bunyan -l warn
```
```
[2015-10-25T13:54:25.429Z]  WARN: web/58045 on localhost.local: log.stage() is deprecated and will be removed in a future release. Use log.debug(), log.info(), log.warn(), log.error(), log.trace() instead.
```
