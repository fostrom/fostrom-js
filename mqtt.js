import mqtt from 'mqtt'
import { unpack, pack } from 'msgpackr'

const invalid_device_creds_error = new Error(
  'Invalid Device Credentials. Please re-check the device credentials.'
)

const network_error_msg = retry_interval => `[Fostrom] Failed to connect to Fostrom. Retrying in ${Math.round(retry_interval / 1000)} seconds...`

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function get_mqtt_opts(config) {
  return {
    username: `${config.fleet_id}::${config.device_id}`,
    password: config.device_secret,
    clientId: 'MSGPACK',
    keepalive: config.keep_alive == true ? 30 : 0,
    reconnectPeriod: 0,
    rejectUnauthorized: false
  }
}

function backoff(interval) {
  if (interval < 3000) { return 3000 }
  if (interval == 3000) { return 5000 }
  if (interval == 5000) { return 10000 }
  if (interval == 10000) { return 15000 }
  if (interval == 15000) { return 30000 }
  return 30000
}

async function try_single_connect(config) {
  try {
    const url = config.transport == 'ws' ? config.ws_url : config.tcp_url
    let client = await mqtt.connectAsync(url, get_mqtt_opts(config))
    return client
  } catch (e) {
    return e.code == 5 ? 'unauthorized' : 'network_error'
  }
}

async function try_fallback_connect(config) {
  try {
    let client = await mqtt.connectAsync(config.tcp_url, get_mqtt_opts(config))
    return client
  } catch (e) {
    if (e.code == 5) {
      return 'unauthorized'
    } else {
      await sleep(100)

      try {
        let client = await mqtt.connectAsync(config.ws_url, get_mqtt_opts(config))
        return client
      } catch (e) {
        return e.code == 5 ? 'unauthorized' : 'network_error'
      }
    }
  }
}

async function connect(config, retry_count = 0, retry_interval = 3000) {
  const client_or_error = await config.transport == 'both' ?
    try_fallback_connect(config) : try_single_connect(config)

  if (client_or_error == 'unauthorized') {
    config.callbacks.fatal_error(invalid_device_creds_error)
  } else if (client_or_error == 'network_error') {
    console.error(network_error_msg(retry_interval))
    await sleep(retry_interval)
    retry_count = retry_count + 1
    retry_interval = retry_count <= 3 ? retry_interval : backoff(retry_interval)
    return await connect(config, retry_count, retry_interval)
  } else {
    const client = client_or_error
    return client
  }
}

async function subscribe(config, client) {
  if (config.fetch_msgs == true) {
    try {
      await client.subscribeAsync('m', { qos: 1 })
      return true
    } catch (e) {
      let failed = new Error('Failed to subscribe to messages.')
      failed.code = 2
      config.callbacks.handle_error(failed)
      return false
    }
  } else { return true }
}

function attachHooks(instance, config, client) {
  client.on('close', async () => {
    config.callbacks.disconnected()

    if (instance.reconnect) {
      console.error('[Fostrom] Disconnected. Reconnecting...')
      await sleep(500)
      instance.client = await start(instance, config)
    }
  })

  client.on('message', async (_topic, message) => {
    message = unpack(message)
    const [id, msg, pl] = message

    if (msg.startsWith('fos:') || msg.startsWith('fostrom:')) {
      // Fostrom Internal Control Message
    } else {
      const ok = await config.callbacks.handle_msg(id, msg, pl)

      if (ok !== false) {
        await client.publishAsync('a', pack([id]), { qos: 1 })
      } else {
        // The message is not to be removed from the mailbox yet.
      }
    }
  })
}

export async function start(instance, config) {
  let client = await connect(config)
  attachHooks(instance, config, client)
  if (await subscribe(config, client)) { config.callbacks.connected() }
  return client
}
