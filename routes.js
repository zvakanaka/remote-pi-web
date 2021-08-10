const router = require('express').Router()
const renderPage = require('./lib/renderPage')
const { read } = require('./lib/file-async')

const title = 'Remote Desktop'

router.get('/', async (req, res) => {
  const pageContent = await read('./views/index.html')
  const styleContent = await read('./views/main.css')

  res.status(200).send(renderPage(title, pageContent, styleContent))
})

/* BEGIN legacy (for e-readers and old browsers) */
const nativeGetScreen = require('./lib/screen/screen')
const captureMethod = process.env.CAPTURE_METHOD || 'native'
const LEGACY_REFRESH_MS = process.env.LEGACY_REFRESH_MS || 1000
const captureFunc = captureMethod === 'native' ? nativeGetScreen : scrot
const setupNativeGetScreen = require('./lib/screen/setupNativeGetScreen')
const initOptions = setupNativeGetScreen()
initOptions.then(options => {
  router.get('/legacy', async (req, res) => {
    const pageContent = await read('./views/legacy.html')
    const styleContent = await read('./views/legacy.css')
    
    const screen = await captureFunc(options)
    res.status(200).send(renderPage(title, pageContent.replace('{{MS_REFRESH}}', LEGACY_REFRESH_MS), styleContent.replace('{{SCREEN}}', screen.toString('base64'))))
  })
})
/* END legacy */

module.exports = router
