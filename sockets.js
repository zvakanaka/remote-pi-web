const { Server } = require('socket.io')
const setupNativeGetScreen = require('./lib/screen/setupNativeGetScreen')
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
const CAPTURE_INTERVAL = process.env.CAPTURE_INTERVAL || 0.1 * 1000

const throttledGetScreen = async (data, socket, options) => {
  if (Date.now() - lastRenderTime >= CAPTURE_INTERVAL) {
    lastRenderTime = Date.now()
    const screen = await captureFunc(options)
    socket.emit('render', screen)
  } else {
    // console.log(`ignoring screen request (too many too fast)`)
  }
}

module.exports = async function sockets(server) {
  const io = new Server(server)

  const initOptions = await setupNativeGetScreen()

  // Track remote cursor in image-pixel coordinates (matches coordsFromClient on the client)
  const cursor = {
    x: Math.round(initOptions.newWidth / 2),
    y: Math.round(initOptions.newHeight / 2),
    screenWidth: initOptions.newWidth,
    screenHeight: initOptions.newHeight,
  }

  io.on('connection', function onConnection(socket) {
    console.log(`Connected to socket, id: ${socket.id}`)

    socket.emit('cursor', cursor)

    socket.on('disconnect', (reason) => {
      console.log(`Socket ${socket.id} disconnected: ${reason}`)
    })

    socket.on('screen', async (data) => {
      await throttledGetScreen(data, socket, initOptions)
    })

    if (!process.env.VIEW_ONLY) {
      socket.on('mouse', async (data) => {
        console.log('mouse', data)
        if (typeof data.dx !== 'undefined' && typeof data.dy !== 'undefined') {
          // Relative touch move: update tracked position first, then send absolute
          // so dotool uses mouseto (bypasses pointer acceleration) instead of mousemove
          cursor.x = Math.max(0, Math.min(initOptions.newWidth - 1, cursor.x + parseInt(data.dx)))
          cursor.y = Math.max(0, Math.min(initOptions.newHeight - 1, cursor.y + parseInt(data.dy)))
          await sendMouseEvent({ x: cursor.x, y: cursor.y })
          io.emit('cursor', cursor)
        } else {
          await sendMouseEvent(data)
          if (typeof data.x !== 'undefined' && typeof data.y !== 'undefined') {
            cursor.x = parseInt(data.x)
            cursor.y = parseInt(data.y)
            io.emit('cursor', cursor)
          }
        }
      })
      socket.on('key', async (data) => {
        console.log('key', data)
        await sendKeyEvent(data)
      })
    }
  })
}
