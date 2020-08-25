const exec = require('util').promisify(require('child_process').exec)
const keys = require('./keys')
function timeout(ms) { return new Promise(r => setTimeout(r, ms)); }

function getValidKey(obj) {
  return keys(obj.key, obj.ctrl, obj.alt, obj.shift) 
}
module.exports = async function sendKeyEvent(socket) {
  if (typeof socket.key !== 'undefined') {
    await timeout(100)
    const validKey = getValidKey(socket)
    if (typeof validKey !== 'undefined') {
      // console.log(`xdotool key ${validKey}`)
      await exec(`xdotool key ${socket.key}`)
    } else {
      console.log(`key '${socket.key}' is not handled`)
    }
  }
}
