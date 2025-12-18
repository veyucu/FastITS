import { getPTSConnection } from '../config/database.js'
import sql from 'mssql'
import iconv from 'iconv-lite'

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
 * Tabloları oluştur (ilk çalıştırmada)
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
      console.log('📋 AKTBLPTSMAS tablosu oluşturuluyor...')
      await pool.request().query(`
        CREATE TABLE AKTBLPTSMAS (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          TRANSFER_ID NVARCHAR(50) NOT NULL,
          DOCUMENT_NUMBER NVARCHAR(50) NULL,
          DOCUMENT_DATE DATE NULL,
          SOURCE_GLN NVARCHAR(50) NULL,
          DESTINATION_GLN NVARCHAR(50) NULL,
          ACTION_TYPE NVARCHAR(10) NULL,
          SHIP_TO NVARCHAR(50) NULL,
          NOTE NVARCHAR(500) NULL,
          VERSION NVARCHAR(10) NULL,
          XML_CONTENT NVARCHAR(MAX) NULL,
          CREATED_DATE DATETIME DEFAULT GETDATE(),
          UPDATED_DATE DATETIME NULL
        )
      `)
      
      await pool.request().query(`
        CREATE UNIQUE INDEX IX_AKTBLPTSMAS_TRANSFER_ID ON AKTBLPTSMAS(TRANSFER_ID)
      `)
      await pool.request().query(`
        CREATE INDEX IX_AKTBLPTSMAS_DOCUMENT_DATE ON AKTBLPTSMAS(DOCUMENT_DATE)
      `)
      await pool.request().query(`
        CREATE INDEX IX_AKTBLPTSMAS_SOURCE_GLN ON AKTBLPTSMAS(SOURCE_GLN)
      `)
      await pool.request().query(`
        CREATE INDEX IX_AKTBLPTSMAS_DESTINATION_GLN ON AKTBLPTSMAS(DESTINATION_GLN)
      `)
      
      console.log('✅ AKTBLPTSMAS tablosu oluşturuldu')
    } else {
      console.log('✅ AKTBLPTSMAS tablosu mevcut')
    }
    
    // Transaction tablo kontrolü ve oluşturma
    const checkTransTable = await pool.request().query(`
      SELECT * FROM sys.objects 
      WHERE object_id = OBJECT_ID(N'AKTBLPTSTRA') AND type in (N'U')
    `)
    
    if (checkTransTable.recordset.length === 0) {
      console.log('📋 AKTBLPTSTRA tablosu oluşturuluyor...')
      await pool.request().query(`
        CREATE TABLE AKTBLPTSTRA (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          TRANSFER_ID NVARCHAR(50) NOT NULL,
          CARRIER_LABEL NVARCHAR(100) NULL,
          PARENT_CARRIER_LABEL NVARCHAR(100) NULL,
          CONTAINER_TYPE NVARCHAR(10) NULL,
          CARRIER_LEVEL INT NULL,
          GTIN NVARCHAR(50) NULL,
          SERIAL_NUMBER NVARCHAR(100) NULL,
          LOT_NUMBER NVARCHAR(50) NULL,
          EXPIRATION_DATE DATE NULL,
          PRODUCTION_DATE DATE NULL,
          PO_NUMBER NVARCHAR(50) NULL,
          CREATED_DATE DATETIME DEFAULT GETDATE()
        )
      `)
      
      await pool.request().query(`
        CREATE INDEX IX_AKTBLPTSTRA_TRANSFER_ID ON AKTBLPTSTRA(TRANSFER_ID)
      `)
      await pool.request().query(`
        CREATE INDEX IX_AKTBLPTSTRA_CARRIER_LABEL ON AKTBLPTSTRA(CARRIER_LABEL)
      `)
      await pool.request().query(`
        CREATE INDEX IX_AKTBLPTSTRA_PARENT_CARRIER_LABEL ON AKTBLPTSTRA(PARENT_CARRIER_LABEL)
      `)
      await pool.request().query(`
        CREATE INDEX IX_AKTBLPTSTRA_GTIN ON AKTBLPTSTRA(GTIN)
      `)
      await pool.request().query(`
        CREATE INDEX IX_AKTBLPTSTRA_SERIAL_NUMBER ON AKTBLPTSTRA(SERIAL_NUMBER)
      `)
      await pool.request().query(`
        CREATE INDEX IX_AKTBLPTSTRA_EXPIRATION_DATE ON AKTBLPTSTRA(EXPIRATION_DATE)
      `)
      
      await pool.request().query(`
        ALTER TABLE AKTBLPTSTRA
        ADD CONSTRAINT FK_AKTBLPTSTRA_TRANSFER_ID 
        FOREIGN KEY (TRANSFER_ID) REFERENCES AKTBLPTSMAS(TRANSFER_ID)
      `)
      
      console.log('✅ AKTBLPTSTRA tablosu oluşturuldu')
    } else {
      console.log('✅ AKTBLPTSTRA tablosu mevcut')
      
      // Yeni kolonları ekle (mevcut tabloya)
      try {
        // PARENT_CARRIER_LABEL kolonu var mı kontrol et
        const checkParentCol = await pool.request().query(`
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID('AKTBLPTSTRA') AND name = 'PARENT_CARRIER_LABEL'
        `)
        
        if (checkParentCol.recordset.length === 0) {
          console.log('📝 PARENT_CARRIER_LABEL kolonu ekleniyor...')
          await pool.request().query(`ALTER TABLE AKTBLPTSTRA ADD PARENT_CARRIER_LABEL NVARCHAR(100) NULL`)
          await pool.request().query(`CREATE INDEX IX_AKTBLPTSTRA_PARENT_CARRIER_LABEL ON AKTBLPTSTRA(PARENT_CARRIER_LABEL)`)
          console.log('✅ PARENT_CARRIER_LABEL kolonu eklendi')
        }
        
        // CARRIER_LEVEL kolonu var mı kontrol et
        const checkLevelCol = await pool.request().query(`
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID('AKTBLPTSTRA') AND name = 'CARRIER_LEVEL'
        `)
        
        if (checkLevelCol.recordset.length === 0) {
          console.log('📝 CARRIER_LEVEL kolonu ekleniyor...')
          await pool.request().query(`ALTER TABLE AKTBLPTSTRA ADD CARRIER_LEVEL INT NULL`)
          console.log('✅ CARRIER_LEVEL kolonu eklendi')
        }
        
        // CARRIER_LABEL index'i var mı kontrol et
        const checkCarrierIndex = await pool.request().query(`
          SELECT * FROM sys.indexes 
          WHERE name = 'IX_AKTBLPTSTRA_CARRIER_LABEL' AND object_id = OBJECT_ID('AKTBLPTSTRA')
        `)
        
        if (checkCarrierIndex.recordset.length === 0) {
          console.log('📝 CARRIER_LABEL index\'i ekleniyor...')
          await pool.request().query(`CREATE INDEX IX_AKTBLPTSTRA_CARRIER_LABEL ON AKTBLPTSTRA(CARRIER_LABEL)`)
          console.log('✅ CARRIER_LABEL index\'i eklendi')
        }
        
        // ÖNEMLİ: SERIAL_NUMBER NULL kabul etmeli (carrier kayıtları için)
        const checkSerialNull = await pool.request().query(`
          SELECT IS_NULLABLE 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'AKTBLPTSTRA' AND COLUMN_NAME = 'SERIAL_NUMBER'
        `)
        
        if (checkSerialNull.recordset.length > 0 && checkSerialNull.recordset[0].IS_NULLABLE === 'NO') {
          console.log('📝 SERIAL_NUMBER kolonu NULL kabul edecek şekilde güncelleniyor...')
          await pool.request().query(`
            ALTER TABLE AKTBLPTSTRA
            ALTER COLUMN SERIAL_NUMBER NVARCHAR(100) NULL
          `)
          console.log('✅ SERIAL_NUMBER artık NULL kabul ediyor (carrier kayıtları için)')
        }
        
        console.log('✅ Tablo yapısı hiyerarşik yapıya güncellendi')
        
        // TRANSFER_ID tipini BIGINT'ten NVARCHAR(50)'ye güncelle
        console.log('🔄 TRANSFER_ID tipleri kontrol ediliyor...')
        try {
          // TRANSFER_ID'nin tipini kontrol et
          const checkTransferIdType = await pool.request().query(`
            SELECT DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'AKTBLPTSMAS' 
            AND COLUMN_NAME = 'TRANSFER_ID'
          `)
          
          if (checkTransferIdType.recordset[0]?.DATA_TYPE === 'bigint') {
            console.log('🔄 TRANSFER_ID tipleri NVARCHAR(50)\'ye dönüştürülüyor...')
            
            // Foreign key'i kaldır
            await pool.request().query(`
              IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_AKTBLPTSTRA_TRANSFER_ID')
              BEGIN
                ALTER TABLE AKTBLPTSTRA DROP CONSTRAINT FK_AKTBLPTSTRA_TRANSFER_ID
              END
            `)
            
            // Unique index'i kaldır
            await pool.request().query(`
              IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AKTBLPTSMAS_TRANSFER_ID' AND object_id = OBJECT_ID('AKTBLPTSMAS'))
              BEGIN
                DROP INDEX IX_AKTBLPTSMAS_TRANSFER_ID ON AKTBLPTSMAS
              END
            `)
            
            // Normal index'i kaldır
            await pool.request().query(`
              IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AKTBLPTSTRA_TRANSFER_ID' AND object_id = OBJECT_ID('AKTBLPTSTRA'))
              BEGIN
                DROP INDEX IX_AKTBLPTSTRA_TRANSFER_ID ON AKTBLPTSTRA
              END
            `)
            
            // AKTBLPTSMAS.TRANSFER_ID'yi değiştir
            await pool.request().query(`
              ALTER TABLE AKTBLPTSMAS 
              ALTER COLUMN TRANSFER_ID NVARCHAR(50) NOT NULL
            `)
            
            // AKTBLPTSTRA.TRANSFER_ID'yi değiştir
            await pool.request().query(`
              ALTER TABLE AKTBLPTSTRA 
              ALTER COLUMN TRANSFER_ID NVARCHAR(50) NOT NULL
            `)
            
            // Index'leri yeniden oluştur
            await pool.request().query(`
              CREATE UNIQUE INDEX IX_AKTBLPTSMAS_TRANSFER_ID ON AKTBLPTSMAS(TRANSFER_ID)
            `)
            
            await pool.request().query(`
              CREATE INDEX IX_AKTBLPTSTRA_TRANSFER_ID ON AKTBLPTSTRA(TRANSFER_ID)
            `)
            
            // Foreign key'i yeniden ekle
            await pool.request().query(`
              ALTER TABLE AKTBLPTSTRA
              ADD CONSTRAINT FK_AKTBLPTSTRA_TRANSFER_ID 
              FOREIGN KEY (TRANSFER_ID) REFERENCES AKTBLPTSMAS(TRANSFER_ID)
            `)
            
            console.log('✅ TRANSFER_ID tipleri NVARCHAR(50) olarak güncellendi')
          } else {
            console.log('✅ TRANSFER_ID zaten NVARCHAR tipinde')
          }
        } catch (transferIdError) {
          console.log('⚠️ TRANSFER_ID tip güncellemesi hatası (devam ediliyor):', transferIdError.message)
        }
      } catch (alterError) {
        console.log('⚠️ Tablo güncelleme hatası (devam ediliyor):', alterError.message)
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
      
      // transferId'yi string'e dönüştür (API'den number geliyor)
      const transferIdStr = String(transferId)
      
      // Transfer ID'nin zaten kaydedilip kaydedilmediğini kontrol et
      const checkRequest = new sql.Request(transaction)
      checkRequest.input('transferId', sql.NVarChar(50), transferIdStr)
      const checkResult = await checkRequest.query(`
        SELECT ID FROM AKTBLPTSMAS WHERE TRANSFER_ID = @transferId
      `)
      
      if (checkResult.recordset.length > 0) {
        console.log(`⚠️ Transfer ID ${transferIdStr} zaten kayıtlı, atlanıyor...`)
        await transaction.rollback()
        return {
          success: true,
          skipped: true,
          message: `Paket zaten kayıtlı: ${transferIdStr}`,
          data: { transferId: transferIdStr }
        }
        
        // Güncelleme
        const updateRequest = new sql.Request(transaction)
        updateRequest.input('transferId', sql.NVarChar(50), transferIdStr)
        updateRequest.input('documentNumber', sql.NVarChar(50), documentNumber || null)
        updateRequest.input('documentDate', sql.Date, documentDate ? new Date(documentDate) : null)
        updateRequest.input('sourceGLN', sql.NVarChar(50), sourceGLN || null)
        updateRequest.input('destinationGLN', sql.NVarChar(50), destinationGLN || null)
        updateRequest.input('actionType', sql.NVarChar(10), actionType || null)
        updateRequest.input('shipTo', sql.NVarChar(50), shipTo || null)
        updateRequest.input('note', sql.NVarChar(500), note || null)
        updateRequest.input('version', sql.NVarChar(10), version || null)
        updateRequest.input('xmlContent', sql.NVarChar(sql.MAX), _rawXML || null)
        
        await updateRequest.query(`
          UPDATE AKTBLPTSMAS SET
            DOCUMENT_NUMBER = @documentNumber,
            DOCUMENT_DATE = @documentDate,
            SOURCE_GLN = @sourceGLN,
            DESTINATION_GLN = @destinationGLN,
            ACTION_TYPE = @actionType,
            SHIP_TO = @shipTo,
            NOTE = @note,
            VERSION = @version,
            XML_CONTENT = @xmlContent,
            UPDATED_DATE = GETDATE()
          WHERE TRANSFER_ID = @transferId
        `)
        
        // Eski transaction kayıtlarını sil
        const deleteRequest = new sql.Request(transaction)
        deleteRequest.input('transferId', sql.NVarChar(50), transferIdStr)
        await deleteRequest.query(`
          DELETE FROM AKTBLPTSTRA WHERE TRANSFER_ID = @transferId
        `)
        
      } else {
        // Yeni kayıt
        console.log(`💾 Transfer ID ${transferIdStr} kaydediliyor...`)
        
        const insertRequest = new sql.Request(transaction)
        insertRequest.input('transferId', sql.NVarChar(50), transferIdStr)
        insertRequest.input('documentNumber', sql.NVarChar(50), documentNumber || null)
        insertRequest.input('documentDate', sql.Date, documentDate ? new Date(documentDate) : null)
        insertRequest.input('sourceGLN', sql.NVarChar(50), sourceGLN || null)
        insertRequest.input('destinationGLN', sql.NVarChar(50), destinationGLN || null)
        insertRequest.input('actionType', sql.NVarChar(10), actionType || null)
        insertRequest.input('shipTo', sql.NVarChar(50), shipTo || null)
        insertRequest.input('note', sql.NVarChar(500), note || null)
        insertRequest.input('version', sql.NVarChar(10), version || null)
        insertRequest.input('xmlContent', sql.NVarChar(sql.MAX), _rawXML || null)
        
        await insertRequest.query(`
          INSERT INTO AKTBLPTSMAS (
            TRANSFER_ID, DOCUMENT_NUMBER, DOCUMENT_DATE, SOURCE_GLN, DESTINATION_GLN,
            ACTION_TYPE, SHIP_TO, NOTE, VERSION, XML_CONTENT
          ) VALUES (
            @transferId, @documentNumber, @documentDate, @sourceGLN, @destinationGLN,
            @actionType, @shipTo, @note, @version, @xmlContent
          )
        `)
      }
      
      // Ürünleri ve carrier hiyerarşisini kaydet
      if (products && products.length > 0) {
        console.log(`📦 ${products.length} ürün kaydediliyor...`)
        
        for (const product of products) {
          const productRequest = new sql.Request(transaction)
          productRequest.input('transferId', sql.NVarChar(50), transferIdStr)
          productRequest.input('carrierLabel', sql.NVarChar(100), product.carrierLabel || null)
          productRequest.input('parentCarrierLabel', sql.NVarChar(100), product.parentCarrierLabel || null)
          productRequest.input('containerType', sql.NVarChar(10), product.containerType || null)
          productRequest.input('carrierLevel', sql.Int, product.carrierLevel || null)
          productRequest.input('gtin', sql.NVarChar(50), product.gtin || null)
          productRequest.input('serialNumber', sql.NVarChar(100), product.serialNumber || null)
          productRequest.input('lotNumber', sql.NVarChar(50), product.lotNumber || null)
          productRequest.input('expirationDate', sql.Date, product.expirationDate ? new Date(product.expirationDate) : null)
          productRequest.input('productionDate', sql.Date, product.productionDate ? new Date(product.productionDate) : null)
          productRequest.input('poNumber', sql.NVarChar(50), product.poNumber || null)
          
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
      
      console.log(`✅ Paket kaydedildi: ${transferIdStr} (${products?.length || 0} ürün)`)
      
      return {
        success: true,
        message: `Paket kaydedildi: ${transferIdStr}`,
        data: {
          transferId: transferIdStr,
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
 * Transfer ID ile paket verilerini getir
 * @param {string} transferId - Transfer ID
 * @param {string} cariGlnColumn - Cari GLN kolon adı (örn: EMAIL veya TBLCASABIT.EMAIL)
 * @param {string} stockBarcodeColumn - Stok barkod kolon adı (örn: STOK_KODU veya TBLSTSABIT.STOK_KODU)
 * @returns {Promise<Object>}
 */
async function getPackageData(transferId, cariGlnColumn = 'TBLCASABIT.EMAIL', stockBarcodeColumn = 'TBLSTSABIT.STOK_KODU') {
  try {
    const pool = await getPTSConnection()
    
    // Kolon adlarını parse et (TBLCASABIT.EMAIL -> EMAIL)
    const parsedCariColumn = cariGlnColumn.includes('.') ? cariGlnColumn.split('.')[1] : cariGlnColumn
    const parsedStockColumn = stockBarcodeColumn.includes('.') ? stockBarcodeColumn.split('.')[1] : stockBarcodeColumn
    
    console.log('📦 Paket detayı:', { transferId, cariGlnColumn, parsedCariColumn, stockBarcodeColumn, parsedStockColumn })
    
    // Master kayıt
    const masterRequest = pool.request()
    masterRequest.input('transferId', sql.NVarChar(50), transferId)
    const masterResult = await masterRequest.query(`
      SELECT * FROM AKTBLPTSMAS WHERE TRANSFER_ID = @transferId
    `)
    
    if (masterResult.recordset.length === 0) {
      return {
        success: false,
        message: 'Paket bulunamadı'
      }
    }
    
    const master = masterResult.recordset[0]
    
    // Cari bilgilerini getir (Türkçe karakter düzeltmesi ile)
    try {
      const cariRequest = pool.request()
      cariRequest.input('sourceGLN', sql.NVarChar(50), master.SOURCE_GLN)
      const cariResult = await cariRequest.query(`
        SELECT TOP 1 CARI_ISIM, CARI_ILCE, CARI_IL
        FROM TBLCASABIT WITH (NOLOCK)
        WHERE ${parsedCariColumn} = @sourceGLN
      `)
      if (cariResult.recordset.length > 0) {
        master.SOURCE_GLN_NAME = fixTurkishChars(cariResult.recordset[0].CARI_ISIM)
        master.SOURCE_GLN_ILCE = fixTurkishChars(cariResult.recordset[0].CARI_ILCE)
        master.SOURCE_GLN_IL = fixTurkishChars(cariResult.recordset[0].CARI_IL)
      }
    } catch (cariError) {
      console.log('⚠️ Cari bilgileri bulunamadı:', master.SOURCE_GLN, cariError.message)
    }
    
    // Transaction kayıtları - GTIN'in başındaki sıfırı silerek stok adı eşleştir (Türkçe karakter düzeltmesi ile)
    const transRequest = pool.request()
    transRequest.input('transferId', sql.NVarChar(50), transferId)
    const transResult = await transRequest.query(`
      SELECT 
        t.*,
        s.STOK_ADI
      FROM AKTBLPTSTRA t WITH (NOLOCK)
      LEFT JOIN TBLSTSABIT s WITH (NOLOCK) ON s.${parsedStockColumn} = 
        CASE 
          WHEN LEFT(t.GTIN, 1) = '0' THEN SUBSTRING(t.GTIN, 2, LEN(t.GTIN) - 1)
          ELSE t.GTIN
        END
      WHERE t.TRANSFER_ID = @transferId
      ORDER BY t.GTIN, t.SERIAL_NUMBER
    `)
    
    // Stok adlarını Türkçe karakter düzeltmesi ile kaydet
    const products = transResult.recordset.map(row => ({
      ...row,
      STOK_ADI: fixTurkishChars(row.STOK_ADI)
    }))
    
    return {
      success: true,
      data: {
        ...master,
        products
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
 * @returns {Promise<Object>}
 */
async function listPackages(startDate, endDate, dateFilterType = 'created', cariGlnColumn = 'TBLCASABIT.EMAIL', stockBarcodeColumn = 'TBLSTSABIT.STOK_KODU') {
  try {
    const pool = await getPTSConnection()
    const request = pool.request()
    
    // Kolon adını parse et (TBLCASABIT.EMAIL -> EMAIL)
    const parsedCariColumn = cariGlnColumn.includes('.') ? cariGlnColumn.split('.')[1] : cariGlnColumn
    
    // Tarih filtresi tipine göre sorgu oluştur
    const dateColumn = dateFilterType === 'document' ? 'DOCUMENT_DATE' : 'CREATED_DATE'
    
    // TEK SORGU ile tüm bilgileri al (LEFT JOIN + subquery ile optimize edildi)
    let query = `
      SELECT 
        p.*,
        c.CARI_ISIM AS SOURCE_GLN_NAME,
        c.CARI_ILCE AS SOURCE_GLN_ILCE,
        c.CARI_IL AS SOURCE_GLN_IL,
        ISNULL(stats.UNIQUE_GTIN_COUNT, 0) AS UNIQUE_GTIN_COUNT,
        ISNULL(stats.TOTAL_PRODUCT_COUNT, 0) AS TOTAL_PRODUCT_COUNT
      FROM AKTBLPTSMAS p
      LEFT JOIN TBLCASABIT c WITH (NOLOCK) ON c.${parsedCariColumn} = p.SOURCE_GLN
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
      request.input('startDate', sql.Date, new Date(startDate))
      request.input('endDate', sql.Date, new Date(endDate))
    }
    
    query += ' ORDER BY p.CREATED_DATE DESC'
    
    console.log('📋 Paket listesi sorgusu (optimize edildi):', { startDate, endDate, dateFilterType, dateColumn, cariGlnColumn, parsedCariColumn })
    
    const result = await request.query(query)
    
    // Türkçe karakterleri düzelt
    const packages = result.recordset.map(pkg => ({
      ...pkg,
      SOURCE_GLN_NAME: pkg.SOURCE_GLN_NAME ? fixTurkishChars(pkg.SOURCE_GLN_NAME) : null,
      SOURCE_GLN_ILCE: pkg.SOURCE_GLN_ILCE ? fixTurkishChars(pkg.SOURCE_GLN_ILCE) : null,
      SOURCE_GLN_IL: pkg.SOURCE_GLN_IL ? fixTurkishChars(pkg.SOURCE_GLN_IL) : null,
      UNIQUE_GTIN_COUNT: pkg.UNIQUE_GTIN_COUNT || 0,
      TOTAL_PRODUCT_COUNT: pkg.TOTAL_PRODUCT_COUNT || 0
    }))
    
    console.log('✅ Paket sayısı:', packages.length)
    
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
    checkRequest.input('carrierLabel', sql.NVarChar(100), carrierLabel)
    
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
    request.input('carrierLabel', sql.NVarChar(100), carrierLabel)
    
    const result = await request.query(`
      WITH CarrierHierarchy AS (
        -- Root: Okutulan carrier (kendisi de dahil)
        SELECT 
          ID,
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
          CAST(CARRIER_LABEL AS NVARCHAR(500)) AS PATH
        FROM AKTBLPTSTRA
        WHERE CARRIER_LABEL = @carrierLabel
        
        UNION ALL
        
        -- Recursive: Alt carrier'lar ve ürünler
        SELECT 
          t.ID,
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
          CAST(ch.PATH + ' -> ' + ISNULL(t.CARRIER_LABEL, '[Ürün]') AS NVARCHAR(500))
        FROM AKTBLPTSTRA t
        INNER JOIN CarrierHierarchy ch ON t.PARENT_CARRIER_LABEL = ch.CARRIER_LABEL
      )
      SELECT * FROM CarrierHierarchy
      ORDER BY DEPTH, CARRIER_LEVEL, ID
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
    request.input('transferId', sql.NVarChar(50), transferId)
    request.input('carrierLabel', sql.NVarChar(100), carrierLabel)
    
    const result = await request.query(`
      WITH CarrierHierarchy AS (
        SELECT 
          ID,
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
          t.ID,
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
      ORDER BY DEPTH, CARRIER_LEVEL, ID
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

export {
  createTablesIfNotExists,
  savePackageData,
  getPackageData,
  listPackages,
  getProductsByCarrierLabel,
  getCarrierDetails
}

