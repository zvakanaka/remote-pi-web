function logger (req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  // const userAgent = req.get('User-Agent')
  console.log(`${req.method.padEnd('CONNECT'.length, ' ')} ${req.url.padEnd(32, ' ')} ${ip} ${new Date().toString()}`)
  next()
}

module.exports = logger
