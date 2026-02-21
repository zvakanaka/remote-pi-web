const seenFrameClients = new Set()

function logger (req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  if (req.path === '/frame') {
    if (!seenFrameClients.has(ip)) {
      seenFrameClients.add(ip)
      console.log(`GET     /frame                           ${ip} ${new Date().toString()}`)
    }
  } else {
    console.log(`${req.method.padEnd('CONNECT'.length, ' ')} ${req.url.padEnd(32, ' ')} ${ip} ${new Date().toString()}`)
  }
  next()
}

module.exports = logger
