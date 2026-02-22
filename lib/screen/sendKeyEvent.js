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

// dotool uses XKB key names (same as xdotoolKeyMap) for its key/keydown/keyup commands.
// Modifiers are sent as separate keydown/keyup lines around the base key.
function getDotoolKeyCommands(obj) {
  const baseKey = xdotoolKey(obj.key, false, false, false)
  if (!baseKey) return null

  const mods = []
  if (obj.ctrl)  mods.push('ctrl')
  if (obj.alt)   mods.push('alt')
  if (obj.shift) mods.push('shift')

  return [
    ...mods.map(m => `keydown ${m}`),
    `key ${baseKey}`,
    ...[...mods].reverse().map(m => `keyup ${m}`)
  ].join('\n')
}

function sendDotoolKey(commands) {
  const { spawn } = require('child_process')
  return new Promise((resolve, reject) => {
    const proc = spawn('dotool')
    proc.on('error', reject)
    proc.stderr.on('data', (d) => process.stderr.write(`dotool: ${d}`))
    proc.on('close', (code) => code ? reject(new Error(`dotool exited ${code}`)) : resolve())
    proc.stdin.write(commands + '\n')
    proc.stdin.end()
  })
}

module.exports = async function sendKeyEvent(socket) {
  if (typeof socket.key !== 'undefined') {
    if (isWayland) {
      const commands = getDotoolKeyCommands(socket)
      if (commands) {
        console.log(`dotool key: ${socket.key}`)
        await sendDotoolKey(commands).catch((err) => console.error(`sendKeyEvent failed: ${err.message}`))
      } else {
        console.log(`key '${socket.key}' is not handled`)
      }
    } else {
      const validKey = getValidKey(socket)
      if (typeof validKey !== 'undefined') {
        const keyCommand = getKeyCommand(validKey)
        if (keyCommand) {
          await exec(keyCommand).catch((err) => console.error(`sendKeyEvent failed: ${err.message}`))
        }
      } else {
        console.log(`key '${socket.key}' is not handled`)
      }
    }
  }
}
