// Copyright (C) 2024 Edge Network Technologies Limited
// Use of this source code is governed by a GNU GPL-style license
// that can be found in the LICENSE.md file. All rights reserved.

// Based on https://github.com/edge/log/blob/master/lib/adaptors/newrelic-adaptor.ts

const superagent = require('superagent')

class NewRelicAdaptor {
  config
  interval
  serviceInfo
  queue

  constructor(config, serviceInfo) {
    this.config = {...config}
    if (!this.config.url) {
      this.config.url = 'https://log-api.eu.newrelic.com/log/v1'
    }
    this.serviceInfo = serviceInfo || {}
    this.queue = []

    if (this.config.bulkCycle !== false) this.startCycle()
  }

  trace(message, context) {
    this.log('trace', message, context)
  }

  debug(message, context) {
    this.log('debug', message, context)
  }

  info(message, context) {
    this.log('info', message, context)
  }

  warn(message, context) {
    this.log('warn', message, context)
  }

  error(message, context) {
    this.log('error', message, context)
  }

  // Attempt to parse miscellaneous arguments into a standard log object, and then log it.
  // If the first argument is a string, it is set as the log message.
  // Any other arguments are added to the context object.
  // If the argument is an object, it is merged down into context (not recursively).
  // Otherwise, the argument is added to context as a `valueN` property.
  receive(level, args) {
    let message = ''
    let context = {}

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      const prop = 'value' + i.toString()
      if (i === 0 && typeof arg === 'string') message = arg
      else if (typeof arg === 'object') {
        if (arg === null || arg instanceof Array) context[prop] = arg
        Object.keys(arg).forEach(key => {
          context[key] = arg[key]
        })
      }
      else context[prop] = arg
    }

    if (Object.keys(context).length === 0) context = undefined
    this.log(level, message, context)
  }

  log(level, message, context) {
    const timestamp = (new Date()).toISOString()
    const data = {
      timestamp,
      name: this.config.name || undefined,
      level,
      message,
      context
    }
    if (this.config.bulkCycle === false) this.send(data)
    else this.queue.push(data)
  }

  postQueue() {
    if (this.queue.length === 0) return
    const logs = this.queue
    this.queue = []
    this.send(logs)
  }

  async send(data) {
    let reqData
    if (data instanceof Array) {
      reqData = [{
        common: {
          attributes: { ...this.serviceInfo }
        },
        logs: data.map(d => {
          const { timestamp, message, ...attributes } = d
          return { timestamp, message, attributes }
        })
      }]
    }
    else {
      reqData = {
        ...data,
        ...this.serviceInfo
      }
    }

    console.log(reqData)

    try {
      const req = superagent.post(this.config.url)
        .timeout(this.config.timeout || 5000)
        .set({ 'Api-Key': this.config.apiKey })
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(reqData))

      // TODO support gzip
      await req
    }
    catch (err) {
      console.error(err)
    }
  }

  startCycle() {
    this.interval = setInterval(this.postQueue.bind(this), this.config.bulkCycle || 1000)
  }

  stopCycle() {
    if (this.interval !== undefined) clearInterval(this.interval)
    this.interval = undefined
  }
}

module.exports = NewRelicAdaptor
