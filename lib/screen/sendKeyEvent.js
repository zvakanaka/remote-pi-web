const exec = require('util').promisify(require('child_process').exec)
const xdotoolKey = require('./xdotoolKeyMap')
const cliclickKey = require('./cliclickKeyMap') 
// function timeout(ms) { return new Promise(r => setTimeout(r, ms)); }

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

module.exports = async function sendKeyEvent(socket) {
  if (typeof socket.key !== 'undefined') {
    // await timeout(100)
    // console.log(`getting key '${socket.key}'`)
    const validKey = getValidKey(socket)
    if (typeof validKey !== 'undefined') {
      const keyCommand = getKeyCommand(validKey)
      // console.log(`exec: '${keyCommand}'`)
      await exec(keyCommand)
    } else {
      console.log(`key '${socket.key}' is not handled`)
    }
  }
}
