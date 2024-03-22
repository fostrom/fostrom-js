import { pack } from 'msgpackr'
import { get_config } from './config.js'
import { start } from './mqtt.js'

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

export default Fostrom
