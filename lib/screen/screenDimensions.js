const exec = require('util').promisify(require('child_process').exec)
const path = require('path')

module.exports = screenDimensions

function getScreenDimensionsDarwin() {
  return {width: 2880, height: 1800}
}

const isGnomeWayland = process.env.XDG_SESSION_TYPE === 'wayland' &&
  (process.env.XDG_CURRENT_DESKTOP || '').includes('GNOME')

async function screenDimensions() {
  if (process.platform === 'darwin') {
    return getScreenDimensionsDarwin()
  }
  if (process.env.XDG_SESSION_TYPE === 'wayland' && !isGnomeWayland) {
    const bin = path.join(__dirname, '../../lib/screen/wayland_cap')
    const { stdout } = await exec(`${bin} query`)
    const [width, height] = stdout.trim().split(' ')
    return { width, height }
  }
  // X11 or GNOME Wayland (XWayland provides xrandr on GNOME)
  const { stdout } = await exec(`xrandr`)
  const regex = /current\s(\d+) x (\d+)/m
  const match = stdout.match(regex)
  if (Array.isArray(match)) {
    const [, width, height ] = match
    return { width, height }
  }
}
