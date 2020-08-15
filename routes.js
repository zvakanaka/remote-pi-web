const router = require('express').Router()
const fs = require('fs')
const exec = require('util').promisify(require('child_process').exec);
const renderPage = require('./lib/renderPage')
const { read } = require('./lib/file-async')

function timeout(ms) { return new Promise(r => setTimeout(r, ms)); }

router.get('/screen', async (req, res) => {
  if (!req.query.uuid) throw new Error('Must provide \'uuid\' param')

  if (typeof req.query.x !== 'undefined' && typeof req.query.x !== 'undefined') {
    const x = parseInt(req.query.x)
    const y = parseInt(req.query.y)
    const click = typeof req.query.click === 'undefined' ? '' : `click ${parseInt(req.query.click)}`
    await timeout(100)
    await exec(`xdotool mousemove ${x} ${y} ${click}`)
  }

  const options = {
    quality: 25, // NOTE: does not work with default format - PNG
    fileName: `./screen/${req.query.uuid}.jpg`
  };


  // scrot man page: http://manpages.ubuntu.com/manpages/precise/man1/scrot.1.html
  const cliOptions = [
    `--quality ${options.quality || 100}`,
    '--overwrite',
    `--pointer`,
    options.fileName
  ];

  // See how to check output here: https://github.com/zvakanaka/mkgif/blob/master/mkgif.js#L57
  await exec(`scrot ${cliOptions.join(' ')} ${options.fileName}`)

  res.setHeader('content-type', 'image/jpeg')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('cache-control', 'no-cache')
  
  fs.createReadStream(options.fileName).pipe(res)
})

router.get('/', async (req, res) => {
  const pageContent = await read('./views/index.html')
  const styleContent = await read('./views/main.css')

  res.status(200).send(renderPage('Remote Pi', pageContent, styleContent))
})

module.exports = router
