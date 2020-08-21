const exec = require('util').promisify(require('child_process').exec)
const fs = require('fs')

module.exports = function getScreen() {
  return new Promise(async (resolve, reject) => {

    const options = {
      quality: process.env.SCREENSHOT_QUALITY || 25, // NOTE: this param does not work with default format - PNG
      fileName: 'screen/screenshot.jpg'
    }
    
    
    // scrot man page: http://manpages.ubuntu.com/manpages/precise/man1/scrot.1.html
    const cliOptions = [
      `--quality ${parseInt(options.quality)}`,
      '--overwrite',
      `--pointer`,
      options.fileName
    ];
    
    // See how to check output here: https://github.com/zvakanaka/mkgif/blob/master/mkgif.js#L57
    await exec(`scrot ${cliOptions.join(' ')} ${options.fileName}`)
    
    fs.readFile(options.fileName, (err, data) => {
      if (err) reject(err)
      resolve(data)
    })
  })
}
