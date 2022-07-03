require('dotenv').config()
require('./configs/db')
const express = require('express')
const logger = require('morgan')
const cors = require('cors')
const app = express()

app.use(cors({ origin: '*', credentials: true }))
app.use(logger('tiny'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static('uploads'))

// Routing
app.use('/', require('./routes/router'))

app.listen(process.env.PORT, process.env.HOST, () => console.log(`Server is running on port ${process.env.PORT}`))