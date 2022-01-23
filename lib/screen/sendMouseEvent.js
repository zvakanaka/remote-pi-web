const exec = require('util').promisify(require('child_process').exec)
// function timeout(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = async function sendMouseEvent(socket) {
  if (typeof socket.x !== 'undefined' && typeof socket.x !== 'undefined') {
    const x = parseInt(socket.x)
    const y = parseInt(socket.y)

    // await timeout(100)
    const upOrDown = getUpOrDown(socket)
    
    if (process.platform === 'linux') {
      const click = typeof socket.click === 'undefined' ? '' : `click ${parseInt(socket.click)}`
      const mouseCommand = `xdotool mouse${upOrDown ? upOrDown : 'move'} ${!upOrDown ? `${x} ${y} ${click}` : parseInt(socket.click)}`
      // console.log(mouseCommand)
      await exec(mouseCommand)
    } else if (process.platform === 'darwin') {
      const move = 'm'
      const mouseCommand = `cliclick ${upOrDown ? cliclickUpOrDown(upOrDown) : move}:${x},${y}`
      // console.log(mouseCommand)
      await exec(mouseCommand)
    }
  }
}

function getUpOrDown(socket) {
  if (socket.upOrDown === 'up' || socket.upOrDown === 'down') return socket.upOrDown
  return false
}

function cliclickUpOrDown(upOrDown) {
  if (upOrDown === 'up') return 'du'
  if (upOrDown === 'down') return 'dd'
}
