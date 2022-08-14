const router = require('express').Router()
const { list: roleList } = require('../../controllers/roleController')
const { list: productList } = require('../../controllers/productController')
const { list: brandList } = require('../../controllers/brandController')
const { list: categoryList } = require('../../controllers/categoryController')
const { info: productInfo } = require('../../controllers/productController')
const response = require('../../helpers/response')
const { uploadImageController, uploadIconController } = require('../../controllers/sharedController')
const multer = require('multer')
const security = require('../../middleware/security/index')

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads')
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}_${file.originalname}`)
  },
})

const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1000 * 1000 },
}).array('images', 10) 

const uploadIcon = multer({
  storage,
  limits: { fileSize: 0.5 * 1000 * 1000 },
}).single('icon')

router.get('/product/info/:id', (req, res) => {
  productInfo(req, res)
})

router.get('/role/list', (req, res) => {
  roleList(req, res)
})

router.get('/brand/list', (req, res) => {
  brandList(req, res)
})

router.get('/category/list', (req, res) => {
  categoryList(req, res)
})

router.get('/product/list', (req, res) => {
  productList(req, res)
})

router.post('/upload/image', (req, res) => {
  uploadImage(req, res, (err) => {
    if (err) return response.failure(422, { msg: err.message }, res, err)
    uploadImageController(req, res)
  })
})

router.post('/upload/icon', (req, res) => {
  uploadIcon(req, res, (err) => {
    if (err) return response.failure(422, { msg: err.message }, res, err)
    uploadIconController(req, res)
  })
})

module.exports = router
