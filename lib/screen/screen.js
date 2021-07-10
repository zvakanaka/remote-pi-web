const ffi = require('ffi-napi');
const screenDimensions = require('./screenDimensions')
const sharp = require('sharp')

if (process.env.XDG_SESSION_TYPE !== 'x11') {
  console.warn(`No support for $XDG_SESSION_TYPE '${XDG_SESSION_TYPE}'`)
}

module.exports = function getScreen() {
  return new Promise(async (resolve, reject) => {
    const { width, height } = await screenDimensions()

    const divider = 1
    const newWidth = width / divider
    const newHeight = height / divider
    const size = newWidth * newHeight

    const buf = Buffer.alloc(size * 3) // multiply by 3 for RGB

    const library = new ffi.Library('./lib/screen/screen', {
      getScreen: [
        'void', ['int', 'int', 'int', 'int', 'int', 'int', 'uchar *']
      ]
    });
    console.time('getScreen');
    library.getScreen(0, 0, width, height, newWidth, newHeight, buf)
    console.timeEnd('getScreen')

    console.time('screen to jpeg');
    const image = sharp(Uint8Array
      .from(buf), {
      raw: {
        width: parseInt(newWidth), height: parseInt(newHeight), channels: 3,
      }
    })
      .jpeg({ quality: process.env.QUALITY || 25 })
      .toBuffer()
    console.timeEnd('screen to jpeg');

    resolve(image)

    //  console.log(`${width}x${height} ${size}`)
    // const THRESHOLD = 128 * 3
    // for (let i = 0; i < newHeight; i++) {
    //   for (let j = 0; j < newWidth * 3; j += 3) {
    //     const r = Number(buf[i * newWidth * 3 + j])
    //     const g = Number(buf[i * newWidth * 3 + j + 1])
    //     const b = Number(buf[i * newWidth * 3 + j + 2])
    //     const isOn = r + g + b > THRESHOLD
    //     process.stdout.write(isOn ? '##' : '  ');
    //     // process.stdout.write(i * newWidth * 3 + j);
    //   }
    //   console.log()
    // }

  })
}

