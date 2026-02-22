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

// Build dotool commands for a key event.
//
// For plain printable characters (no ctrl/alt), use dotool's 'type' command —
// it handles keyboard layout and shift automatically, so '!' and '.' just work.
//
// For special keys (Enter, Escape, arrows …) and modifier combos (Ctrl+C …),
// use key/keydown/keyup with XKB names from xdotoolKeyMap.
function getDotoolKeyCommands(obj) {
  const { key, ctrl, alt, shift } = obj

  // Standalone modifier keypresses don't need to be forwarded
  if (['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'NumLock'].includes(key)) return null

  const mods = []
  if (ctrl) mods.push('ctrl')
  if (alt)  mods.push('alt')

  // Plain printable character (single char, no ctrl/alt):
  // let dotool handle layout & shift so '!', '.', etc. work reliably
  if (key.length === 1 && mods.length === 0) {
    return `type ${key}`
  }

  // Special / non-printable key, or modifier+key combo
  const baseKey = xdotoolKey(key, false, false, false)
  if (!baseKey) return null

  // shift is a modifier too when combined with ctrl/alt or for special keys
  const allMods = [...(shift ? ['shift'] : []), ...mods]
  if (allMods.length === 0) return `key ${baseKey}`

  return [
    ...allMods.map(m => `keydown ${m}`),
    `key ${baseKey}`,
    ...[...allMods].reverse().map(m => `keyup ${m}`)
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
