const socket = require('socket.io')
const getScreen = require('./lib/screen/getScreen')
const sendMouseEvent = require('./lib/screen/sendMouseEvent')
const sendKeyEvent = require('./lib/screen/sendKeyEvent')

module.exports = function sockets(server) {
  const io = socket.listen(server)

  io.on('connection', function onConnection(socket) {
    console.log(`Connected to socket, id: ${socket.id}`)

    socket.on('screen', async (data) => {
      const screen = await getScreen()
      socket.emit('render', screen)
    })

    if (!process.env.VIEW_ONLY) {
      socket.on('control', async (data) => {
        await sendMouseEvent(data)
        const screen = await getScreen()
        socket.emit('render', screen)
      })
      socket.on('key', async (data) => {
        await sendKeyEvent(data)
        const screen = await getScreen()
        socket.emit('render', screen)
      })
    }
  })
}
