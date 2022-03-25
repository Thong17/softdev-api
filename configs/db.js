const mongoose = require('mongoose')

mongoose.connect(process.env.DATABASE_URL, {
    useNewUrlParser: true,
})
.then(() => console.log('Mongo Client is connected...'))
.catch((error) => console.error(error))
