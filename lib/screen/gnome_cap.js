const { execFile } = require('child_process')
const path = require('path')
const os = require('os')
const sharp = require('sharp')

const TMP = path.join(os.tmpdir(), `remote_pi_gnome_${process.pid}.png`)

function dbusCap(file) {
  return new Promise((resolve, reject) => {
    execFile('gdbus', [
      'call', '--session',
      '--dest', 'org.gnome.Shell',
      '--object-path', '/org/gnome/Shell/Screenshot',
      '--method', 'org.gnome.Shell.Screenshot.Screenshot',
      'false', 'false', file
    ], { timeout: 5000 }, (err, stdout) => {
      if (err) return reject(new Error(`gnome_cap gdbus failed: ${err.message}`))
      // Response is like: (true, '/path/to/file',)
      if (stdout && stdout.includes('false,')) return reject(new Error('GNOME Shell screenshot returned false'))
      resolve()
    })
  })
}

const library = {
  getScreen: async (_xx, _yy, _W, _H, nW, nH, buf) => {
    await dbusCap(TMP)
    const data = await sharp(TMP)
      .resize(parseInt(nW), parseInt(nH))
      .removeAlpha()
      .raw()
      .toBuffer()
    data.copy(buf)
  }
}

async function queryDimensions() {
  const tmpFile = path.join(os.tmpdir(), `remote_pi_gnome_dim_${process.pid}.png`)
  await dbusCap(tmpFile)
  const { width, height } = await sharp(tmpFile).metadata()
  require('fs').unlink(tmpFile, () => {})
  return { width, height }
}

module.exports = { library, queryDimensions }
