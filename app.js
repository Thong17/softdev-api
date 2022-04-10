require('dotenv').config()
require('./configs/db')
const express = require('express')
const logger = require('morgan')
const app = express()

app.use(logger('tiny'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routing
app.use('/', require('./routes/router'))

app.listen(process.env.PORT, () => console.log(`Server is running on port ${process.env.PORT}`))