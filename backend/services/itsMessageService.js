/**
 * ITS Mesaj Cache Servisi
 * AKTBLITSMESAJ tablosunu bir kez yükler ve bellekte tutar
 * 239 sabit kayıt olduğu için her seferinde veritabanına gitmeye gerek yok
 */

import { getPTSConnection } from '../config/database.js'

// Mesaj cache - Map<string, string> (kod -> mesaj)
let messageCache = new Map()
let isLoaded = false

/**
 * Mesajları veritabanından yükle (bir kez çağrılır)
 */
async function loadMessages() {
    if (isLoaded) {
        console.log('📋 ITS Mesajları zaten yüklendi, cache kullanılıyor')
        return
    }

    try {
        console.log('📋 ITS Mesajları yükleniyor...')
        const pool = await getPTSConnection()
        const result = await pool.request().query('SELECT ID, DBO.TRK(MESAJ) AS MESAJ FROM AKTBLITSMESAJ')

        // Map'e ekle - ID'yi string olarak normalize et
        result.recordset.forEach(row => {
            const normalizedId = String(row.ID).replace(/^0+/, '') || '0'
            messageCache.set(normalizedId, row.MESAJ)
            // Orijinal ID'yi de ekle (başında sıfır olanlar için)
            messageCache.set(String(row.ID), row.MESAJ)
        })

        isLoaded = true
        console.log(`✅ ITS Mesajları yüklendi: ${messageCache.size} kayıt`)
    } catch (error) {
        console.error('❌ ITS Mesajları yüklenemedi:', error.message)
        // Hata olsa bile tekrar denenebilir
        isLoaded = false
    }
}

/**
 * Mesaj koduna göre mesaj getir
 * @param {string|number} kod - Mesaj kodu
 * @param {string} defaultMessage - Bulunamazsa döndürülecek varsayılan mesaj
 * @returns {string} Mesaj metni
 */
function getMessage(kod, defaultMessage = null) {
    if (!isLoaded) {
        console.warn('⚠️ ITS Mesajları henüz yüklenmedi')
        return defaultMessage || `Kod: ${kod}`
    }

    // Normalize et (baştaki sıfırları kaldır)
    const normalizedKod = String(kod || '').replace(/^0+/, '') || '0'

    // Önce normalize edilmiş kodu dene
    if (messageCache.has(normalizedKod)) {
        return messageCache.get(normalizedKod)
    }

    // Orijinal kodu dene
    if (messageCache.has(String(kod))) {
        return messageCache.get(String(kod))
    }

    // Kod 0 ise başarılı
    if (normalizedKod === '0') {
        return 'Başarılı'
    }

    return defaultMessage || `Kod: ${kod}`
}

/**
 * Tüm mesajları Map olarak getir (nadiren gerekebilir)
 * @returns {Map<string, string>}
 */
function getAllMessages() {
    return messageCache
}

/**
 * Cache'i temizle ve yeniden yükle (nadiren gerekebilir)
 */
async function reloadMessages() {
    messageCache.clear()
    isLoaded = false
    await loadMessages()
}

/**
 * Cache durumunu kontrol et
 */
function isCacheLoaded() {
    return isLoaded
}

export {
    loadMessages,
    getMessage,
    getAllMessages,
    reloadMessages,
    isCacheLoaded
}

export default {
    loadMessages,
    getMessage,
    getAllMessages,
    reloadMessages,
    isCacheLoaded
}
