const router = require('express').Router()
const { list: roleList } = require('../../controllers/roleController')
const { list: productList } = require('../../controllers/productController')
const { list: customerList } = require('../../controllers/customerController')
const { list: brandList } = require('../../controllers/brandController')
const { list: categoryList } = require('../../controllers/categoryController')
const { list: presetCashList } = require('../../controllers/presetController')
const { info: productInfo } = require('../../controllers/productController')
const { listStructure: structureList } = require('../../controllers/storeController')
const response = require('../../helpers/response')
const { uploadImageController, uploadIconController, uploadPictureController } = require('../../controllers/sharedController')
const multer = require('multer')

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

const uploadPicture = multer({
  storage,
  limits: { fileSize: 0.5 * 1000 * 1000 },
}).single('picture')

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

router.get('/preset/cash/list', (req, res) => {
  presetCashList(req, res)
})

router.get('/product/list', (req, res) => {
  productList(req, res)
})

router.get('/structure/list', (req, res) => {
  structureList(req, res)
})

router.get('/customer/list', (req, res) => {
  customerList(req, res)
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

router.post('/upload/picture', (req, res) => {
  uploadPicture(req, res, (err) => {
    if (err) return response.failure(422, { msg: err.message }, res, err)
    uploadPictureController(req, res)
  })
})

module.exports = router
