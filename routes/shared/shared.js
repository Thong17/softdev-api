const router = require('express').Router()
const { minioStorage } = require('../../configs/multer')
const { list: roleList } = require('../../controllers/roleController')
const { list: productList } = require('../../controllers/productController')
const { list: customerList } = require('../../controllers/customerController')
const { list: brandList } = require('../../controllers/brandController')
const { list: categoryList } = require('../../controllers/categoryController')
const { list: presetCashList } = require('../../controllers/presetController')
const { info: productInfo, listCode } = require('../../controllers/productController')
const { listStructure: structureList } = require('../../controllers/storeController')
const response = require('../../helpers/response')
const { uploadImageController, uploadIconController, uploadPictureController, structureCapacity } = require('../../controllers/sharedController')

const uploadImage = minioStorage.array('images', 10) 
const uploadIcon = minioStorage.single('icon')
const uploadPicture = minioStorage.single('picture')

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

router.get('/structure/capacity', (req, res) => {
  structureCapacity(req, res)
})

router.get('/product/listCode', (req, res) => {
  listCode(req, res)
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
