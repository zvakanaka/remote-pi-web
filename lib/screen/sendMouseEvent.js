const exec = require('util').promisify(require('child_process').exec)
function timeout(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = async function sendMouseEvent(socket) {
  if (typeof socket.x !== 'undefined' && typeof socket.x !== 'undefined') {
    const x = parseInt(socket.x)
    const y = parseInt(socket.y)

    const click = typeof socket.click === 'undefined' ? '' : `click ${parseInt(socket.click)}`
    // await timeout(100)
    const upOrDown = getUpOrDown(socket)
    
    const xdotoolCommand = `xdotool mouse${upOrDown ? upOrDown : 'move'} ${!upOrDown ? `${x} ${y} ${click}` : parseInt(socket.click)}`
    // console.log(xdotoolCommand)
    await exec(xdotoolCommand)
  }
}

function getUpOrDown(socket) {
  if (socket.upOrDown === 'up' || socket.upOrDown === 'down') return socket.upOrDown
  return false
}