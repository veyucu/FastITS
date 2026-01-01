/**
 * User Middleware - Aktif kullanıcı bilgisini request context'e ekler
 * AsyncLocalStorage kullanarak tüm servislerden erişilebilir kılar
 */

import { runWithContext } from '../utils/requestContext.js'

const userMiddleware = (req, res, next) => {
    // Header'dan kullanıcı ve şirket bilgisini al
    const username = req.headers['x-username']?.trim() || ''
    const database = req.headers['x-company-database']?.trim() || process.env.DB_NAME || 'MUHASEBE2025'

    // Context objesi oluştur
    const context = {
        username,
        database
    }

    // req objesine de ekle (geriye uyumluluk için)
    req.username = username
    req.companyDb = database

    // AsyncLocalStorage context'i içinde devam et
    runWithContext(context, () => {
        next()
    })
}

export default userMiddleware
