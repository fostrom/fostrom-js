const { pack } = require('msgpackr')
const { get_config } = require('./config.js')
const { start } = require('./mqtt.js')

class Fostrom {
  constructor(config) {
    this.config = get_config(config)
    this.reconnect = true
  }

  async connect() {
    this.client = await start(this, this.config)
    return true
  }

  async close() {
    this.reconnect = false
    await this.client.endAsync()
  }

  async send_data(data) {
    await this.client.publishAsync('d', pack(data), { qos: 1 })
  }

  async send_msg(msg, payload) {
    await this.client.publishAsync('m', pack([msg, payload]), { qos: 1 })
  }
}

module.exports = Fostrom
