import sql from 'mssql'

const ptsConfig = {
  server: 'NB2',
  database: 'NETSIS',
  user: 'sa',
  password: 'sapass1*',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  requestTimeout: 120000
}

async function analyzeTables() {
  try {
    const pool = await sql.connect(ptsConfig)
    console.log('✅ Veritabanına bağlanıldı\n')

    // 1. AKTBLPTSMAS tablo yapısı
    console.log('=' .repeat(80))
    console.log('AKTBLPTSMAS TABLO YAPISI')
    console.log('=' .repeat(80))
    
    const masColumns = await pool.request().query(`
      SELECT 
        c.name AS ColumnName,
        t.name AS DataType,
        c.max_length AS MaxLength,
        c.is_nullable AS IsNullable,
        CASE WHEN pk.column_id IS NOT NULL THEN 'PK' ELSE '' END AS IsPK
      FROM sys.columns c
      INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
      LEFT JOIN (
        SELECT ic.column_id, ic.object_id
        FROM sys.index_columns ic
        INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        WHERE i.is_primary_key = 1
      ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
      WHERE c.object_id = OBJECT_ID('AKTBLPTSMAS')
      ORDER BY c.column_id
    `)
    
    console.log('\nKolon Adı                    | Tip           | Max Uzunluk | Nullable | PK')
    console.log('-'.repeat(80))
    masColumns.recordset.forEach(col => {
      console.log(
        `${col.ColumnName.padEnd(28)} | ${col.DataType.padEnd(13)} | ${String(col.MaxLength).padStart(11)} | ${col.IsNullable ? 'Evet' : 'Hayır'.padEnd(8)} | ${col.IsPK}`
      )
    })

    // 2. AKTBLPTSMAS veri analizi
    console.log('\n' + '=' .repeat(80))
    console.log('AKTBLPTSMAS VERİ ANALİZİ')
    console.log('=' .repeat(80))
    
    const masDataAnalysis = await pool.request().query(`
      SELECT 
        COUNT(*) as ToplamKayit,
        MAX(LEN(TRANSFER_ID)) as MaxTransferIdLen,
        MAX(LEN(DOCUMENT_NUMBER)) as MaxDocNumLen,
        MAX(LEN(SOURCE_GLN)) as MaxSourceGlnLen,
        MAX(LEN(DESTINATION_GLN)) as MaxDestGlnLen,
        MAX(LEN(ACTION_TYPE)) as MaxActionTypeLen,
        MAX(LEN(SHIP_TO)) as MaxShipToLen,
        MAX(LEN(NOTE)) as MaxNoteLen,
        MAX(LEN(VERSION)) as MaxVersionLen,
        MAX(LEN(DURUM)) as MaxDurumLen,
        MAX(DATALENGTH(XML_CONTENT)) as MaxXmlBytes,
        AVG(DATALENGTH(XML_CONTENT)) as AvgXmlBytes,
        SUM(DATALENGTH(XML_CONTENT)) / 1024 / 1024 as TotalXmlMB
      FROM AKTBLPTSMAS
    `)
    
    const masStats = masDataAnalysis.recordset[0]
    console.log(`\nToplam Kayıt: ${masStats.ToplamKayit}`)
    console.log(`\nKolon                | Max Uzunluk (Kullanılan)`)
    console.log('-'.repeat(50))
    console.log(`TRANSFER_ID          | ${masStats.MaxTransferIdLen || 0}`)
    console.log(`DOCUMENT_NUMBER      | ${masStats.MaxDocNumLen || 0}`)
    console.log(`SOURCE_GLN           | ${masStats.MaxSourceGlnLen || 0}`)
    console.log(`DESTINATION_GLN      | ${masStats.MaxDestGlnLen || 0}`)
    console.log(`ACTION_TYPE          | ${masStats.MaxActionTypeLen || 0}`)
    console.log(`SHIP_TO              | ${masStats.MaxShipToLen || 0}`)
    console.log(`NOTE                 | ${masStats.MaxNoteLen || 0}`)
    console.log(`VERSION              | ${masStats.MaxVersionLen || 0}`)
    console.log(`DURUM                | ${masStats.MaxDurumLen || 0}`)
    console.log(`\nXML_CONTENT:`)
    console.log(`  Max Boyut: ${Math.round((masStats.MaxXmlBytes || 0) / 1024)} KB`)
    console.log(`  Ortalama Boyut: ${Math.round((masStats.AvgXmlBytes || 0) / 1024)} KB`)
    console.log(`  Toplam Boyut: ${masStats.TotalXmlMB || 0} MB`)

    // 3. TRANSFER_ID örnek değerler
    console.log('\n' + '=' .repeat(80))
    console.log('TRANSFER_ID ÖRNEK DEĞERLER')
    console.log('=' .repeat(80))
    
    const transferIdSamples = await pool.request().query(`
      SELECT TOP 10 TRANSFER_ID, LEN(TRANSFER_ID) as Uzunluk
      FROM AKTBLPTSMAS
      ORDER BY CREATED_DATE DESC
    `)
    
    transferIdSamples.recordset.forEach(row => {
      console.log(`${row.TRANSFER_ID} (${row.Uzunluk} karakter)`)
    })

    // 4. AKTBLPTSTRA tablo yapısı
    console.log('\n' + '=' .repeat(80))
    console.log('AKTBLPTSTRA TABLO YAPISI')
    console.log('=' .repeat(80))
    
    const traColumns = await pool.request().query(`
      SELECT 
        c.name AS ColumnName,
        t.name AS DataType,
        c.max_length AS MaxLength,
        c.is_nullable AS IsNullable,
        CASE WHEN pk.column_id IS NOT NULL THEN 'PK' ELSE '' END AS IsPK
      FROM sys.columns c
      INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
      LEFT JOIN (
        SELECT ic.column_id, ic.object_id
        FROM sys.index_columns ic
        INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        WHERE i.is_primary_key = 1
      ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
      WHERE c.object_id = OBJECT_ID('AKTBLPTSTRA')
      ORDER BY c.column_id
    `)
    
    console.log('\nKolon Adı                    | Tip           | Max Uzunluk | Nullable | PK')
    console.log('-'.repeat(80))
    traColumns.recordset.forEach(col => {
      console.log(
        `${col.ColumnName.padEnd(28)} | ${col.DataType.padEnd(13)} | ${String(col.MaxLength).padStart(11)} | ${col.IsNullable ? 'Evet' : 'Hayır'.padEnd(8)} | ${col.IsPK}`
      )
    })

    // 5. AKTBLPTSTRA veri analizi
    console.log('\n' + '=' .repeat(80))
    console.log('AKTBLPTSTRA VERİ ANALİZİ')
    console.log('=' .repeat(80))
    
    const traDataAnalysis = await pool.request().query(`
      SELECT 
        COUNT(*) as ToplamKayit,
        MAX(LEN(TRANSFER_ID)) as MaxTransferIdLen,
        MAX(LEN(CARRIER_LABEL)) as MaxCarrierLabelLen,
        MAX(LEN(PARENT_CARRIER_LABEL)) as MaxParentCarrierLen,
        MAX(LEN(CONTAINER_TYPE)) as MaxContainerTypeLen,
        MAX(CARRIER_LEVEL) as MaxCarrierLevel,
        MAX(LEN(GTIN)) as MaxGtinLen,
        MAX(LEN(SERIAL_NUMBER)) as MaxSerialNumLen,
        MAX(LEN(LOT_NUMBER)) as MaxLotNumLen,
        MAX(LEN(PO_NUMBER)) as MaxPoNumLen,
        MAX(LEN(DURUM)) as MaxDurumLen
      FROM AKTBLPTSTRA
    `)
    
    const traStats = traDataAnalysis.recordset[0]
    console.log(`\nToplam Kayıt: ${traStats.ToplamKayit}`)
    console.log(`\nKolon                    | Max Uzunluk (Kullanılan)`)
    console.log('-'.repeat(50))
    console.log(`TRANSFER_ID              | ${traStats.MaxTransferIdLen || 0}`)
    console.log(`CARRIER_LABEL            | ${traStats.MaxCarrierLabelLen || 0}`)
    console.log(`PARENT_CARRIER_LABEL     | ${traStats.MaxParentCarrierLen || 0}`)
    console.log(`CONTAINER_TYPE           | ${traStats.MaxContainerTypeLen || 0}`)
    console.log(`CARRIER_LEVEL            | ${traStats.MaxCarrierLevel || 0}`)
    console.log(`GTIN                     | ${traStats.MaxGtinLen || 0}`)
    console.log(`SERIAL_NUMBER            | ${traStats.MaxSerialNumLen || 0}`)
    console.log(`LOT_NUMBER               | ${traStats.MaxLotNumLen || 0}`)
    console.log(`PO_NUMBER                | ${traStats.MaxPoNumLen || 0}`)
    console.log(`DURUM                    | ${traStats.MaxDurumLen || 0}`)

    // 6. Index analizi
    console.log('\n' + '=' .repeat(80))
    console.log('INDEX YAPISI')
    console.log('=' .repeat(80))
    
    const indexes = await pool.request().query(`
      SELECT 
        t.name AS TableName,
        i.name AS IndexName,
        i.type_desc AS IndexType,
        STUFF((
          SELECT ', ' + c.name
          FROM sys.index_columns ic
          INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
          WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          FOR XML PATH('')
        ), 1, 2, '') AS Columns,
        i.is_unique AS IsUnique,
        i.is_primary_key AS IsPK
      FROM sys.indexes i
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE t.name IN ('AKTBLPTSMAS', 'AKTBLPTSTRA')
      AND i.name IS NOT NULL
      ORDER BY t.name, i.index_id
    `)
    
    console.log('\nTablo          | Index Adı                                      | Tip            | Kolonlar')
    console.log('-'.repeat(120))
    indexes.recordset.forEach(idx => {
      console.log(
        `${idx.TableName.padEnd(14)} | ${(idx.IndexName || '').padEnd(44)} | ${idx.IndexType.padEnd(14)} | ${idx.Columns}`
      )
    })

    // 7. Tablo boyutları
    console.log('\n' + '=' .repeat(80))
    console.log('TABLO BOYUTLARI')
    console.log('=' .repeat(80))
    
    const tableSizes = await pool.request().query(`
      SELECT 
        t.name AS TableName,
        p.rows AS RowCount,
        SUM(a.total_pages) * 8 AS TotalSpaceKB,
        SUM(a.used_pages) * 8 AS UsedSpaceKB,
        (SUM(a.total_pages) - SUM(a.used_pages)) * 8 AS UnusedSpaceKB
      FROM sys.tables t
      INNER JOIN sys.indexes i ON t.object_id = i.object_id
      INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
      INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
      WHERE t.name IN ('AKTBLPTSMAS', 'AKTBLPTSTRA')
      GROUP BY t.name, p.rows
      ORDER BY t.name
    `)
    
    console.log('\nTablo          | Kayıt Sayısı | Toplam Alan (MB) | Kullanılan (MB)')
    console.log('-'.repeat(70))
    tableSizes.recordset.forEach(tbl => {
      console.log(
        `${tbl.TableName.padEnd(14)} | ${String(tbl.RowCount).padStart(12)} | ${(tbl.TotalSpaceKB / 1024).toFixed(2).padStart(16)} | ${(tbl.UsedSpaceKB / 1024).toFixed(2).padStart(15)}`
      )
    })

    // 8. ÖNERİLER
    console.log('\n' + '=' .repeat(80))
    console.log('OPTİMİZASYON ÖNERİLERİ')
    console.log('=' .repeat(80))
    
    console.log(`
AKTBLPTSMAS için önerilen yapı:
- TRANSFER_ID: BIGINT PRIMARY KEY (şu an max ${masStats.MaxTransferIdLen} karakter, sayısal)
- DOCUMENT_NUMBER: VARCHAR(${Math.max(30, (masStats.MaxDocNumLen || 0) + 5)})
- SOURCE_GLN: VARCHAR(15) (GLN her zaman 13 karakter)
- DESTINATION_GLN: VARCHAR(15)
- ACTION_TYPE: VARCHAR(10)
- SHIP_TO: VARCHAR(15)
- NOTE: VARCHAR(${Math.max(100, (masStats.MaxNoteLen || 0) + 20)})
- VERSION: VARCHAR(10)
- DURUM: VARCHAR(20)
- XML_CONTENT: KALDIRILSIN (${masStats.TotalXmlMB || 0} MB yer kaplıyor)

AKTBLPTSTRA için önerilen yapı:
- TRANSFER_ID: BIGINT (FK, Clustered Index)
- CARRIER_LABEL: VARCHAR(${Math.max(25, (traStats.MaxCarrierLabelLen || 0) + 5)})
- PARENT_CARRIER_LABEL: VARCHAR(${Math.max(25, (traStats.MaxParentCarrierLen || 0) + 5)})
- CONTAINER_TYPE: VARCHAR(5)
- CARRIER_LEVEL: TINYINT (max değer ${traStats.MaxCarrierLevel || 0})
- GTIN: VARCHAR(14) (GTIN her zaman 13-14 karakter)
- SERIAL_NUMBER: VARCHAR(${Math.max(25, (traStats.MaxSerialNumLen || 0) + 5)})
- LOT_NUMBER: VARCHAR(${Math.max(25, (traStats.MaxLotNumLen || 0) + 5)})
- PO_NUMBER: VARCHAR(${Math.max(30, (traStats.MaxPoNumLen || 0) + 5)})
- DURUM: VARCHAR(20)
`)

    await pool.close()
    console.log('\n✅ Analiz tamamlandı')
    
  } catch (error) {
    console.error('❌ Hata:', error)
  }
}

analyzeTables()

