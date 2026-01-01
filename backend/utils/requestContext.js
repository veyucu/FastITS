/**
 * Request Context - AsyncLocalStorage ile request bazlı veri saklama
 * Her HTTP isteği için izole bir context sağlar
 * Farklı kullanıcılar aynı anda sistemi kullansa bile karışmaz
 */

import { AsyncLocalStorage } from 'async_hooks'

// AsyncLocalStorage instance
const asyncLocalStorage = new AsyncLocalStorage()

/**
 * Request context'i başlat (middleware'de çağrılır)
 */
export const runWithContext = (context, callback) => {
    return asyncLocalStorage.run(context, callback)
}

/**
 * Mevcut context'i al
 */
export const getContext = () => {
    return asyncLocalStorage.getStore() || {}
}

/**
 * Mevcut kullanıcı adını al
 */
export const getCurrentUsername = () => {
    const context = getContext()
    return context.username || ''
}

/**
 * Mevcut şirket veritabanını al
 */
export const getCurrentDatabase = () => {
    const context = getContext()
    return context.database || process.env.DB_NAME || 'MUHASEBE2025'
}

/**
 * Context'e değer ekle/güncelle
 */
export const setContextValue = (key, value) => {
    const context = getContext()
    context[key] = value
}

export default {
    runWithContext,
    getContext,
    getCurrentUsername,
    getCurrentDatabase,
    setContextValue
}
