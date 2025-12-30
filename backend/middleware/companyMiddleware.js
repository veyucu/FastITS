/**
 * Company Middleware - Şirket veritabanı bilgisini request'e ekler
 * Frontend her istekte X-Company-Database header'ı gönderir
 */

import { setCurrentDatabase } from '../config/database.js'

const companyMiddleware = (req, res, next) => {
    // Header'dan şirket bilgisini al ve trim yap
    const companyDb = req.headers['x-company-database']?.trim()

    if (companyDb) {
        req.companyDb = companyDb
        setCurrentDatabase(companyDb)
    } else {
        // Varsayılan veritabanı (fallback)
        const defaultDb = process.env.DB_NAME || 'MUHASEBE2025'
        req.companyDb = defaultDb
        setCurrentDatabase(defaultDb)
    }

    next()
}

export default companyMiddleware
