const socket = require('socket.io')
const nativeGetScreen = require('./lib/screen/screen')
const scrot = require('./lib/screen/scrot')
const sendMouseEvent = require('./lib/screen/sendMouseEvent')
const sendKeyEvent = require('./lib/screen/sendKeyEvent')

const captureMethod = process.env.CAPTURE_METHOD || 'native'
const captureFunc = captureMethod === 'native' ? nativeGetScreen : scrot
console.log(`using capture method '${captureMethod}'`)

if (process.env.VIEW_ONLY) {
  console.log('VIEW_ONLY mode')
}

let lastRenderTime = Date.now()
const REFRESH_INTERVAL_MS = process.env.REFRESH_INTERVAL_MS || 0.5 * 1000

const throttledGetScreen = async (data, socket) => {
  if (Date.now() - lastRenderTime >= REFRESH_INTERVAL_MS) {
    lastRenderTime = Date.now()
    const screen = await captureFunc()
    socket.emit('render', screen)
  } else {
    console.log(`ignoring screen request (too many too fast)`)
  }
}

module.exports = function sockets(server) {
  const io = socket.listen(server)

  io.on('connection', function onConnection(socket) {
    console.log(`Connected to socket, id: ${socket.id}`)

    socket.on('screen', async (data) => {
      await throttledGetScreen(data, socket)
    })

    if (!process.env.VIEW_ONLY) {
      socket.on('mouse', async (data) => {
        await sendMouseEvent(data)
        await throttledGetScreen(data, socket)
      })
      socket.on('key', async (data) => {
        await sendKeyEvent(data)
        await throttledGetScreen(data, socket)
      })
    }
  })
}
