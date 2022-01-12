const setupNativeGetScreen = require('../lib/screen/setupNativeGetScreen')
const divider = 1
const initOptions = setupNativeGetScreen(divider)
const nativeGetScreen = require('../lib/screen/screen')
const sharp = require('sharp')

initOptions.then(async options => {
  const screen = await nativeGetScreen(options)
  sharp(screen).toFile('output.jpg');
})
