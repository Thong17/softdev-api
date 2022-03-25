exports.success = (data, res) => {
    const result = {
        code: 'SUCCESS',
        data
    }
    res.status(200)
    res.json(result)
}

exports.failure = (code, message, res) => {
    const result = {
        code: 'FAILD',
        message
    }
    res.status(code)
    res.json(result)
}