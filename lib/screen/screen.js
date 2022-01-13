const sharp = require('sharp')

module.exports = function getScreen({ buf, library, width, height, newWidth, newHeight }) {
  return new Promise(async (resolve, reject) => {
    const timestamp = Date.now()
    library.getScreen(0, 0, width, height, newWidth, newHeight, buf)
    // console.log(`fps: ${parseInt(1000 / (Date.now() - timestamp), 10)}`)

    const image = sharp(Uint8Array
      .from(buf), {
        raw: {
          width: parseInt(newWidth), height: parseInt(newHeight), channels: 3,
        }
      })
      .jpeg({ quality: process.env.QUALITY || 25 })
      .toBuffer()

    resolve(image)
  })
}

