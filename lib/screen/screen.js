const sharp = require('sharp')

module.exports = function getScreen({ buf, library, width, height, newWidth, newHeight }) {
  return new Promise(async (resolve, reject) => {
    console.time('getScreen');
    library.getScreen(0, 0, width, height, newWidth, newHeight, buf)
    console.timeEnd('getScreen')

    // console.time('screen to jpeg');
    const image = sharp(Uint8Array
      .from(buf), {
        raw: {
          width: parseInt(newWidth), height: parseInt(newHeight), channels: 3,
        }
      })
      .jpeg({ quality: process.env.QUALITY || 25 })
      .toBuffer()
    // console.timeEnd('screen to jpeg');

    resolve(image)
  })
}

