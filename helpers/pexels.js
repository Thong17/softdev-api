// Pexels photo search for product pictures (Admin › Migration › Find online).
// Pexels photos are free for commercial use; the API key stays on the server.
// API guidelines: show a link to Pexels and credit photographers where possible.
const axios = require('axios')

const API = 'https://api.pexels.com/v1'
const MAX_BYTES = 5 * 1024 * 1024
// axios 1.2 asks for every compression and fails to unpack Pexels' reply
// (Z_BUF_ERROR "unexpected end of file"), so ask for it uncompressed
const NO_COMPRESSION = { 'Accept-Encoding': 'identity' }

const isEnabled = () => !!process.env.PEXELS_API_KEY

// A Pexels failure as a message for the user
const pexelsError = (err) => {
    if (err.userMessage) return err
    const status = err.response?.status
    // The real cause, for the server log (never the key)
    console.error(`Pexels request failed: ${err.code || ''} ${status || ''} ${err.message}`)
    const error = new Error(
        status === 401 || status === 403 ? 'The Pexels API key was refused; check PEXELS_API_KEY'
            : status === 429 ? 'Pexels search limit reached for now (200 per hour); try again later'
            : err.code === 'ECONNABORTED' ? 'Pexels took too long to answer; try again'
            : 'Could not reach Pexels'
    )
    error.userMessage = true
    return error
}

const client = () => {
    if (!isEnabled()) {
        const error = new Error('Photo search is not set up: add PEXELS_API_KEY to the API settings')
        error.userMessage = true
        throw error
    }
    return axios.create({ baseURL: API, timeout: 15000, headers: { Authorization: process.env.PEXELS_API_KEY, ...NO_COMPRESSION } })
}

const toCandidate = (photo) => ({
    id: photo.id,
    thumb: photo.src?.medium,
    alt: photo.alt || '',
    photographer: photo.photographer,
    photographerUrl: photo.photographer_url,
    pageUrl: photo.url,
})

// Up to 8 candidates for a search text
const search = async (query, page = 1) => {
    try {
        const { data } = await client().get('/search', { params: { query, per_page: 8, page } })
        return { photos: (data.photos || []).map(toCandidate), hasMore: !!data.next_page }
    } catch (err) {
        throw pexelsError(err)
    }
}

// One photo's details, straight from Pexels
const photo = async (id) => {
    try {
        const { data } = await client().get(`/photos/${encodeURIComponent(id)}`)
        return data
    } catch (err) {
        throw pexelsError(err)
    }
}

// Downloads an image Pexels returned; any other address is refused
const download = async (url) => {
    let parsed
    try { parsed = new URL(url) } catch (err) { parsed = null }
    if (!parsed || parsed.protocol !== 'https:' || parsed.hostname !== 'images.pexels.com') {
        const error = new Error('Not a Pexels image address')
        error.userMessage = true
        throw error
    }
    try {
        // No redirects: the request must stay on images.pexels.com
        const response = await axios.get(parsed.toString(), { responseType: 'arraybuffer', timeout: 20000, maxContentLength: MAX_BYTES, maxRedirects: 0, headers: NO_COMPRESSION })
        return { buffer: Buffer.from(response.data), mimetype: response.headers['content-type'] || 'image/jpeg' }
    } catch (err) {
        const error = new Error(err.message?.includes('maxContentLength') ? 'The photo is larger than 5 MB' : 'Could not download the photo')
        error.userMessage = true
        throw error
    }
}

module.exports = { isEnabled, search, photo, download }
