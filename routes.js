const router = require('express').Router()
const renderPage = require('./lib/renderPage')
const { read } = require('./lib/file-async')
const mjpegServer = require('mjpeg-server')
const sharp = require('sharp')
const title = 'Remote Desktop'
const setupNativeGetScreen = require('./lib/screen/setupNativeGetScreen')

router.get('/', async (req, res) => {
  const pageContent = await read('./views/mjpeg/index.html')
  const styleContent = await read('./views/mjpeg/main.css')

  res.status(200).send(renderPage(title, pageContent, styleContent))
})

router.get('/stream', async (req, res) => {
  const divider = req.query.divider || undefined
  const options = await setupNativeGetScreen(divider)
  if (req.query.quality) options.quality = parseInt(req.query.quality, 10)

  const { library, width, height, newWidth, newHeight } = options
  const quality = parseInt(options.quality || process.env.QUALITY || 25, 10)
  const rawOpts = { raw: { width: newWidth, height: newHeight, channels: 3 } }

  // Double-buffer: encode frame N while capturing frame N+1
  const buf0 = options.buf
  const buf1 = Buffer.alloc(newWidth * newHeight * 3)

  const mjpeg = mjpegServer.createReqHandler(req, res)
  let active = true
  req.on('close', () => {
    active = false
    console.log('Closed mjpeg stream.')
  })

  let captureBuf = buf0
  let encodeBuf = buf1
  let capturePromise = library.getScreen(0, 0, width, height, newWidth, newHeight, captureBuf)

  while (active) {
    try {
      await capturePromise
      ;[captureBuf, encodeBuf] = [encodeBuf, captureBuf]
      capturePromise = library.getScreen(0, 0, width, height, newWidth, newHeight, captureBuf)
      const screen = await sharp(encodeBuf, rawOpts).jpeg({ quality }).toBuffer()
      if (active) mjpeg.write(screen)
    } catch (e) {
      if (active) console.error('stream capture error:', e.message)
      capturePromise = library.getScreen(0, 0, width, height, newWidth, newHeight, captureBuf)
    }
  }
})

router.get('/jpeg', async (req, res) => {
  const pageContent = await read('./views/jpeg/index.html')
  const styleContent = await read('./views/jpeg/main.css')

  res.status(200).send(renderPage(title, pageContent, styleContent))
})

router.get('/frame', async (req, res) => {
  const options = await initOptions
  const quality = parseInt(req.query.quality || process.env.QUALITY || 25, 10)
  try {
    await options.library.getScreen(0, 0, options.width, options.height, options.newWidth, options.newHeight, options.buf)
    const jpg = await sharp(options.buf, {
      raw: { width: options.newWidth, height: options.newHeight, channels: 3 }
    }).jpeg({ quality }).toBuffer()
    res.type('jpeg').set('Cache-Control', 'no-store').send(jpg)
  } catch (e) {
    res.status(503).end()
  }
})

/* BEGIN legacy (for e-readers and old browsers) */
const nativeGetScreen = require('./lib/screen/screen')
const scrot = require('./lib/screen/scrot')
const captureMethod = process.env.CAPTURE_METHOD || 'native'
const LEGACY_REFRESH_MS = process.env.LEGACY_REFRESH_MS || 1000
const captureFunc = captureMethod === 'native' ? nativeGetScreen : scrot
const initOptions = setupNativeGetScreen()
initOptions.then(options => {
  router.get('/legacy', async (req, res) => {
    const pageContent = await read('./views/legacy/legacy.html')
    const styleContent = await read('./views/legacy/legacy.css')
    
    const screen = await captureFunc(options)
    res.status(200).send(renderPage(title, pageContent.replace('{{MS_REFRESH}}', LEGACY_REFRESH_MS), styleContent.replace('{{SCREEN}}', screen.toString('base64'))))
  })
})
/* END legacy */

module.exports = router
