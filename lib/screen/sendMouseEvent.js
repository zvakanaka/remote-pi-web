const exec = require('util').promisify(require('child_process').exec)
const { spawn } = require('child_process')
const screenDimensions = require('./screenDimensions')
// function timeout(ms) { return new Promise(r => setTimeout(r, ms)); }

const isWayland = process.env.XDG_SESSION_TYPE === 'wayland'

// dotool uses 'left'/'middle'/'right'; xdotool (and the client) use 1/2/3
const DOTOOL_BTN = { 1: 'left', 2: 'middle', 3: 'right' }

let _dotoolProc = null

function getDotoolProc() {
  if (_dotoolProc && !_dotoolProc.killed) return _dotoolProc
  _dotoolProc = spawn('dotool')
  _dotoolProc.on('error', (err) => {
    console.error(`dotool error: ${err.message} (is dotool installed and /dev/uinput accessible?)`)
    _dotoolProc = null
  })
  _dotoolProc.stderr.on('data', (d) => console.error(`dotool stderr: ${d}`))
  _dotoolProc.on('close', (code) => {
    console.warn(`dotool process exited (${code}), respawning and releasing buttons`)
    _dotoolProc = null
    // Respawn immediately and release all buttons to clear any stuck state
    setTimeout(() => {
      const proc = getDotoolProc()
      proc.stdin.write('buttonup left\nbuttonup middle\nbuttonup right\n')
    }, 50)
  })
  return _dotoolProc
}

function dotool(commands) {
  console.log(`dotool: ${commands}`)
  return new Promise((resolve, reject) => {
    const proc = getDotoolProc()
    if (!proc) return reject(new Error('dotool process not available'))
    proc.stdin.write(commands + '\n', (err) => err ? reject(err) : resolve())
  })
}

// Cache screen dimensions so we only query once for mouseto percentage math
let _dims = null
async function getDims() {
  if (!_dims) _dims = await screenDimensions()
  return _dims
}

module.exports = async function sendMouseEvent(socket) {
  // Relative move — touchpad style (dx/dy sent instead of absolute x/y)
  if (typeof socket.dx !== 'undefined' && typeof socket.dy !== 'undefined') {
    const dx = parseInt(socket.dx)
    const dy = parseInt(socket.dy)
    if (isWayland) {
      await dotool(`mousemove ${dx} ${dy}`)
    } else if (process.platform === 'linux') {
      await exec(`xdotool mousemove_relative -- ${dx} ${dy}`)
    }
    return
  }

  // Click in place — no position (touch tap)
  if (typeof socket.x === 'undefined' && typeof socket.click !== 'undefined') {
    const btn = DOTOOL_BTN[parseInt(socket.click)] || 'left'
    if (isWayland) {
      await dotool(`click ${btn}`)
    } else if (process.platform === 'linux') {
      await exec(`xdotool click ${parseInt(socket.click)}`)
    }
    return
  }

  // Absolute position — desktop mouse
  if (typeof socket.x !== 'undefined' && typeof socket.y !== 'undefined') {
    const x = parseInt(socket.x)
    const y = parseInt(socket.y)
    const upOrDown = getUpOrDown(socket)

    if (isWayland) {
      const btn = DOTOOL_BTN[parseInt(socket.click)] || 'left'
      if (upOrDown) {
        const action = upOrDown === 'down' ? 'buttondown' : 'buttonup'
        await dotool(`${action} ${btn}`)
      } else {
        const { width, height } = await getDims()
        const xPct = (x / parseInt(width)).toFixed(6)
        const yPct = (y / parseInt(height)).toFixed(6)
        if (typeof socket.click !== 'undefined') {
          await dotool(`mouseto ${xPct} ${yPct}\nclick ${btn}`)
        } else {
          await dotool(`mouseto ${xPct} ${yPct}`)
        }
      }
    } else if (process.platform === 'linux') {
      const click = typeof socket.click === 'undefined' ? '' : `click ${parseInt(socket.click)}`
      const mouseCommand = `xdotool mouse${upOrDown ? upOrDown : 'move'} ${!upOrDown ? `${x} ${y} ${click}` : parseInt(socket.click)}`
      await exec(mouseCommand)
    } else if (process.platform === 'darwin') {
      const move = 'm'
      const mouseCommand = `cliclick ${upOrDown ? cliclickUpOrDown(upOrDown) : move}:${x},${y}`
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
