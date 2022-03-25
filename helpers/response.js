const { successCode, failureCode } = require('../constants/statusCodes')

exports.send = (code, data, res) => {
    const result = {
        code: successCode[code] ? successCode[code] : 'UNKNOWN_CODE',
        data
    }
    res.status(code)
    res.json(result)
}