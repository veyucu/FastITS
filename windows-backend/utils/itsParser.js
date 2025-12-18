// ITS (İlaç Takip Sistemi) Karekod Parser

/**
 * ITS 2D Karekod Parse Fonksiyonu
 * Örnek: 010869897809003521H2200000425677172711301024005B73
 * 
 * Format:
 * - 01: GTIN AI (2 karakter)
 * - 14 digit: Barkod (01 sonrası 14 karakter, son 1 check digit)
 * - 21: Serial Number AI (2 karakter)
 * - Serial Number (değişken uzunlukta, 17'ye kadar)
 * - 17: Expiry Date AI (2 karakter)
 * - 6 digit: Miad (YYMMDD)
 * - 10: Lot/Batch AI (2 karakter)
 * - Lot/Batch (kalan karakterler)
 */

function parseITSBarcode(barcode) {
  try {
    let position = 0
    const result = {
      barkod: '',
      seriNo: '',
      miad: '',
      lot: '',
      raw: barcode
    }

    // Boşluk ve özel karakterleri temizle
    barcode = barcode.trim().replace(/\s+/g, '')

    // 1. GTIN (01) - İlk 2 karakter
    if (!barcode.startsWith('01')) {
      throw new Error('Geçersiz ITS karekod formatı - 01 ile başlamalı')
    }
    position += 2

    // 2. Barkod - Sonraki 14 karakter (13 digit + 1 check digit)
    const gtinFull = barcode.substring(position, position + 14)
    if (gtinFull.length < 13) {
      throw new Error('Geçersiz GTIN uzunluğu')
    }
    // İlk 0'ı atlayıp 13 digit al
    result.barkod = gtinFull.substring(1, 14) // 13 digit barkod
    position += 14

    // 3. Serial Number AI (21)
    if (barcode.substring(position, position + 2) !== '21') {
      throw new Error('Serial Number AI (21) bulunamadı')
    }
    position += 2

    // 4. Serial Number - Sonraki AI'ya kadar değişken uzunlukta (max 20 karakter)
    const serialStartPos = position
    const maxSerialLength = 20
    const searchEndPos = Math.min(serialStartPos + maxSerialLength, barcode.length - 8) // -8: '17' + 6 digit miad için yer
    
    // 17 AI'sını ara ve sonrasındaki 6 karakterin geçerli tarih olduğunu kontrol et
    let expiryAIPos = -1
    
    for (let i = serialStartPos; i <= searchEndPos; i++) {
      if (barcode.substring(i, i + 2) === '17') {
        // 17'den sonraki 6 karakter var mı ve rakam mı?
        const dateStr = barcode.substring(i + 2, i + 8)
        if (dateStr.length === 6 && /^\d{6}$/.test(dateStr)) {
          // Tarih formatı doğru mu kontrol et (YYMMDD)
          const mm = parseInt(dateStr.substring(2, 4))
          const dd = parseInt(dateStr.substring(4, 6))
          
          // Ay 01-12, gün 01-31 arası olmalı
          if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
            // Seri no min 4 karakter olmalı
            if (i - serialStartPos >= 4) {
              expiryAIPos = i
              break
            }
          }
        }
      }
    }
    
    if (expiryAIPos === -1) {
      throw new Error('Expiry Date AI (17) bulunamadı')
    }
    
    result.seriNo = barcode.substring(serialStartPos, expiryAIPos)
    position = expiryAIPos + 2 // 17'yi atla

    // 5. Expiry Date (YYMMDD) - 6 karakter
    result.miad = barcode.substring(position, position + 6)
    if (result.miad.length !== 6) {
      throw new Error('Geçersiz miad formatı (YYMMDD)')
    }
    position += 6

    // 6. Lot/Batch AI (10) - ZORUNLU
    if (barcode.substring(position, position + 2) !== '10') {
      throw new Error('Lot/Batch AI (10) bulunamadı')
    }
    position += 2

    // 7. Lot/Batch - String sonuna kadar (lot son alandır)
    result.lot = barcode.substring(position).replace(/\x1D/g, '').trim()

    // Validasyon
    if (!result.barkod || !result.seriNo || !result.miad || !result.lot) {
      throw new Error('Eksik karekod bilgisi')
    }

    console.log('✅ ITS Karekod Parse Başarılı:', result)
    return { success: true, data: result }

  } catch (error) {
    console.error('❌ ITS Karekod Parse Hatası:', error.message)
    return { 
      success: false, 
      error: error.message,
      data: null 
    }
  }
}

/**
 * Miad formatını YYMMDD'den YYYY-MM-DD'ye çevir
 */
function formatMiad(miad) {
  try {
    // YYMMDD formatı
    const yy = miad.substring(0, 2)
    const mm = miad.substring(2, 4)
    const dd = miad.substring(4, 6)
    
    // 20xx yüzyılına çevir
    const year = '20' + yy
    
    return `${year}-${mm}-${dd}`
  } catch (error) {
    return miad
  }
}

export {
  parseITSBarcode,
  formatMiad
}

