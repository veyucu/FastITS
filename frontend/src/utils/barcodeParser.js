/**
 * ITS 2D Barkod Parser
 * GS1 DataMatrix formatındaki barkodları parse eder
 */

/**
 * ITS karekod parse et
 * @param {string} barcode - Ham barkod verisi
 * @returns {Object|null} - Parse edilmiş veri veya null
 */
export const parseITSBarcode = (barcode) => {
  if (!barcode || barcode.length < 30) {
    return null
  }

  try {
    // Format: 01 + 14 hane GTIN + 21 + değişken seri no + 17 + 6 hane MIAD + 10 + değişken lot

    // 01 ile başlamalı
    if (!barcode.startsWith('01')) {
      return null
    }

    // GTIN: 01'den sonraki 14 karakter (sabit)
    const gtin = barcode.substring(2, 16)

    // 21 pozisyon 16'da olmalı
    if (barcode.substring(16, 18) !== '21') {
      return null
    }

    // Doğru 17 pozisyonunu bul (17YYMMDD10 formatı)
    // 17'den sonra 6 karakter tarih, sonra '10' gelmeli
    let correctAi17Index = -1
    let searchStart = 18 // 21'den sonra

    while (true) {
      const tempIndex = barcode.indexOf('17', searchStart)
      if (tempIndex === -1) break

      // 17'den sonra 6 karakter tarih, sonra '10' gelmeli
      if (tempIndex + 8 <= barcode.length) {
        const afterDate = barcode.substring(tempIndex + 8, tempIndex + 10)
        if (afterDate === '10') {
          correctAi17Index = tempIndex
          break
        }
      }
      searchStart = tempIndex + 1
    }

    if (correctAi17Index === -1) {
      return null
    }

    // Seri No: 21'den sonra (pozisyon 18), 17'ye kadar
    const serialNumber = barcode.substring(18, correctAi17Index)

    // MIAD: 17'den sonra 6 karakter (YYMMDD)
    const expiryDate = barcode.substring(correctAi17Index + 2, correctAi17Index + 8)

    // Lot: 10'dan sonra, barkod sonuna kadar
    const lotStartIndex = correctAi17Index + 8 + 2 // 17 + 6 digit + '10'
    const lotNumber = barcode.substring(lotStartIndex)

    // Validasyonlar
    if (gtin.length !== 14 || !/^\d{14}$/.test(gtin)) {
      return null
    }

    if (serialNumber.length < 1 || serialNumber.length > 50) {
      return null
    }

    if (expiryDate.length !== 6 || !/^\d{6}$/.test(expiryDate)) {
      return null
    }

    if (lotNumber.length < 1) {
      return null
    }

    return {
      gtin: gtin.replace(/^0+/, ''), // Baştaki sıfırları kaldır
      gtinRaw: gtin,
      serialNumber,
      expiryDate,
      lotNumber,
      isValid: true
    }
  } catch (error) {
    console.error('Barkod parse hatası:', error)
    return null
  }
}

/**
 * Barkod tipini belirle
 * @param {string} barcode - Ham barkod verisi
 * @returns {string} - 'its', 'carrier', 'uts' veya 'unknown'
 */
export const detectBarcodeType = (barcode) => {
  if (!barcode) return 'unknown'

  // Koli barkodu (00 ile başlar)
  if (barcode.startsWith('00')) {
    return 'carrier'
  }

  // ITS karekod (01 ile başlar ve 21, 17, 10 içerir)
  if (barcode.startsWith('01') && barcode.includes('21') && barcode.includes('17')) {
    return 'its'
  }

  // UTS olabilir
  if (barcode.length >= 10) {
    return 'uts'
  }

  return 'unknown'
}

/**
 * MIAD formatını dönüştür (YYMMDD -> GG.AA.YYYY)
 * @param {string} miad - YYMMDD formatında tarih
 * @returns {string} - GG.AA.YYYY formatında tarih
 */
export const formatExpiryDate = (miad) => {
  if (!miad || miad.length !== 6) return miad

  const yy = miad.substring(0, 2)
  const mm = miad.substring(2, 4)
  const dd = miad.substring(4, 6)

  const year = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`
  return `${dd}.${mm}.${year}`
}

/**
 * Koli barkodundan SSCC çıkar
 * @param {string} barcode - Koli barkodu
 * @returns {string} - SSCC kodu
 */
export const extractSSCC = (barcode) => {
  if (!barcode || !barcode.startsWith('00')) {
    return barcode
  }
  // 00'dan sonraki 18 karakter SSCC
  return barcode.substring(2, 20)
}

export default {
  parseITSBarcode,
  detectBarcodeType,
  formatExpiryDate,
  extractSSCC
}


