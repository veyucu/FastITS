import { getPTSConnection, getConnection } from '../config/database.js'
import sql from 'mssql'
import iconv from 'iconv-lite'
import { log } from '../utils/logger.js'

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
 * Tabloları oluştur (ilk çalıştırmada) - Optimize edilmiş yapı
 * TRANSFER_ID: BIGINT PRIMARY KEY (eskiden NVARCHAR + ayrı ID)
 */
async function createTablesIfNotExists() {
  try {
    const pool = await getPTSConnection()
    
    // Master tablo kontrolü ve oluşturma
    const checkMasterTable = await pool.request().query(`
      SELECT * FROM sys.objects 
      WHERE object_id = OBJECT_ID(N'AKTBLPTSMAS') AND type in (N'U')
    `)
    
    if (checkMasterTable.recordset.length === 0) {
      log('📋 AKTBLPTSMAS tablosu oluşturuluyor (optimize edilmiş)...')
      await pool.request().query(`
        CREATE TABLE AKTBLPTSMAS (
          TRANSFER_ID BIGINT NOT NULL PRIMARY KEY,
          DOCUMENT_NUMBER VARCHAR(30) NULL,
          DOCUMENT_DATE DATE NULL,
          SOURCE_GLN VARCHAR(15) NULL,
          DESTINATION_GLN VARCHAR(15) NULL,
          ACTION_TYPE VARCHAR(10) NULL,
          SHIP_TO VARCHAR(15) NULL,
          NOTE VARCHAR(500) NULL,
          VERSION VARCHAR(10) NULL,
          DURUM VARCHAR(20) NULL,
          BILDIRIM_TARIHI DATETIME NULL,
          CREATED_DATE DATETIME DEFAULT GETDATE(),
          UPDATED_DATE DATETIME NULL
        )
      `)
      
      await pool.request().query(`
        CREATE INDEX IX_AKTBLPTSMAS_DOCUMENT_DATE ON AKTBLPTSMAS(DOCUMENT_DATE)
      `)
      await pool.request().query(`
        CREATE INDEX IX_AKTBLPTSMAS_SOURCE_GLN ON AKTBLPTSMAS(SOURCE_GLN)
      `)
      await pool.request().query(`
        CREATE INDEX IX_AKTBLPTSMAS_BILDIRIM_TARIHI ON AKTBLPTSMAS(BILDIRIM_TARIHI)
      `)
      await pool.request().query(`
        CREATE INDEX IX_AKTBLPTSMAS_CREATED_DATE ON AKTBLPTSMAS(CREATED_DATE)
      `)
      
      log('✅ AKTBLPTSMAS tablosu oluşturuldu')
    } else {
      log('✅ AKTBLPTSMAS tablosu mevcut')
    }
    
    // Transaction tablo kontrolü ve oluşturma
    const checkTransTable = await pool.request().query(`
      SELECT * FROM sys.objects 
      WHERE object_id = OBJECT_ID(N'AKTBLPTSTRA') AND type in (N'U')
    `)
    
    if (checkTransTable.recordset.length === 0) {
      log('📋 AKTBLPTSTRA tablosu oluşturuluyor (optimize edilmiş)...')
      await pool.request().query(`
        CREATE TABLE AKTBLPTSTRA (
          TRANSFER_ID BIGINT NOT NULL,
          CARRIER_LABEL VARCHAR(30) NULL,
          PARENT_CARRIER_LABEL VARCHAR(30) NULL,
          CONTAINER_TYPE VARCHAR(5) NULL,
          CARRIER_LEVEL TINYINT NULL,
          GTIN VARCHAR(14) NULL,
          SERIAL_NUMBER VARCHAR(25) NULL,
          LOT_NUMBER VARCHAR(25) NULL,
          EXPIRATION_DATE DATE NULL,
          PRODUCTION_DATE DATE NULL,
          PO_NUMBER VARCHAR(30) NULL,
          DURUM VARCHAR(20) NULL,
          BILDIRIM_TARIHI DATETIME NULL,
          CREATED_DATE DATETIME DEFAULT GETDATE(),
          CONSTRAINT FK_AKTBLPTSTRA_TRANSFER_ID FOREIGN KEY (TRANSFER_ID) REFERENCES AKTBLPTSMAS(TRANSFER_ID) ON DELETE CASCADE
        )
      `)
      
      await pool.request().query(`
        CREATE CLUSTERED INDEX IX_AKTBLPTSTRA_TRANSFER_ID ON AKTBLPTSTRA(TRANSFER_ID)
      `)
      await pool.request().query(`
        CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_CARRIER_LABEL ON AKTBLPTSTRA(CARRIER_LABEL) INCLUDE (TRANSFER_ID, GTIN, SERIAL_NUMBER)
      `)
      await pool.request().query(`
        CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_GTIN ON AKTBLPTSTRA(GTIN) INCLUDE (TRANSFER_ID, SERIAL_NUMBER, EXPIRATION_DATE)
      `)
      await pool.request().query(`
        CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_SERIAL_NUMBER ON AKTBLPTSTRA(SERIAL_NUMBER) INCLUDE (TRANSFER_ID, GTIN)
      `)
      await pool.request().query(`
        CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_EXPIRATION_DATE ON AKTBLPTSTRA(EXPIRATION_DATE) INCLUDE (TRANSFER_ID, GTIN)
      `)
      
      log('✅ AKTBLPTSTRA tablosu oluşturuldu')
    } else {
      log('✅ AKTBLPTSTRA tablosu mevcut')
      
      // Yeni kolonları ekle (mevcut tabloya)
      try {
        // PARENT_CARRIER_LABEL kolonu var mı kontrol et
        const checkParentCol = await pool.request().query(`
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID('AKTBLPTSTRA') AND name = 'PARENT_CARRIER_LABEL'
        `)
        
        if (checkParentCol.recordset.length === 0) {
          log('📝 PARENT_CARRIER_LABEL kolonu ekleniyor...')
          await pool.request().query(`ALTER TABLE AKTBLPTSTRA ADD PARENT_CARRIER_LABEL NVARCHAR(100) NULL`)
          await pool.request().query(`CREATE INDEX IX_AKTBLPTSTRA_PARENT_CARRIER_LABEL ON AKTBLPTSTRA(PARENT_CARRIER_LABEL)`)
          log('✅ PARENT_CARRIER_LABEL kolonu eklendi')
        }
        
        // CARRIER_LEVEL kolonu var mı kontrol et
        const checkLevelCol = await pool.request().query(`
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID('AKTBLPTSTRA') AND name = 'CARRIER_LEVEL'
        `)
        
        if (checkLevelCol.recordset.length === 0) {
          log('📝 CARRIER_LEVEL kolonu ekleniyor...')
          await pool.request().query(`ALTER TABLE AKTBLPTSTRA ADD CARRIER_LEVEL INT NULL`)
          log('✅ CARRIER_LEVEL kolonu eklendi')
        }
        
        // CARRIER_LABEL index'i var mı kontrol et
        const checkCarrierIndex = await pool.request().query(`
          SELECT * FROM sys.indexes 
          WHERE name = 'IX_AKTBLPTSTRA_CARRIER_LABEL' AND object_id = OBJECT_ID('AKTBLPTSTRA')
        `)
        
        if (checkCarrierIndex.recordset.length === 0) {
          log('📝 CARRIER_LABEL index\'i ekleniyor...')
          await pool.request().query(`CREATE INDEX IX_AKTBLPTSTRA_CARRIER_LABEL ON AKTBLPTSTRA(CARRIER_LABEL)`)
          log('✅ CARRIER_LABEL index\'i eklendi')
        }
        
        // ÖNEMLİ: SERIAL_NUMBER NULL kabul etmeli (carrier kayıtları için)
        const checkSerialNull = await pool.request().query(`
          SELECT IS_NULLABLE 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'AKTBLPTSTRA' AND COLUMN_NAME = 'SERIAL_NUMBER'
        `)
        
        if (checkSerialNull.recordset.length > 0 && checkSerialNull.recordset[0].IS_NULLABLE === 'NO') {
          log('📝 SERIAL_NUMBER kolonu NULL kabul edecek şekilde güncelleniyor...')
          await pool.request().query(`
            ALTER TABLE AKTBLPTSTRA
            ALTER COLUMN SERIAL_NUMBER NVARCHAR(100) NULL
          `)
          log('✅ SERIAL_NUMBER artık NULL kabul ediyor (carrier kayıtları için)')
        }
        
        log('✅ Tablo yapısı hiyerarşik yapıya güncellendi')
        
        // TRANSFER_ID tipi kontrol - artık BIGINT olmalı (optimize edilmiş yapı)
        log('🔄 TRANSFER_ID tipi kontrol ediliyor...')
        try {
          const checkTransferIdType = await pool.request().query(`
            SELECT DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'AKTBLPTSMAS' 
            AND COLUMN_NAME = 'TRANSFER_ID'
          `)
          
          if (checkTransferIdType.recordset[0]?.DATA_TYPE === 'bigint') {
            log('✅ TRANSFER_ID zaten BIGINT tipinde (optimize edilmiş)')
          } else {
            log('⚠️ TRANSFER_ID henüz BIGINT değil. Migration script\'ini çalıştırın: windows-backend/migrations/optimize_pts_tables.sql')
          }
        } catch (transferIdError) {
          log('⚠️ TRANSFER_ID tip kontrolü hatası:', transferIdError.message)
        }
        
        // DURUM ve BILDIRIM_TARIHI kolonlarını ekle
        log('🔄 DURUM ve BILDIRIM_TARIHI kolonları kontrol ediliyor...')
        try {
          // AKTBLPTSMAS için DURUM kolonu
          const checkDurumMas = await pool.request().query(`
            SELECT * FROM sys.columns 
            WHERE object_id = OBJECT_ID('AKTBLPTSMAS') AND name = 'DURUM'
          `)
          
          if (checkDurumMas.recordset.length === 0) {
            log('📝 AKTBLPTSMAS tablosuna DURUM kolonu ekleniyor...')
            await pool.request().query(`ALTER TABLE AKTBLPTSMAS ADD DURUM VARCHAR(20) NULL`)
            log('✅ AKTBLPTSMAS.DURUM kolonu eklendi')
          }
          
          // AKTBLPTSMAS için BILDIRIM_TARIHI kolonu
          const checkBildirimMas = await pool.request().query(`
            SELECT * FROM sys.columns 
            WHERE object_id = OBJECT_ID('AKTBLPTSMAS') AND name = 'BILDIRIM_TARIHI'
          `)
          
          if (checkBildirimMas.recordset.length === 0) {
            log('📝 AKTBLPTSMAS tablosuna BILDIRIM_TARIHI kolonu ekleniyor...')
            await pool.request().query(`ALTER TABLE AKTBLPTSMAS ADD BILDIRIM_TARIHI DATETIME NULL`)
            log('✅ AKTBLPTSMAS.BILDIRIM_TARIHI kolonu eklendi')
          }
          
          // AKTBLPTSTRA için DURUM kolonu
          const checkDurumTra = await pool.request().query(`
            SELECT * FROM sys.columns 
            WHERE object_id = OBJECT_ID('AKTBLPTSTRA') AND name = 'DURUM'
          `)
          
          if (checkDurumTra.recordset.length === 0) {
            log('📝 AKTBLPTSTRA tablosuna DURUM kolonu ekleniyor...')
            await pool.request().query(`ALTER TABLE AKTBLPTSTRA ADD DURUM VARCHAR(20) NULL`)
            log('✅ AKTBLPTSTRA.DURUM kolonu eklendi')
          }
          
          // AKTBLPTSTRA için BILDIRIM_TARIHI kolonu
          const checkBildirimTra = await pool.request().query(`
            SELECT * FROM sys.columns 
            WHERE object_id = OBJECT_ID('AKTBLPTSTRA') AND name = 'BILDIRIM_TARIHI'
          `)
          
          if (checkBildirimTra.recordset.length === 0) {
            log('📝 AKTBLPTSTRA tablosuna BILDIRIM_TARIHI kolonu ekleniyor...')
            await pool.request().query(`ALTER TABLE AKTBLPTSTRA ADD BILDIRIM_TARIHI DATETIME NULL`)
            log('✅ AKTBLPTSTRA.BILDIRIM_TARIHI kolonu eklendi')
          }
          
          log('✅ DURUM ve BILDIRIM_TARIHI kolonları hazır')
        } catch (durumError) {
          log('⚠️ DURUM/BILDIRIM_TARIHI kolon ekleme hatası:', durumError.message)
        }
      } catch (alterError) {
        log('⚠️ Tablo güncelleme hatası (devam ediliyor):', alterError.message)
      }
    }
    
    return { success: true }
  } catch (error) {
    console.error('❌ Tablo oluşturma hatası:', error)
    return { success: false, error: error.message }
  }
}

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
              actionType, shipTo, note, version, products, _rawXML } = packageData
      
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
      
      await insertRequest.query(`
        INSERT INTO AKTBLPTSMAS (
          TRANSFER_ID, DOCUMENT_NUMBER, DOCUMENT_DATE, SOURCE_GLN, DESTINATION_GLN,
          ACTION_TYPE, SHIP_TO, NOTE, VERSION
        ) VALUES (
          @transferId, @documentNumber, @documentDate, @sourceGLN, @destinationGLN,
          @actionType, @shipTo, @note, @version
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
    
    // Ürün detaylarını getir (NETSIS.AKTBLPTSTRA)
    const productsRequest = ptsPool.request()
    productsRequest.input('transferId', sql.BigInt, BigInt(transferId))
    const productsResult = await productsRequest.query(`
      SELECT * FROM AKTBLPTSTRA WHERE TRANSFER_ID = @transferId
    `)
    
    console.log(`✅ ${productsResult.recordset.length} ürün bulundu`)
    
    // MUHASEBE2025 bağlantısı
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
    
    // Stok bilgilerini getir (GTIN'lere göre)
    // GTIN'lerden baştaki sıfırları kırp
    const uniqueGtins = [...new Set(productsResult.recordset.map(p => {
      if (!p.GTIN) return null
      // Başındaki sıfırları kaldır
      return p.GTIN.replace(/^0+/, '') || '0'
    }).filter(g => g))]
    
    let stockMap = {}
    
    if (uniqueGtins.length > 0) {
      try {
        // stockBarcodeColumn parametresini parse et (örn: "TBLSTSABIT.STOK_KODU" -> "STOK_KODU")
        const rawStockColumn = stockBarcodeColumn.includes('.') 
          ? stockBarcodeColumn.split('.')[1] 
          : stockBarcodeColumn
        
        // SQL Injection koruması - sadece izin verilen kolon adları
        const ALLOWED_STOCK_COLUMNS = ['STOK_KODU', 'GTIN', 'BARKOD', 'STOK_ADI', 'KOD_1', 'KOD_2', 'KOD_3', 'KOD_4', 'KOD_5']
        const stockColumn = ALLOWED_STOCK_COLUMNS.includes(rawStockColumn) ? rawStockColumn : 'STOK_KODU'
        
        console.log(`📦 Stok bilgisi aranacak kolon: ${stockColumn}`)
        console.log(`📦 Temizlenmiş GTIN örnekleri:`, uniqueGtins.slice(0, 3))
        
        const stockRequest = mainPool.request()
        const gtinPlaceholders = uniqueGtins.map((_, i) => `@gtin${i}`).join(',')
        uniqueGtins.forEach((gtin, i) => {
          stockRequest.input(`gtin${i}`, sql.VarChar, gtin)
        })
        
        const stockQuery = `
          SELECT ${stockColumn}, STOK_ADI,STOK_KODU
          FROM TBLSTSABIT WITH (NOLOCK)
          WHERE ${stockColumn} IN (${gtinPlaceholders})
        `
        const stockResult = await stockRequest.query(stockQuery)
        
        console.log(`✅ ${stockResult.recordset.length} stok bilgisi bulundu`)
        
        // İlk birkaç sonucu logla (debug)
        log('📦 TBLSTSABIT\'ten dönen ilk 3 kayıt:')
        stockResult.recordset.slice(0, 3).forEach(s => {
          console.log(`  ${stockColumn}: ${s[stockColumn]} -> STOK_ADI: ${s.STOK_ADI}`)
        })
        
        // Map oluştur: Temizlenmiş GTIN -> STOK_ADI
        stockResult.recordset.forEach(s => {
          // STOK_KODU virgülle ayrılmışsa ilk kısmı al (örn: "8699832090093,8699832090093" -> "8699832090093")
          const rawKey = s[stockColumn]
          const key = rawKey ? rawKey.toString().split(',')[0].trim() : null
          
          if (key) {
            stockMap[key] = {
              STOK_ADI: fixTurkishChars(s.STOK_ADI)
            }
          }
        })
        
        // stockMap içeriğini logla
        log('📦 stockMap anahtarları:', Object.keys(stockMap).slice(0, 3))
      } catch (e) {
        console.warn('⚠️ Stok bilgileri alınamadı:', e.message)
      }
    }
    
    // Ürünlere stok bilgilerini ekle
    const enrichedProducts = productsResult.recordset.map(p => {
      // GTIN'i temizle (baştaki sıfırları kaldır)
      const cleanGtin = p.GTIN ? p.GTIN.replace(/^0+/, '') || '0' : null
      const stockInfo = stockMap[cleanGtin]
      
      return {
        ...p,
        STOK_ADI: stockInfo?.STOK_ADI || null,
        STOK_KODU: stockInfo?.STOK_KODU || null,
        CLEAN_GTIN: cleanGtin // Debug için
      }
    })
    
    // GTIN olan ürünleri logla (debug)
    log('🔍 GTIN olan ilk 3 ürün:')
    const productsWithGtin = enrichedProducts.filter(p => p.GTIN)
    productsWithGtin.slice(0, 3).forEach(p => {
      console.log(`  GTIN: ${p.GTIN} -> Clean: ${p.CLEAN_GTIN} -> STOK_ADI: ${p.STOK_ADI || 'NULL'}`)
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
    // NETSIS connection (PTS kayıtları)
    const ptsPool = await getPTSConnection()
    const ptsRequest = ptsPool.request()
    
    // Tarih filtresi tipine göre sorgu oluştur
    const dateColumn = dateFilterType === 'document' ? 'DOCUMENT_DATE' : 'CREATED_DATE'
    
    // NETSIS'ten PTS kayıtlarını ve ürün istatistiklerini al
    let query = `
      SELECT 
        p.*,
        ISNULL(stats.UNIQUE_GTIN_COUNT, 0) AS UNIQUE_GTIN_COUNT,
        ISNULL(stats.TOTAL_PRODUCT_COUNT, 0) AS TOTAL_PRODUCT_COUNT
      FROM AKTBLPTSMAS p
      LEFT JOIN (
        SELECT 
          TRANSFER_ID,
          COUNT(DISTINCT GTIN) AS UNIQUE_GTIN_COUNT,
          COUNT(*) AS TOTAL_PRODUCT_COUNT
        FROM AKTBLPTSTRA WITH (NOLOCK)
        WHERE SERIAL_NUMBER IS NOT NULL
        GROUP BY TRANSFER_ID
      ) stats ON stats.TRANSFER_ID = p.TRANSFER_ID
    `
    
    if (startDate && endDate) {
      query += ` WHERE CAST(p.${dateColumn} AS DATE) BETWEEN @startDate AND @endDate`
      ptsRequest.input('startDate', sql.Date, new Date(startDate))
      ptsRequest.input('endDate', sql.Date, new Date(endDate))
    }
    
    query += ' ORDER BY p.CREATED_DATE DESC'
    
    log('📋 Paket listesi sorgusu:', { startDate, endDate, dateFilterType, dateColumn })
    
    const result = await ptsRequest.query(query)
    
    // MUHASEBE2025 connection için cari bilgilerini alalım
    const mainPool = await getConnection()
    
    // SOURCE_GLN'leri topla ve benzersiz olanları al
    const uniqueGlns = [...new Set(result.recordset.map(p => p.SOURCE_GLN).filter(g => g))]
    
    // Cari bilgilerini toplu halde getir (daha performanslı)
    let cariMap = {}
    if (uniqueGlns.length > 0) {
      const cariRequest = mainPool.request()
      const glnPlaceholder = uniqueGlns.map((_, i) => `@gln${i}`).join(',')
      uniqueGlns.forEach((gln, i) => {
        cariRequest.input(`gln${i}`, sql.VarChar, gln)
      })
      
      const cariQuery = `
        SELECT EMAIL, CARI_ISIM 
        FROM TBLCASABIT WITH (NOLOCK) 
        WHERE EMAIL IN (${glnPlaceholder})
      `
      const cariResult = await cariRequest.query(cariQuery)
      
      // Map oluştur: GLN -> CARI_ISIM
      cariResult.recordset.forEach(c => {
        cariMap[c.EMAIL] = fixTurkishChars(c.CARI_ISIM)
      })
    }
    
    // Paketlere cari isimlerini ekle
    const packages = result.recordset.map(pkg => ({
      ...pkg,
      SOURCE_GLN_NAME: cariMap[pkg.SOURCE_GLN] || null,
      UNIQUE_GTIN_COUNT: pkg.UNIQUE_GTIN_COUNT || 0,
      TOTAL_PRODUCT_COUNT: pkg.TOTAL_PRODUCT_COUNT || 0
    }))
    
    log('✅ Paket sayısı:', packages.length)
    
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
      DURUM: row.DURUM,
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
    
    // Önce bu koli barkoduna ait en büyük TRANSFER_ID'yi bul
    const maxTransferIdQuery = `
      SELECT MAX(TRANSFER_ID) AS MAX_TRANSFER_ID
      FROM AKTBLPTSTRA
      WHERE CARRIER_LABEL = @carrierLabel
    `
    
    const maxTransferIdRequest = pool.request()
    maxTransferIdRequest.input('carrierLabel', sql.VarChar(25), carrierLabel)
    const maxTransferIdResult = await maxTransferIdRequest.query(maxTransferIdQuery)
    
    if (maxTransferIdResult.recordset.length === 0 || !maxTransferIdResult.recordset[0].MAX_TRANSFER_ID) {
      return {
        success: false,
        error: `Koli barkodu bulunamadı: ${carrierLabel}`
      }
    }
    
    const maxTransferId = maxTransferIdResult.recordset[0].MAX_TRANSFER_ID
    console.log(`📦 Koli ${carrierLabel} için en büyük TRANSFER_ID: ${maxTransferId}`)
    
    // Recursive CTE ile tüm alt kolileri ve ürünleri bul (sadece en büyük TRANSFER_ID için)
    const query = `
      WITH CarrierHierarchy AS (
        -- Ana koli (en büyük TRANSFER_ID ile)
        SELECT 
          TRANSFER_ID, CARRIER_LABEL, PARENT_CARRIER_LABEL, 
          CONTAINER_TYPE, CARRIER_LEVEL, GTIN, SERIAL_NUMBER, 
          LOT_NUMBER, EXPIRATION_DATE, PRODUCTION_DATE, PO_NUMBER
        FROM AKTBLPTSTRA
        WHERE CARRIER_LABEL = @carrierLabel
          AND TRANSFER_ID = @maxTransferId
        
        UNION ALL
        
        -- Alt koliler (recursive) - aynı TRANSFER_ID ile
        SELECT 
          c.TRANSFER_ID, c.CARRIER_LABEL, c.PARENT_CARRIER_LABEL,
          c.CONTAINER_TYPE, c.CARRIER_LEVEL, c.GTIN, c.SERIAL_NUMBER,
          c.LOT_NUMBER, c.EXPIRATION_DATE, c.PRODUCTION_DATE, c.PO_NUMBER
        FROM AKTBLPTSTRA c
        INNER JOIN CarrierHierarchy ch ON c.PARENT_CARRIER_LABEL = ch.CARRIER_LABEL
          AND c.TRANSFER_ID = @maxTransferId
      )
      SELECT * FROM CarrierHierarchy
      ORDER BY CARRIER_LEVEL, GTIN, SERIAL_NUMBER
    `
    
    const request = pool.request()
    request.input('carrierLabel', sql.VarChar(25), carrierLabel)
    request.input('maxTransferId', sql.BigInt, maxTransferId)
    
    const result = await request.query(query)
    
    console.log(`📦 Koli ${carrierLabel} için toplam ${result.recordset.length} kayıt bulundu`)
    
    // GTIN'leri temizle (leading zeros'ları kırp) ve stockCodes ile karşılaştır
    const cleanStockCodes = stockCodes.map(code => code.replace(/^0+/, ''))
    console.log(`📋 Temizlenmiş stok kodları:`, cleanStockCodes)
    
    // GTIN kontrolü ile filtrele
    const filteredRecords = result.recordset.filter(r => {
      if (!r.GTIN) return false
      const cleanGtin = r.GTIN.replace(/^0+/, '')
      return cleanStockCodes.includes(cleanGtin)
    })
    
    console.log(`📦 GTIN eşleşmesi sonrası ${filteredRecords.length} kayıt kaldı`)
    
    // Sadece ürünleri filtrele (SERIAL_NUMBER olan kayıtlar)
    const products = filteredRecords.filter(r => r.SERIAL_NUMBER)
    
    return {
      success: true,
      data: {
        allRecords: filteredRecords,
        products: products,
        totalCount: filteredRecords.length,
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
  createTablesIfNotExists,
  savePackageData,
  getPackageData,
  listPackages,
  getProductsByCarrierLabel,
  getCarrierDetails,
  getCarrierProductsRecursive
}

