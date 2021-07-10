const exec = require('util').promisify(require('child_process').exec)
const fs = require('fs')

module.exports = function getScreen() {
  return new Promise(async (resolve, reject) => {

    const options = {
      quality: process.env.QUALITY || 25, // NOTE: this param does not work with default format - PNG
      fileName: 'screen/screenshot.jpg'
    }


    // scrot man page: http://manpages.ubuntu.com/manpages/precise/man1/scrot.1.html
    const cliOptions = [
      `--quality ${parseInt(options.quality)}`,
      '--overwrite',
      '--pointer',
      '--silent',
      options.fileName
    ];

    console.time('scrot');
    // See how to check output here: https://github.com/zvakanaka/mkgif/blob/master/mkgif.js#L57
    await exec(`scrot ${cliOptions.join(' ')} ${options.fileName}`, {
      windowsHide: true,
    })
    console.timeEnd('scrot');

    console.time('readScrotFile');
    fs.readFile(options.fileName, (err, data) => {
      console.timeEnd('readScrotFile');
      if (err) reject(err)
      resolve(data)
    })
  })
}
