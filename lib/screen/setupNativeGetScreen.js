const ffi = require('ffi-napi');
const screenDimensions = require('./screenDimensions')

const isOSX = process.platform === 'darwin'

if (!isOSX && process.env.XDG_SESSION_TYPE !== 'x11') {
  console.warn(`No support for $XDG_SESSION_TYPE '${process.env.XDG_SESSION_TYPE}'`)
}
module.exports = async function setupNativeGetScreen(divider = 1) {
  const { width, height } = await screenDimensions()
  console.log(`Screen dimensions: ${width}x${height}`)
  const newWidth = width / divider
  const newHeight = height / divider
  const size = newWidth * newHeight
  const buf = Buffer.alloc(size * 3) // multiply by 3 for RGB
  const library = new ffi.Library('./lib/screen/screen', {
    getScreen: [
      'void', ['int', 'int', 'int', 'int', 'int', 'int', 'uchar *']
    ]
  });

  return { buf, library, width, height, newWidth, newHeight }
}