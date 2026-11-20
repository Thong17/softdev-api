require('dotenv').config()
require('./configs/db')
const express = require('express')
const logger = require('morgan')
const cors = require('cors')
const app = express()

app.use(cors({ origin: '*', credentials: true }))
app.use(logger('tiny'))
// Admin > Migration sends up to 5000 previewed rows (or chosen product ids) at
// once, past the 100 KB default; these routes only. Parsed here, the general
// parser below leaves the body alone
app.use(['/admin/migration/product/import', '/admin/migration/stock/import', '/admin/migration/stock/template', '/admin/migration/stock/template/products'], express.json({ limit: '10mb' }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routing
app.use('/', require('./routes/router'))

app.listen(process.env.PORT, process.env.HOST, () => console.log(`Server is running on port ${process.env.PORT}`))