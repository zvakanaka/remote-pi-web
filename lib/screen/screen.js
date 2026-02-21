const sharp = require('sharp')

module.exports = function getScreen({ buf, library, width, height, newWidth, newHeight, quality }) {
  return new Promise(async (resolve, reject) => {
    const timestamp = Date.now()
    await library.getScreen(0, 0, width, height, newWidth, newHeight, buf)
    // console.log(`fps: ${parseInt(1000 / (Date.now() - timestamp), 10)}`)
    const image = sharp(buf, {
        raw: {
          width: parseInt(newWidth), height: parseInt(newHeight), channels: 3,
        }
      })
      .jpeg({ quality: parseInt(quality || process.env.QUALITY || 25, 10) })
      .toBuffer()

    resolve(image)
  })
}

