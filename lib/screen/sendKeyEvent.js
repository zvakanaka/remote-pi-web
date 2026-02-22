const exec = require('util').promisify(require('child_process').exec)
const xdotoolKey = require('./xdotoolKeyMap')
const cliclickKey = require('./cliclickKeyMap')
// function timeout(ms) { return new Promise(r => setTimeout(r, ms)); }

const isWayland = process.env.XDG_SESSION_TYPE === 'wayland'

function platformNotSupported() {
  console.log(`Platform '${process.platform}' not supported, please make a PR`)
}

function getValidKey(obj) {
  if (process.platform === 'linux') return xdotoolKey(obj.key, obj.ctrl, obj.alt, obj.shift)
  else if (process.platform === 'darwin') return cliclickKey(obj.key, obj.ctrl, obj.alt, obj.shift)
  platformNotSupported()
}

// NOTE: SECURITY - never allow anything unvalidated to get passed in to this
function getKeyCommand(validKey) {
  if (process.platform === 'linux') return `xdotool key ${validKey}`
  else if (process.platform === 'darwin') {
    // cliclick works differently from xdotool in that 'kp' is for non-character keys and 't' is for text, and modifier keys require 'kd' (key down) and 'ku' (up)
    return `cliclick ${validKey}`
  }
  platformNotSupported()
}

// wtype uses XKB key names (same as xdotoolKeyMap values) with -k flag.
// Modifiers are held with -M and released with -m.
function getWtypeCommand(obj) {
  // Get the base XKB key name without modifier prefixes
  const baseKey = xdotoolKey(obj.key, false, false, false)
  if (!baseKey) return null

  const mods = []
  if (obj.ctrl)  mods.push('ctrl')
  if (obj.alt)   mods.push('alt')
  if (obj.shift) mods.push('shift')

  const hold    = mods.map(m => `-M ${m}`).join(' ')
  const release = mods.map(m => `-m ${m}`).join(' ')
  const parts   = [hold, `-k ${baseKey}`, release].filter(s => s.length > 0)
  return `wtype ${parts.join(' ')}`
}

module.exports = async function sendKeyEvent(socket) {
  if (typeof socket.key !== 'undefined') {
    // await timeout(100)
    // console.log(`getting key '${socket.key}'`)
    let keyCommand
    if (isWayland) {
      keyCommand = getWtypeCommand(socket)
    } else {
      const validKey = getValidKey(socket)
      if (typeof validKey !== 'undefined') {
        keyCommand = getKeyCommand(validKey)
      }
    }

    if (keyCommand) {
      // console.log(`exec: '${keyCommand}'`)
      await exec(keyCommand).catch((err) => console.error(`sendKeyEvent failed: ${err.message}`))
    } else {
      console.log(`key '${socket.key}' is not handled`)
    }
  }
}
