/**
 * Document ID encoding/decoding utilities
 * Format: SUBE_KODU|FTIRSIP|FATIRS_NO|CARI_KODU
 * Encoded using Base64 for URL safety
 */

/**
 * Encode document composite key to URL-safe Base64 string
 * @param {string} subeKodu - Şube kodu
 * @param {string} ftirsip - Belge tipi (1, 2, 6)
 * @param {string} fatirs_no - Belge numarası
 * @param {string} cariKodu - Cari kodu
 * @returns {string} Base64 encoded document ID
 */
export const encodeDocumentId = (subeKodu, ftirsip, fatirs_no, cariKodu) => {
    const compositeKey = `${subeKodu}|${ftirsip}|${fatirs_no}|${cariKodu}`
    // btoa için UTF-8 encode
    return btoa(unescape(encodeURIComponent(compositeKey)))
}

/**
 * Decode Base64 document ID to composite key parts
 * @param {string} encodedId - Base64 encoded document ID
 * @returns {Object} { subeKodu, ftirsip, fatirs_no, cariKodu, compositeId }
 */
export const decodeDocumentId = (encodedId) => {
    try {
        // Base64 decode
        const compositeKey = decodeURIComponent(escape(atob(encodedId)))
        const parts = compositeKey.split('|')

        if (parts.length >= 4) {
            return {
                subeKodu: parts[0],
                ftirsip: parts[1],
                fatirs_no: parts[2],
                cariKodu: parts[3],
                // Composite ID: SUBE_KODU|FTIRSIP|FATIRS_NO|CARI_KODU
                compositeId: compositeKey
            }
        }

        throw new Error('Invalid document ID format')
    } catch (error) {
        console.error('Document ID decode error:', error)
        return null
    }
}

/**
 * Check if the given ID is in Base64 format
 * @param {string} id - Document ID to check
 * @returns {boolean}
 */
export const isEncodedId = (id) => {
    try {
        const decoded = atob(id)
        return decoded.includes('|')
    } catch {
        return false
    }
}
