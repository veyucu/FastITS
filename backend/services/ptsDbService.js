import db, { getPTSConnection, getConnection } from '../config/database.js'
import sql from 'mssql'
import iconv from 'iconv-lite'
import { log } from '../utils/logger.js'
import settingsService from './settingsService.js'

/**
 * Türkçe karakter düzeltme fonksiyonu - SQL Server CP1254 to UTF-8
 */
const fixTurkishChars = (str) => {
  if (!str || typeof str !== 'string') return str

  try {
    let fixed = str

    try {
      const buf = Buffer.from(fixed, 'latin1')
      fixed = iconv.decode(buf, 'cp1254')
    } catch (e) {
      // iconv hatası - devam et
    }

    if (fixed.includes('?') || fixed.match(/[\u0080-\u00FF]/)) {
      const charMap = {
        'Ä°': 'İ', 'Ä±': 'ı',
        'ÅŸ': 'ş', 'Åž': 'Ş',
        'Ã§': 'ç', 'Ã‡': 'Ç',
        'ÄŸ': 'ğ', 'Äž': 'Ğ',
        'Ã¼': 'ü', 'Ãœ': 'Ü',
        'Ã¶': 'ö', 'Ã–': 'Ö',
        'Â': '', '�': '',
        '\u00DD': 'İ', '\u00FD': 'ı',
        '\u00DE': 'Ş', '\u00FE': 'ş',
        '\u00D0': 'Ğ', '\u00F0': 'ğ',
      }

      for (const [wrong, correct] of Object.entries(charMap)) {
        fixed = fixed.split(wrong).join(correct)
      }
    }

    return fixed.trim()
  } catch (error) {
    return str
  }
}

/**
 * PTS Veritabanı Servisi
 * XML paket verilerini AKTBLPTSMAS ve AKTBLPTSTRA tablolarına kaydeder
 */

/**
 * Paket verilerini kaydet (Master + Transaction)
 * @param {Object} packageData - Parse edilmiş paket verisi
 * @returns {Promise<Object>}
 */
async function savePackageData(packageData) {
  try {
    const pool = await getPTSConnection()
    const transaction = new sql.Transaction(pool)

    await transaction.begin()

    try {
      const { transferId, documentNumber, documentDate, sourceGLN, destinationGLN,
        actionType, shipTo, note, version, products, _rawXML, kayitKullanici } = packageData

      // transferId'yi BIGINT'e dönüştür
      const transferIdBigInt = BigInt(transferId)

      // Transfer ID'nin zaten kaydedilip kaydedilmediğini kontrol et
      const checkRequest = new sql.Request(transaction)
      checkRequest.input('transferId', sql.BigInt, transferIdBigInt)
      const checkResult = await checkRequest.query(`
        SELECT TRANSFER_ID FROM AKTBLPTSMAS WHERE TRANSFER_ID = @transferId
      `)

      if (checkResult.recordset.length > 0) {
        console.log(`⚠️ Transfer ID ${transferIdBigInt} zaten kayıtlı, atlanıyor...`)
        await transaction.rollback()
        return {
          success: true,
          skipped: true,
          message: `Paket zaten kayıtlı: ${transferIdBigInt}`,
          data: { transferId: String(transferIdBigInt) }
        }
      }

      // Yeni kayıt
      console.log(`💾 Transfer ID ${transferIdBigInt} kaydediliyor...`)

      // KALEM ve ADET hesapla (sadece SERIAL_NUMBER olanlar = gerçek ürünler)
      const actualProducts = products ? products.filter(p => p.serialNumber) : []
      const uniqueGtins = [...new Set(actualProducts.map(p => p.gtin).filter(g => g))]
      const kalemSayisi = uniqueGtins.length
      const urunAdedi = actualProducts.length

      const insertRequest = new sql.Request(transaction)
      insertRequest.input('transferId', sql.BigInt, transferIdBigInt)
      insertRequest.input('documentNumber', sql.VarChar(25), documentNumber ? documentNumber.substring(0, 25) : null)
      insertRequest.input('documentDate', sql.Date, documentDate ? new Date(documentDate) : null)
      insertRequest.input('sourceGLN', sql.VarChar(15), sourceGLN ? sourceGLN.substring(0, 15) : null)
      insertRequest.input('destinationGLN', sql.VarChar(15), destinationGLN ? destinationGLN.substring(0, 15) : null)
      insertRequest.input('actionType', sql.VarChar(5), actionType ? actionType.substring(0, 5) : null)
      insertRequest.input('shipTo', sql.VarChar(15), shipTo ? shipTo.substring(0, 15) : null)
      insertRequest.input('note', sql.VarChar(100), note ? note.substring(0, 100) : null)
      insertRequest.input('version', sql.VarChar(10), version ? version.substring(0, 10) : null)
      insertRequest.input('kalemSayisi', sql.Int, kalemSayisi)
      insertRequest.input('urunAdedi', sql.Int, urunAdedi)
      insertRequest.input('kayitKullanici', sql.VarChar(35), kayitKullanici || null)

      await insertRequest.query(`
        INSERT INTO AKTBLPTSMAS (
          TRANSFER_ID, DOCUMENT_NUMBER, DOCUMENT_DATE, SOURCE_GLN, DESTINATION_GLN,
          ACTION_TYPE, SHIP_TO, NOTE, VERSION, KALEM_SAYISI, URUN_ADEDI, KAYIT_KULLANICI
        ) VALUES (
          @transferId, @documentNumber, @documentDate, @sourceGLN, @destinationGLN,
          @actionType, @shipTo, @note, @version, @kalemSayisi, @urunAdedi, @kayitKullanici
        )
      `)

      // Ürünleri ve carrier hiyerarşisini kaydet
      if (products && products.length > 0) {
        console.log(`📦 ${products.length} ürün kaydediliyor...`)

        for (const product of products) {
          const productRequest = new sql.Request(transaction)
          productRequest.input('transferId', sql.BigInt, transferIdBigInt)
          productRequest.input('carrierLabel', sql.VarChar(25), product.carrierLabel ? product.carrierLabel.substring(0, 25) : null)
          productRequest.input('parentCarrierLabel', sql.VarChar(25), product.parentCarrierLabel ? product.parentCarrierLabel.substring(0, 25) : null)
          productRequest.input('containerType', sql.VarChar(5), product.containerType ? product.containerType.substring(0, 5) : null)
          productRequest.input('carrierLevel', sql.TinyInt, product.carrierLevel || null)
          productRequest.input('gtin', sql.VarChar(14), product.gtin ? product.gtin.substring(0, 14) : null)
          productRequest.input('serialNumber', sql.VarChar(25), product.serialNumber ? product.serialNumber.substring(0, 25) : null)
          productRequest.input('lotNumber', sql.VarChar(15), product.lotNumber ? product.lotNumber.substring(0, 15) : null)
          productRequest.input('expirationDate', sql.Date, product.expirationDate ? new Date(product.expirationDate) : null)
          productRequest.input('productionDate', sql.Date, product.productionDate ? new Date(product.productionDate) : null)
          productRequest.input('poNumber', sql.VarChar(25), product.poNumber ? product.poNumber.substring(0, 25) : null)

          await productRequest.query(`
            INSERT INTO AKTBLPTSTRA (
              TRANSFER_ID, CARRIER_LABEL, PARENT_CARRIER_LABEL, CONTAINER_TYPE, CARRIER_LEVEL,
              GTIN, SERIAL_NUMBER, LOT_NUMBER, EXPIRATION_DATE,
              PRODUCTION_DATE, PO_NUMBER
            ) VALUES (
              @transferId, @carrierLabel, @parentCarrierLabel, @containerType, @carrierLevel,
              @gtin, @serialNumber, @lotNumber, @expirationDate,
              @productionDate, @poNumber
            )
          `)
        }
      }

      await transaction.commit()

      console.log(`✅ Paket kaydedildi: ${transferIdBigInt} (${products?.length || 0} ürün)`)

      return {
        success: true,
        message: `Paket kaydedildi: ${transferIdBigInt}`,
        data: {
          transferId: String(transferIdBigInt),
          productCount: products?.length || 0
        }
      }

    } catch (error) {
      await transaction.rollback()
      throw error
    }

  } catch (error) {
    console.error('❌ Paket kaydetme hatası:', error)
    return {
      success: false,
      message: 'Paket kaydedilemedi',
      error: error.message
    }
  }
}

/**
 * Transfer ID ile paket verilerini getir (sadece varlık kontrolü için)
 * @param {string} transferId - Transfer ID
 * @param {string} cariGlnColumn - Cari GLN kolon adı (kullanılmıyor, geriye dönük uyumluluk için)
 * @param {string} stockBarcodeColumn - Stok barkod kolon adı (kullanılmıyor, geriye dönük uyumluluk için)
 * @returns {Promise<Object>}
 */
async function getPackageData(transferId, cariGlnColumn = 'TBLCASABIT.EMAIL', stockBarcodeColumn = 'TBLSTSABIT.STOK_KODU') {
  try {
    const ptsPool = await getPTSConnection()

    // Master kayıt kontrolü (NETSIS.AKTBLPTSMAS)
    const masterRequest = ptsPool.request()
    masterRequest.input('transferId', sql.BigInt, BigInt(transferId))
    const masterResult = await masterRequest.query(`
      SELECT * FROM AKTBLPTSMAS WHERE TRANSFER_ID = @transferId
    `)

    if (masterResult.recordset.length === 0) {
      console.log(`❌ Paket bulunamadı: ${transferId}`)
      return {
        success: false,
        message: 'Paket bulunamadı'
      }
    }

    const masterData = masterResult.recordset[0]
    console.log(`✅ Paket bulundu: ${transferId}`)

    // Ürün detaylarını getir - AKTBLITSMESAJ ve TBLSTSABIT ile join (tek sorgu)
    // Database adını config'den al (dinamik)
    const mainDbName = db.mainConfig?.database || process.env.DB_NAME || 'MUHASEBE2025'

    const productsRequest = ptsPool.request()
    productsRequest.input('transferId', sql.BigInt, BigInt(transferId))

    // Tek sorgu: Ürünler + Durum mesajı + Stok adı (cross-database join)
    const productsResult = await productsRequest.query(`
      SELECT 
        p.*,
        m.MESAJ AS DURUM_MESAJI,
        s.STOK_ADI
      FROM AKTBLPTSTRA p WITH (NOLOCK)
      LEFT JOIN AKTBLITSMESAJ m WITH (NOLOCK) ON TRY_CAST(p.BILDIRIM AS INT) = m.ID
      LEFT JOIN ${mainDbName}.dbo.TBLSTSABIT s WITH (NOLOCK) ON '0'+s.STOK_KODU = p.GTIN
      WHERE p.TRANSFER_ID = @transferId
    `)

    console.log(`✅ ${productsResult.recordset.length} ürün bulundu`)

    // MUHASEBE2025 bağlantısı (sadece cari için)
    const mainPool = await getConnection()

    // Cari bilgisini getir (eğer SOURCE_GLN varsa)
    let cariName = null
    if (masterData.SOURCE_GLN) {
      try {
        const cariRequest = mainPool.request()
        cariRequest.input('gln', sql.VarChar, masterData.SOURCE_GLN)
        const cariResult = await cariRequest.query(`
          SELECT CARI_ISIM FROM TBLCASABIT WITH (NOLOCK) WHERE EMAIL = @gln
        `)
        if (cariResult.recordset.length > 0) {
          cariName = fixTurkishChars(cariResult.recordset[0].CARI_ISIM)
        }
      } catch (e) {
        console.warn('⚠️ Cari bilgisi alınamadı:', e.message)
      }
    }

    // Ürünlere Türkçe karakter düzeltmesi uygula
    const enrichedProducts = productsResult.recordset.map(p => {
      return {
        ...p,
        STOK_ADI: p.STOK_ADI ? fixTurkishChars(p.STOK_ADI) : null,
        DURUM_MESAJI: p.DURUM_MESAJI ? fixTurkishChars(p.DURUM_MESAJI) : null
      }
    })

    // GTIN olan ürünleri logla (debug)
    log('🔍 GTIN olan ilk 3 ürün:')
    const productsWithGtin = enrichedProducts.filter(p => p.GTIN)
    productsWithGtin.slice(0, 3).forEach(p => {
      console.log(`  GTIN: ${p.GTIN} -> STOK_ADI: ${p.STOK_ADI || 'NULL'}`)
    })

    // GTIN olmayan ürün sayısı
    const withoutGtin = enrichedProducts.filter(p => !p.GTIN).length
    console.log(`⚠️ GTIN olmayan ürün sayısı: ${withoutGtin}/${enrichedProducts.length}`)

    // Sonucu döndür
    return {
      success: true,
      data: {
        ...masterData,
        SOURCE_GLN_NAME: cariName,
        products: enrichedProducts
      }
    }

  } catch (error) {
    console.error('❌ Paket getirme hatası:', error)
    return {
      success: false,
      message: 'Paket getirilemedi',
      error: error.message
    }
  }
}

/**
 * Tüm paketleri listele (tarih filtreli)
 * @param {Date} startDate - Başlangıç tarihi
 * @param {Date} endDate - Bitiş tarihi
 * @param {String} dateFilterType - Tarih filtresi tipi (created/document)
 * @returns {Promise<Object>}
 */
async function listPackages(startDate, endDate, dateFilterType = 'created') {
  try {
    const totalStartTime = Date.now()

    // NETSIS connection (PTS kayıtları)
    const ptsPool = await getPTSConnection()
    const ptsRequest = ptsPool.request()

    // Tarih filtresi tipine göre sorgu oluştur
    const dateColumn = dateFilterType === 'document' ? 'DOCUMENT_DATE' : 'KAYIT_TARIHI'

    // Database adını config'den al (dinamik)
    const mainDbName = db.mainConfig?.database || process.env.DB_NAME || 'MUHASEBE2025'

    // Cari GLN kolon bilgisini ayarlardan al (cache'den senkron)
    const cariGlnBilgisi = settingsService.getSetting('cariGlnBilgisi') || 'EMAIL'
    const { column: glnColumn } = settingsService.parseColumnInfo(cariGlnBilgisi)

    // OPTİMİZE EDİLMİŞ: KALEM/ADET değerleri AKTBLPTSMAS tablosundan okunuyor
    // Cari ismi doğrudan LEFT JOIN ile geliyor (GLN kolonu ayarlardan)
    let query = `
      SELECT 
        p.*,
        ISNULL(p.KALEM_SAYISI, 0) AS UNIQUE_GTIN_COUNT,
        ISNULL(p.URUN_ADEDI, 0) AS TOTAL_PRODUCT_COUNT,
        c.CARI_ISIM AS SOURCE_GLN_NAME
      FROM AKTBLPTSMAS p WITH (NOLOCK)
      LEFT JOIN ${mainDbName}.dbo.TBLCASABIT c WITH (NOLOCK) ON c.${glnColumn} = p.SOURCE_GLN
    `

    if (startDate && endDate) {
      query += ` WHERE CAST(p.${dateColumn} AS DATE) BETWEEN @startDate AND @endDate`
      ptsRequest.input('startDate', sql.Date, new Date(startDate))
      ptsRequest.input('endDate', sql.Date, new Date(endDate))
    }

    query += ' ORDER BY p.KAYIT_TARIHI DESC'

    log('📋 Paket listesi sorgusu (TEST - kolon bazlı):', { startDate, endDate, dateFilterType, dateColumn })

    const queryStartTime = Date.now()
    const result = await ptsRequest.query(query)
    const queryEndTime = Date.now()

    log(`⏱️ SQL sorgu süresi: ${queryEndTime - queryStartTime}ms`)

    // Paketleri düzenle (Türkçe karakter düzeltme)
    const packages = result.recordset.map(pkg => ({
      ...pkg,
      SOURCE_GLN_NAME: pkg.SOURCE_GLN_NAME ? fixTurkishChars(pkg.SOURCE_GLN_NAME) : null,
      UNIQUE_GTIN_COUNT: pkg.UNIQUE_GTIN_COUNT || 0,
      TOTAL_PRODUCT_COUNT: pkg.TOTAL_PRODUCT_COUNT || 0
    }))

    log(`✅ Paket sayısı: ${packages.length}, Toplam süre: ${Date.now() - totalStartTime}ms`)

    return {
      success: true,
      data: packages
    }

  } catch (error) {
    console.error('❌ Paket listeleme hatası:', error)
    return {
      success: false,
      message: 'Paketler listelenemedi',
      error: error.message
    }
  }
}

/**
 * Carrier label (koli barkodu) ile o carrier ve altındaki tüm ürünleri getir
 * OKUTULAN BARKOD: Koli, Palet, Bağ - herhangi birisi olabilir
 * @param {string} carrierLabel - Carrier (koli/palet/bağ) barkodu
 * @returns {Promise<Object>}
 */
async function getProductsByCarrierLabel(carrierLabel) {
  try {
    const pool = await getPTSConnection()

    // Önce bu barkodun sistemde olup olmadığını kontrol et
    const checkRequest = pool.request()
    checkRequest.input('carrierLabel', sql.VarChar(25), carrierLabel)

    const checkResult = await checkRequest.query(`
      SELECT TOP 1 
        CARRIER_LABEL,
        PARENT_CARRIER_LABEL,
        CONTAINER_TYPE,
        CARRIER_LEVEL,
        TRANSFER_ID
      FROM AKTBLPTSTRA
      WHERE CARRIER_LABEL = @carrierLabel
    `)

    if (checkResult.recordset.length === 0) {
      return {
        success: false,
        message: `Carrier barkodu bulunamadı: ${carrierLabel}`
      }
    }

    const carrierInfo = checkResult.recordset[0]
    console.log(`📦 Carrier bulundu:`, carrierInfo)

    // Recursive CTE ile tüm alt carrier'ları ve ürünleri bul
    const request = pool.request()
    request.input('carrierLabel', sql.VarChar(25), carrierLabel)

    const result = await request.query(`
      WITH CarrierHierarchy AS (
        -- Root: Okutulan carrier (kendisi de dahil)
        SELECT 
          TRANSFER_ID,
          CARRIER_LABEL,
          PARENT_CARRIER_LABEL,
          CONTAINER_TYPE,
          CARRIER_LEVEL,
          GTIN,
          SERIAL_NUMBER,
          LOT_NUMBER,
          EXPIRATION_DATE,
          PRODUCTION_DATE,
          PO_NUMBER,
          0 AS DEPTH,
          CAST(CARRIER_LABEL AS VARCHAR(500)) AS PATH
        FROM AKTBLPTSTRA
        WHERE CARRIER_LABEL = @carrierLabel
        
        UNION ALL
        
        -- Recursive: Alt carrier'lar ve ürünler
        SELECT 
          t.TRANSFER_ID,
          t.CARRIER_LABEL,
          t.PARENT_CARRIER_LABEL,
          t.CONTAINER_TYPE,
          t.CARRIER_LEVEL,
          t.GTIN,
          t.SERIAL_NUMBER,
          t.LOT_NUMBER,
          t.EXPIRATION_DATE,
          t.PRODUCTION_DATE,
          t.PO_NUMBER,
          ch.DEPTH + 1,
          CAST(ch.PATH + ' -> ' + ISNULL(t.CARRIER_LABEL, '[Ürün]') AS VARCHAR(500))
        FROM AKTBLPTSTRA t
        INNER JOIN CarrierHierarchy ch ON t.PARENT_CARRIER_LABEL = ch.CARRIER_LABEL
      )
      SELECT * FROM CarrierHierarchy
      ORDER BY DEPTH, CARRIER_LEVEL
    `)

    // Ürünleri ve carrier'ları ayır
    const allRecords = result.recordset
    const products = allRecords.filter(r => r.SERIAL_NUMBER != null)
    const carriers = allRecords.filter(r => r.SERIAL_NUMBER == null)
    const uniqueCarriers = [...new Set(carriers.map(r => r.CARRIER_LABEL).filter(c => c))]

    console.log(`✅ Bulunan: ${products.length} ürün, ${uniqueCarriers.length} carrier`)

    return {
      success: true,
      data: {
        carrierLabel,
        carrierInfo: {
          containerType: carrierInfo.CONTAINER_TYPE,
          level: carrierInfo.CARRIER_LEVEL,
          parentCarrierLabel: carrierInfo.PARENT_CARRIER_LABEL,
          transferId: carrierInfo.TRANSFER_ID
        },
        totalProducts: products.length,
        totalCarriers: uniqueCarriers.length,
        allRecords: allRecords,  // Tüm kayıtlar (carrier + ürün)
        products: products,       // Sadece ürünler
        carriers: carriers,       // Sadece carrier'lar
        carrierTree: buildCarrierTree(allRecords)
      }
    }

  } catch (error) {
    console.error('❌ Carrier ürün getirme hatası:', error)
    return {
      success: false,
      message: 'Carrier ürünleri getirilemedi',
      error: error.message
    }
  }
}

/**
 * Carrier hiyerarşisini ağaç yapısına dönüştür
 * Şimdi carrier'ların kendisi için ayrı kayıtlar var
 */
function buildCarrierTree(records) {
  const carrierMap = {}
  const rootCarriers = []

  // 1. Önce tüm carrier'ları oluştur (SERIAL_NUMBER NULL olanlar)
  records.forEach(record => {
    if (record.CARRIER_LABEL && !record.SERIAL_NUMBER) {
      if (!carrierMap[record.CARRIER_LABEL]) {
        carrierMap[record.CARRIER_LABEL] = {
          carrierLabel: record.CARRIER_LABEL,
          parentCarrierLabel: record.PARENT_CARRIER_LABEL,
          containerType: record.CONTAINER_TYPE,
          level: record.CARRIER_LEVEL,
          transferId: record.TRANSFER_ID,
          products: [],
          children: []
        }
      }
    }
  })

  // 2. Ürünleri ilgili carrier'lara ekle (SERIAL_NUMBER olan kayıtlar)
  records.forEach(record => {
    if (record.CARRIER_LABEL && record.SERIAL_NUMBER) {
      if (!carrierMap[record.CARRIER_LABEL]) {
        // Eğer bu carrier için kayıt yoksa oluştur (eski veriler için)
        carrierMap[record.CARRIER_LABEL] = {
          carrierLabel: record.CARRIER_LABEL,
          parentCarrierLabel: record.PARENT_CARRIER_LABEL,
          containerType: record.CONTAINER_TYPE,
          level: record.CARRIER_LEVEL,
          transferId: record.TRANSFER_ID,
          products: [],
          children: []
        }
      }

      carrierMap[record.CARRIER_LABEL].products.push({
        gtin: record.GTIN,
        serialNumber: record.SERIAL_NUMBER,
        lotNumber: record.LOT_NUMBER,
        expirationDate: record.EXPIRATION_DATE,
        productionDate: record.PRODUCTION_DATE
      })
    }
  })

  // 3. Parent-child ilişkilerini kur
  Object.values(carrierMap).forEach(carrier => {
    if (carrier.parentCarrierLabel && carrierMap[carrier.parentCarrierLabel]) {
      carrierMap[carrier.parentCarrierLabel].children.push(carrier)
    } else {
      rootCarriers.push(carrier)
    }
  })

  return rootCarriers
}

/**
 * Transfer ID ve carrier label ile ilgili tüm bilgileri getir
 * @param {string} transferId - Transfer ID
 * @param {string} carrierLabel - Carrier label
 * @returns {Promise<Object>}
 */
async function getCarrierDetails(transferId, carrierLabel) {
  try {
    const pool = await getPTSConnection()

    const request = pool.request()
    request.input('transferId', sql.BigInt, BigInt(transferId))
    request.input('carrierLabel', sql.VarChar(25), carrierLabel)

    const result = await request.query(`
      WITH CarrierHierarchy AS (
        SELECT 
          TRANSFER_ID,
          CARRIER_LABEL,
          PARENT_CARRIER_LABEL,
          CONTAINER_TYPE,
          CARRIER_LEVEL,
          GTIN,
          SERIAL_NUMBER,
          LOT_NUMBER,
          EXPIRATION_DATE,
          PRODUCTION_DATE,
          PO_NUMBER,
          0 AS DEPTH
        FROM AKTBLPTSTRA
        WHERE TRANSFER_ID = @transferId AND CARRIER_LABEL = @carrierLabel
        
        UNION ALL
        
        SELECT 
          t.TRANSFER_ID,
          t.CARRIER_LABEL,
          t.PARENT_CARRIER_LABEL,
          t.CONTAINER_TYPE,
          t.CARRIER_LEVEL,
          t.GTIN,
          t.SERIAL_NUMBER,
          t.LOT_NUMBER,
          t.EXPIRATION_DATE,
          t.PRODUCTION_DATE,
          t.PO_NUMBER,
          ch.DEPTH + 1
        FROM AKTBLPTSTRA t
        INNER JOIN CarrierHierarchy ch ON t.PARENT_CARRIER_LABEL = ch.CARRIER_LABEL
          AND t.TRANSFER_ID = @transferId
      )
      SELECT * FROM CarrierHierarchy
      ORDER BY DEPTH, CARRIER_LEVEL
    `)

    return {
      success: true,
      data: result.recordset
    }

  } catch (error) {
    console.error('❌ Carrier detay getirme hatası:', error)
    return {
      success: false,
      message: 'Carrier detayları getirilemedi',
      error: error.message
    }
  }
}

/**
 * Tüm PTS transferlerini getir
 */
export async function getAllTransfers() {
  try {
    const pool = await getPTSConnection()

    const query = `
      SELECT 
        TRANSFER_ID,
        GONDERICI_GLN,
        ALICI_GLN,
        DURUM,
        KAYIT_TARIHI,
        GUNCELLEME_TARIHI
      FROM AKTBLPTSMAS WITH (NOLOCK)
      ORDER BY KAYIT_TARIHI DESC
    `

    const result = await pool.request().query(query)

    return result.recordset.map(row => ({
      TRANSFER_ID: row.TRANSFER_ID,
      GONDERICI_GLN: row.GONDERICI_GLN,
      ALICI_GLN: row.ALICI_GLN,
      BILDIRIM: row.BILDIRIM,
      KAYIT_TARIHI: row.KAYIT_TARIHI,
      GUNCELLEME_TARIHI: row.GUNCELLEME_TARIHI
    }))

  } catch (error) {
    console.error('❌ Transfer listesi getirme hatası:', error)
    throw error
  }
}

/**
 * Koli barkodundan hiyerarşik olarak tüm ürünleri getir
 * @param {string} carrierLabel - Koli barkodu
 * @param {Array<string>} stockCodes - Belgedeki stok kodları (filtre için)
 * @returns {Promise<Object>}
 */
async function getCarrierProductsRecursive(carrierLabel, stockCodes = []) {
  try {
    const pool = await getPTSConnection()
    const totalStartTime = Date.now()

    // GTIN'leri temizle (leading zeros kaldır) ve SQL için hazırla
    const cleanStockCodes = stockCodes.map(code => code.replace(/^0+/, ''))
    console.log(`📋 Belgede ${cleanStockCodes.length} GTIN:`, cleanStockCodes.slice(0, 5), cleanStockCodes.length > 5 ? '...' : '')

    // GTIN'lerin hem temizlenmiş hem orijinal (başında 0 ile) hallerini oluştur
    const allGtinVariants = []
    cleanStockCodes.forEach(gtin => {
      allGtinVariants.push(gtin)
      allGtinVariants.push('0' + gtin) // 13 haneli -> 14 haneli
    })

    // GTIN listesini SQL için string olarak oluştur (SQL injection korumalı - sadece sayı)
    const gtinList = allGtinVariants
      .filter(g => /^\d+$/.test(g)) // Sadece sayısal değerler
      .map(g => `'${g}'`)
      .join(',')

    if (!gtinList) {
      return {
        success: false,
        error: 'Geçerli GTIN bulunamadı'
      }
    }

    // Önce bu koli barkoduna + belgedeki GTIN'lere ait en büyük TRANSFER_ID'yi bul
    const startTime = Date.now()

    // GTIN filtresi ile MAX TRANSFER_ID - çok daha hızlı!
    const maxTransferIdQuery = `
      SELECT TOP 1 TRANSFER_ID AS MAX_TRANSFER_ID
      FROM AKTBLPTSTRA WITH (NOLOCK)
      WHERE CARRIER_LABEL = @carrierLabel
        AND GTIN IN (${gtinList})
      ORDER BY TRANSFER_ID DESC
    `

    const maxTransferIdRequest = pool.request()
    maxTransferIdRequest.input('carrierLabel', sql.VarChar(25), carrierLabel)
    const maxTransferIdResult = await maxTransferIdRequest.query(maxTransferIdQuery)

    console.log(`⏱️ MAX TRANSFER_ID sorgusu (GTIN filtreli): ${Date.now() - startTime}ms`)

    if (maxTransferIdResult.recordset.length === 0 || !maxTransferIdResult.recordset[0].MAX_TRANSFER_ID) {
      return {
        success: false,
        error: `Koli barkodu bulunamadı veya belgede olmayan ürünler: ${carrierLabel}`
      }
    }

    const maxTransferId = maxTransferIdResult.recordset[0].MAX_TRANSFER_ID
    console.log(`📦 Koli ${carrierLabel} için TRANSFER_ID: ${maxTransferId}`)

    // Direkt sorgu ile ürünleri getir (CTE yerine basit sorgu - GTIN filtreli)
    const cteStartTime = Date.now()

    const query = `
      SELECT 
        TRANSFER_ID, CARRIER_LABEL, PARENT_CARRIER_LABEL, 
        CONTAINER_TYPE, CARRIER_LEVEL, GTIN, SERIAL_NUMBER, 
        LOT_NUMBER, EXPIRATION_DATE, PRODUCTION_DATE, PO_NUMBER
      FROM AKTBLPTSTRA WITH (NOLOCK)
      WHERE TRANSFER_ID = @maxTransferId
        AND GTIN IN (${gtinList})
        AND (CARRIER_LABEL = @carrierLabel OR PARENT_CARRIER_LABEL = @carrierLabel)
      ORDER BY CARRIER_LEVEL, GTIN, SERIAL_NUMBER
    `

    const request = pool.request()
    request.input('carrierLabel', sql.VarChar(25), carrierLabel)
    request.input('maxTransferId', sql.BigInt, maxTransferId)

    const result = await request.query(query)

    console.log(`⏱️ Ürün sorgusu (GTIN filtreli): ${Date.now() - cteStartTime}ms`)
    console.log(`📦 Koli ${carrierLabel} için ${result.recordset.length} kayıt bulundu`)
    console.log(`⏱️ TOPLAM SÜRE: ${Date.now() - totalStartTime}ms`)

    // Sadece ürünleri filtrele (SERIAL_NUMBER olan kayıtlar)
    const products = result.recordset.filter(r => r.SERIAL_NUMBER)

    return {
      success: true,
      data: {
        allRecords: result.recordset,
        products: products,
        totalCount: result.recordset.length,
        productCount: products.length
      }
    }
  } catch (error) {
    console.error('❌ Koli ürünleri getirme hatası:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export {
  savePackageData,
  getPackageData,
  listPackages,
  getProductsByCarrierLabel,
  getCarrierDetails,
  getCarrierProductsRecursive
}

