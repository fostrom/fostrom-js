/* DEVICE CONFIG */

const id_regex = RegExp(/[^a-zA-Z0-9]/)
const device_secret_regex = RegExp(/FOS-[^a-zA-Z0-9]/)

/* Callbacks */
const on_connect = () => console.log('[Fostrom] Connected')
const on_disconnect = () => console.log('[Fostrom] Disconnected')

const on_error = error => console.error(
  `\n[Fostrom] Error:\n  ${error.message}\n\n  Pass an \`on_error()\` callback in the config to handle errors.\n  See https://docs.fostrom.io/libs/js for more info.`
)

const on_fatal_error = error => {
  console.error(
    `\n[Fostrom] Fatal Error:\n  ${error.message}\n\n  Exiting. The default \`on_fatal_error\` handler calls \`process.exit(1)\`.\n  If you don't want the process to exit, pass an \`on_fatal_error()\` callback in the config.\n  See https://docs.fostrom.io/libs/js for more info.`
  )

  process.exit(1)
}

const on_msg = async (id, msg, pl) => {
  console.log(`[Fostrom] Received Message: ID-${id}: ${msg} with payload: ${JSON.stringify(pl)}`)
  return true
}

/* Validation Functions */

function validate_fleet_id(fleet_id) {
  if (!fleet_id) throw '[Fostrom] Fleet ID is required.'
  if (fleet_id.length != 8) throw '[Fostrom] Fleet ID is invalid. Must be 8 characters long.'
  if (id_regex.test(fleet_id)) throw '[Fostrom] Fleet ID is invalid. Must be alphanumeric.'
  return fleet_id.toUpperCase()
}

function validate_device_id(device_id) {
  if (!device_id) throw '[Fostrom] Device ID is required.'
  if (device_id.length != 10) throw '[Fostrom] Device ID is invalid. Must be 10 characters long.'
  if (id_regex.test(device_id)) throw '[Fostrom] Device ID is invalid. Must be alphanumeric.'
  return device_id.toUpperCase()
}

function validate_device_secret(device_secret) {
  if (!device_secret) throw '[Fostrom] Device Secret is required.'

  if (device_secret.length != 36)
    throw '[Fostrom] Device Secret is invalid. Must be 36 characters long and starts with `FOS-`.'

  if (device_secret_regex.test(device_secret))
    throw '[Fostrom] Device Secret is invalid. Must be 36 characters long and starts with `FOS-`.'

  return device_secret.toUpperCase()
}

/* Default Config Functions */

function get_puback_timeout(puback_timeout) {
  if (!puback_timeout) return 30
  if (puback_timeout > 60) return 60
  if (puback_timeout < 10) return 10
  if (!Number.isInteger(puback_timeout)) return 30
  return puback_timeout
}

function get_transport(transport) {
  if (!transport) return 'both'
  if (transport == 'tcp') return 'tcp'
  if (transport == 'ws') return 'ws'
  return 'both'
}

function get_callbacks(config) {
  return {
    connected: config.on_connect || on_connect,
    disconnected: config.on_disconnect || on_disconnect,
    handle_error: config.on_error || on_error,
    fatal_error: config.on_fatal_error || on_fatal_error,
    handle_msg: config.on_msg || on_msg
  }
}

function get_connect_urls(config) {
  const fleet_id = config.fleet_id
  let tcp_url = `mqtts://${fleet_id.toLowerCase()}.fleets.fostrom.dev:8883`
  let ws_url = `wss://${fleet_id.toLowerCase()}.fleets.fostrom.dev/v1/mqtt`
  let host = '127.0.0.1'

  if (!!process.env.FOS_DEV_MODE) {
    host = !!process.env.CONNECT_HOST ? process.env.CONNECT_HOST : '127.0.0.1'
    tcp_url = `mqtt://${host}:8883`
    ws_url = `ws://${host}:9999/v1/mqtt`
  }

  return { tcp_url, ws_url }
}

/* Get Config */

function get_config(config) {
  const { tcp_url, ws_url } = get_connect_urls(config)

  return {
    fleet_id: validate_fleet_id(config.fleet_id),
    device_id: validate_device_id(config.device_id),
    device_secret: validate_device_secret(config.device_secret),
    keep_alive: !!config.keep_alive || true,
    fetch_msgs: !!config.fetch_msgs || true,
    require_puback: !!config.require_puback || true,
    puback_timeout: get_puback_timeout(config.puback_timeout),
    transport: get_transport(config.transport),
    callbacks: get_callbacks(config),
    tcp_url: tcp_url,
    ws_url: ws_url
  }
}

module.exports = { get_config }
