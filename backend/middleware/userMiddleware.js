/**
 * User Middleware - Aktif kullanıcı bilgisini request'e ekler
 * Frontend her istekte X-Username header'ı gönderir
 */

const userMiddleware = (req, res, next) => {
    // Header'dan kullanıcı bilgisini al ve trim yap
    const username = req.headers['x-username']?.trim()

    if (username) {
        req.username = username
    } else {
        // Varsayılan kullanıcı (fallback)
        req.username = 'SYSTEM'
    }

    next()
}

export default userMiddleware
