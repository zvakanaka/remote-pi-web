const router = require('express').Router()
const renderPage = require('./lib/renderPage')
const { read } = require('./lib/file-async')
const getScreen = require('./lib/screen/getScreen')

router.get('/', async (req, res) => {
  const pageContent = await read('./views/index.html')
  const styleContent = await read('./views/main.css')

  res.status(200).send(renderPage('Remote Pi', pageContent, styleContent))
})

router.get('/e-ink', async (req, res) => {
  const screen1 = await getScreen()
  const screen = await read('./screen/screenshot.jpg', 'base64')
  const pageContent = await read('./views/e-ink.html')
  const styleContent = ''//await read('./views/main.css')
//    const rotatedImage = await sharp('./screen/screenshot.jpg').rotate(270).toBuffer()
//       const screen = rotatedImage.toString('base64');
    res.status(200).send(renderPage('Remote Pi', pageContent.replace('${screen}', screen), styleContent))
})


module.exports = router
