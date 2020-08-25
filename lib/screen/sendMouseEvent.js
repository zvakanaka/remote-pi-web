const exec = require('util').promisify(require('child_process').exec)
function timeout(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = async function sendMouseEvent(socket) {
  if (typeof socket.x !== 'undefined' && typeof socket.x !== 'undefined') {
    const x = parseInt(socket.x)
    const y = parseInt(socket.y)
    const click = typeof socket.click === 'undefined' ? '' : `click ${parseInt(socket.click)}`
    await timeout(100)
    // console.log(`xdotool mousemove ${x} ${y} ${click}`)
    await exec(`xdotool mousemove ${x} ${y} ${click}`)
  }
}
