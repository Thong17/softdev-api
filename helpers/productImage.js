const fs = require('fs')
const path = require('path')

// Bulk-imported/seeded products often have no MinIO profile image. Rather than
// always falling back to the generic default.png, /uploads also holds a small
// library of representative photos (see routes/router.js) keyed by slugified
// product name -- read once at startup since the folder only changes on deploy.
const UPLOADS_DIR = path.join(__dirname, '../uploads')
const slugify = (value) =>
    (value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
const localImageBySlug = new Map(
    (fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [])
        .filter((file) => file !== 'default.png')
        .map((file) => [file.replace(/\.[^.]+$/, ''), file])
)

const resolveProfile = (product) => {
    if (product.profile) return product.profile
    const localFile = localImageBySlug.get(slugify(product.name?.English))
    return localFile ? { filename: localFile } : product.profile
}

// For list responses: products without a profile get the library photo matching
// their name, others are returned untouched
const withFallbackProfile = (product) => {
    if (product.profile) return product
    const profile = resolveProfile(product)
    if (!profile) return product
    return { ...(product.toObject ? product.toObject() : product), profile }
}

module.exports = { resolveProfile, withFallbackProfile }
