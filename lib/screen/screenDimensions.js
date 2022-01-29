const exec = require('util').promisify(require('child_process').exec)

module.exports = screenDimensions

function getScreenDimensionsDarwin() {
  return {width: 2880, height: 1800}
}
async function screenDimensions() {
  if (process.platform === 'darwin') {
    return getScreenDimensionsDarwin()
  }
  const { stdout } = await exec(`xrandr`)
  const regex = /current\s(\d+) x (\d+)/m
  const match = stdout.match(regex)
  if (Array.isArray(match)) {
    const [, width, height ] = match
    return { width, height }
  }
}