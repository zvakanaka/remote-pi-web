const router = require('express').Router()
const renderPage = require('./lib/renderPage')
const { read } = require('./lib/file-async')
const mjpegServer = require('mjpeg-server')
const title = 'Remote Desktop'
const setupNativeGetScreen = require('./lib/screen/setupNativeGetScreen')

router.get('/', async (req, res) => {
  const pageContent = await read('./views/mjpeg/index.html')
  const styleContent = await read('./views/mjpeg/main.css')

  res.status(200).send(renderPage(title, pageContent, styleContent))
})

router.get('/stream', async (req, res) => {
  const options = await setupNativeGetScreen()
  const mjpeg = mjpegServer.createReqHandler(req, res);
  const CAPTURE_INTERVAL = process.env.CAPTURE_INTERVAL || 0.1 * 1000
  const intervalId = setInterval(async () => {
    // TODO: detect slowness and throttle when turtles happen
    const screen = await captureFunc(options)
    mjpeg.write(screen);
  }, CAPTURE_INTERVAL);

  // req.on('close', () => {
  //   clearInterval(intervalId);
  //   console.log('Closed mjpeg stream.');
  // });
});

router.get('/jpeg', async (req, res) => {
  const pageContent = await read('./views/jpeg/index.html')
  const styleContent = await read('./views/jpeg/main.css')

  res.status(200).send(renderPage(title, pageContent, styleContent))
})

/* BEGIN legacy (for e-readers and old browsers) */
const nativeGetScreen = require('./lib/screen/screen')
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
