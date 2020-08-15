const express = require('express')
const routes = require('./routes')
const logger = require('./lib/middleware/logger')

const PORT = process.env.PORT || 3000

const app = express()

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use(logger)

app.use('/', routes)

app.listen(PORT, () => {
  console.log(new Date().toString())
  console.log(`Server listening at http://localhost:${PORT}`)
})