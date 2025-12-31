import { getPTSConnection, getConnection, getDynamicConnection } from '../config/database.js'
import sql from 'mssql'
import { log } from '../utils/logger.js'
import companySettingsService from './companySettingsService.js'

/**
 * ============================================================================
 * ATAKOD ITS - DATABASE INITIALIZATION SERVICE
 * ============================================================================
 * Bu servis backend başlarken tüm tabloları oluşturur/günceller.
 * Tüm tablo tanımları ve migration'lar tek bir yerde toplanmıştır.
 * ============================================================================
 */

/**
 * Tüm veritabanı tablolarını oluştur ve varsayılan verileri ekle
 * NOT: ITS tabloları sadece AKTİF şirket veritabanlarında oluşturulur
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function initializeDatabase() {
  try {
    console.log('🚀 Veritabanı başlatılıyor...')

    // PTS tabloları (NETSIS veritabanı)
    await createPTSTables()

    // Auth tabloları (NETSIS veritabanı)
    await createAuthTables()

    // Aktif şirketlerin veritabanlarında ITS tablolarını oluştur
    console.log('🏢 Aktif şirket veritabanları kontrol ediliyor...')
    const activeResult = await companySettingsService.getActiveCompanies()
    if (activeResult.success && activeResult.data.length > 0) {
      for (const sirket of activeResult.data) {
        try {
          console.log(`  📁 ${sirket} veritabanı kontrol ediliyor...`)
          await createITSTablesForCompany(sirket)
          console.log(`  ✅ ${sirket} veritabanı hazır`)
        } catch (err) {
          console.error(`  ❌ ${sirket} veritabanı hatası:`, err.message)
        }
      }
    } else {
      console.log('  ⚠️ Aktif şirket bulunamadı - Şirket Ayarlarından aktifleştirin')
    }

    console.log('✅ Veritabanı başlatma tamamlandı!')
    return { success: true }
  } catch (error) {
    console.error('❌ Veritabanı başlatma hatası:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================================
// 1. AUTH TABLOLARI (AKTBLKULLANICI, AKTBLAYAR)
// ============================================================================
async function createAuthTables() {
  const pool = await getPTSConnection()
  log('📋 Auth tabloları kontrol ediliyor...')

  // ----- AKTBLKULLANICI -----
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AKTBLKULLANICI' AND xtype='U')
    BEGIN
      CREATE TABLE AKTBLKULLANICI (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        KULLANICI_ADI NVARCHAR(50) NOT NULL UNIQUE,
        SIFRE NVARCHAR(255) NOT NULL,
        AD_SOYAD NVARCHAR(100),
        EMAIL NVARCHAR(100),
        ROL NVARCHAR(20) DEFAULT 'user',
        DEPARTMAN NVARCHAR(50),
        AKTIF BIT DEFAULT 1,
        YETKI_URUN_HAZIRLAMA BIT DEFAULT 1,
        YETKI_PTS BIT DEFAULT 1,
        YETKI_MESAJ_KODLARI BIT DEFAULT 0,
        YETKI_AYARLAR BIT DEFAULT 0,
        YETKI_KULLANICILAR BIT DEFAULT 0,
        SON_GIRIS DATETIME,
        OLUSTURMA_TARIHI DATETIME DEFAULT GETDATE()
      );
    END
  `)

  // Migration: Yetki kolonlarını ekle
  const yetkiKolonlari = [
    'YETKI_URUN_HAZIRLAMA',
    'YETKI_PTS',
    'YETKI_MESAJ_KODLARI',
    'YETKI_AYARLAR',
    'YETKI_KULLANICILAR',
    'YETKI_SIRKET_AYARLARI'
  ]

  for (const col of yetkiKolonlari) {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLKULLANICI') AND name = '${col}')
      BEGIN
        ALTER TABLE AKTBLKULLANICI ADD ${col} BIT DEFAULT ${col === 'YETKI_URUN_HAZIRLAMA' || col === 'YETKI_PTS' ? '1' : '0'};
      END
    `)
  }

  // Varsayılan admin kullanıcısı
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM AKTBLKULLANICI WHERE KULLANICI_ADI = 'admin')
    BEGIN
      INSERT INTO AKTBLKULLANICI (KULLANICI_ADI, SIFRE, AD_SOYAD, EMAIL, ROL, DEPARTMAN, AKTIF,
        YETKI_URUN_HAZIRLAMA, YETKI_PTS, YETKI_MESAJ_KODLARI, YETKI_AYARLAR, YETKI_KULLANICILAR)
      VALUES ('admin', 'admin123', 'Admin Kullanıcı', 'admin@atakodits.com', 'admin', 'Yönetim', 1,
        1, 1, 1, 1, 1);
    END
    ELSE
    BEGIN
      UPDATE AKTBLKULLANICI SET 
        YETKI_URUN_HAZIRLAMA = 1, YETKI_PTS = 1, YETKI_MESAJ_KODLARI = 1, 
        YETKI_AYARLAR = 1, YETKI_KULLANICILAR = 1
      WHERE KULLANICI_ADI = 'admin';
    END
  `)

  // Demo kullanıcı
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM AKTBLKULLANICI WHERE KULLANICI_ADI = 'demo')
    BEGIN
      INSERT INTO AKTBLKULLANICI (KULLANICI_ADI, SIFRE, AD_SOYAD, EMAIL, ROL, DEPARTMAN, AKTIF,
        YETKI_URUN_HAZIRLAMA, YETKI_PTS, YETKI_MESAJ_KODLARI, YETKI_AYARLAR, YETKI_KULLANICILAR)
      VALUES ('demo', 'demo123', 'Demo Kullanıcı', 'demo@atakodits.com', 'user', 'Satış', 1,
        1, 1, 0, 0, 0);
    END
  `)

  log('✅ AKTBLKULLANICI tablosu hazır')

  // ----- AKTBLAYAR -----
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AKTBLAYAR' AND xtype='U')
    BEGIN
      CREATE TABLE AKTBLAYAR (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        AYAR_ADI NVARCHAR(100) NOT NULL UNIQUE,
        AYAR_DEGERI NVARCHAR(500),
        ACIKLAMA NVARCHAR(200),
        GUNCELLEME_TARIHI DATETIME DEFAULT GETDATE()
      );
    END
  `)

  // Varsayılan ayarlar
  const varsayilanAyarlar = [
    // ITS Temel Ayarları
    { name: 'depoAdi', value: '', desc: 'Depo Adı' },
    { name: 'itsGlnNo', value: '', desc: 'ITS GLN No' },
    { name: 'itsUsername', value: '', desc: 'ITS Kullanıcı Adı' },
    { name: 'itsPassword', value: '', desc: 'ITS Şifre' },
    { name: 'itsWebServiceUrl', value: 'https://its2.saglik.gov.tr', desc: 'ITS Web Servis Adresi' },

    // ITS Endpoint URL'leri
    { name: 'itsTokenUrl', value: '/token/app/token', desc: 'Token URL' },
    { name: 'itsDepoSatisUrl', value: '/wholesale/app/dispatch', desc: 'Depo Satış URL' },
    { name: 'itsCheckStatusUrl', value: '/reference/app/check_status', desc: 'Durum Kontrol URL' },
    { name: 'itsDeaktivasyonUrl', value: '/common/app/deactivation', desc: 'Deaktivasyon URL' },
    { name: 'itsMalAlimUrl', value: '/common/app/accept', desc: 'Mal Alım URL' },
    { name: 'itsMalIadeUrl', value: '/common/app/return', desc: 'Mal İade URL' },
    { name: 'itsSatisIptalUrl', value: '/wholesale/app/dispatchcancel', desc: 'Satış İptal URL' },
    { name: 'itsEczaneSatisUrl', value: '/prescription/app/pharmacysale', desc: 'Eczane Satış URL' },
    { name: 'itsEczaneSatisIptalUrl', value: '/prescription/app/pharmacysalecancel', desc: 'Eczane Satış İptal URL' },
    { name: 'itsTakasDevirUrl', value: '/common/app/transfer', desc: 'Takas Devir URL' },
    { name: 'itsTakasIptalUrl', value: '/common/app/transfercancel', desc: 'Takas İptal URL' },
    { name: 'itsCevapKodUrl', value: '/reference/app/errorcode', desc: 'Cevap Kod URL' },
    { name: 'itsPaketSorguUrl', value: '/pts/app/search', desc: 'Paket Sorgu URL' },
    { name: 'itsPaketIndirUrl', value: '/pts/app/GetPackage', desc: 'Paket İndir URL' },
    { name: 'itsPaketGonderUrl', value: '/pts/app/SendPackage', desc: 'Paket Gönder URL' },
    { name: 'itsDogrulamaUrl', value: '/reference/app/verification', desc: 'Doğrulama URL' },

    // UTS Ayarları
    { name: 'utsNo', value: '', desc: 'Firma UTS Numarası' },
    { name: 'utsId', value: '', desc: 'UTS ID (40 karakter)' },
    { name: 'utsWebServiceUrl', value: 'https://utsuygulama.saglik.gov.tr', desc: 'UTS Web Servis Adresi' },
    { name: 'utsVermeBildirimiUrl', value: '/UTS/uh/rest/bildirim/verme/ekle', desc: 'Verme Bildirimi URL' },
    { name: 'utsVermeIptalBildirimiUrl', value: '/UTS/uh/rest/bildirim/verme/iptal', desc: 'Verme İptal Bildirimi URL' },
    { name: 'utsAlmaBildirimiUrl', value: '/UTS/uh/rest/bildirim/alma/ekle', desc: 'Alma Bildirimi URL' },
    { name: 'utsFirmaSorgulaUrl', value: '/UTS/rest/kurum/firmaSorgula', desc: 'Firma Sorgula URL' },
    { name: 'utsUrunSorgulaUrl', value: '/UTS/rest/tibbiCihaz/urunSorgula', desc: 'Ürün Sorgula URL' },
    { name: 'utsBekleyenleriSorgulaUrl', value: '/UTS/uh/rest/bildirim/alma/bekleyenler/sorgula', desc: 'Bekleyenler Sorgula URL' },
    { name: 'utsBildirimSorgulaUrl', value: '/UTS/uh/rest/bildirim/sorgula/offset', desc: 'Bildirim Sorgula URL' },
    { name: 'utsStokYapilabilirTekilUrunSorgulaUrl', value: '/UTS/uh/rest/stokYapilabilirTekilUrun/sorgula', desc: 'Stok Yapılabilir Tekil Ürün URL' },

    // ERP Ayarları
    { name: 'erpWebServiceUrl', value: 'http://localhost:5000', desc: 'ERP Web Servis Adresi' },

    // Ürün Ayarları
    { name: 'urunBarkodBilgisi', value: 'STOK_KODU', desc: 'Ürün barkod bilgisi alanı' },
    { name: 'urunItsBilgisi', value: "TBLSTSABIT.KOD_5='BESERI'", desc: 'ITS ürün filtresi' },
    { name: 'urunUtsBilgisi', value: "TBLSTSABIT.KOD_5='UTS'", desc: 'UTS ürün filtresi' },

    // Cari Ayarları
    { name: 'cariGlnBilgisi', value: 'TBLCASABIT.EMAIL', desc: 'Cari GLN bilgisi alanı' },
    { name: 'cariUtsBilgisi', value: 'TBLCASABITEK.KULL3S', desc: 'Cari UTS bilgisi alanı' },
    { name: 'cariEpostaBilgisi', value: 'TBLCASABITEK.CARIALIAS', desc: 'Cari ePosta bilgisi alanı' }
  ]

  for (const ayar of varsayilanAyarlar) {
    await pool.request()
      .input('ayarAdi', ayar.name)
      .input('ayarDegeri', ayar.value)
      .input('aciklama', ayar.desc)
      .query(`
        IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = @ayarAdi)
        BEGIN
          INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) 
          VALUES (@ayarAdi, @ayarDegeri, @aciklama);
        END
      `)
  }

  log('✅ AKTBLAYAR tablosu hazır')
}

// ============================================================================
// 2. PTS TABLOLARI (AKTBLPTSMAS, AKTBLPTSTRA)
// ============================================================================
async function createPTSTables() {
  const pool = await getPTSConnection()
  log('📋 PTS tabloları kontrol ediliyor...')

  // ----- AKTBLPTSMAS (Master) -----
  const checkMaster = await pool.request().query(`
    SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'AKTBLPTSMAS') AND type in (N'U')
  `)

  if (checkMaster.recordset.length === 0) {
    log('📋 AKTBLPTSMAS tablosu oluşturuluyor...')
    await pool.request().query(`
      CREATE TABLE AKTBLPTSMAS (
        TRANSFER_ID BIGINT NOT NULL PRIMARY KEY,
        DOCUMENT_NUMBER VARCHAR(25) NULL,
        DOCUMENT_DATE DATE NULL,
        SOURCE_GLN VARCHAR(15) NULL,
        DESTINATION_GLN VARCHAR(15) NULL,
        ACTION_TYPE VARCHAR(5) NULL,
        SHIP_TO VARCHAR(15) NULL,
        NOTE VARCHAR(100) NULL,
        VERSION VARCHAR(10) NULL,
        BILDIRIM VARCHAR(3) NULL,
        BILDIRIM_TARIHI DATETIME NULL,
        BILDIRIM_KULLANICI VARCHAR(35) NULL,
        KAYIT_TARIHI DATETIME DEFAULT GETDATE(),
        KAYIT_KULLANICI VARCHAR(35) NULL,
        KALEM_SAYISI INT NULL DEFAULT 0,
        URUN_ADEDI INT NULL DEFAULT 0       
      )
    `)

    await pool.request().query(`CREATE INDEX IX_AKTBLPTSMAS_DOCUMENT_DATE ON AKTBLPTSMAS(DOCUMENT_DATE)`)
    await pool.request().query(`CREATE INDEX IX_AKTBLPTSMAS_SOURCE_GLN ON AKTBLPTSMAS(SOURCE_GLN)`)
    await pool.request().query(`CREATE INDEX IX_AKTBLPTSMAS_BILDIRIM_TARIHI ON AKTBLPTSMAS(BILDIRIM_TARIHI)`)
    await pool.request().query(`CREATE INDEX IX_AKTBLPTSMAS_KAYIT_TARIHI ON AKTBLPTSMAS(KAYIT_TARIHI)`)

    log('✅ AKTBLPTSMAS tablosu oluşturuldu')
  } else {
    log('✅ AKTBLPTSMAS tablosu mevcut')

    // Migration: Eksik kolonları ekle
    const kolonlar = [
      { name: 'BILDIRIM', type: 'VARCHAR(3) NULL' },
      { name: 'BILDIRIM_TARIHI', type: 'DATETIME NULL' },
      { name: 'BILDIRIM_KULLANICI', type: 'VARCHAR(35) NULL' },
      { name: 'KALEM_SAYISI', type: 'INT NULL DEFAULT 0' },
      { name: 'URUN_ADEDI', type: 'INT NULL DEFAULT 0' },
      { name: 'KAYIT_KULLANICI', type: 'VARCHAR(35) NULL' }
    ]

    for (const kolon of kolonlar) {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSMAS') AND name = '${kolon.name}')
          ALTER TABLE AKTBLPTSMAS ADD ${kolon.name} ${kolon.type};
      `)
    }
  }

  // ----- AKTBLPTSTRA (Transaction) -----
  const checkTrans = await pool.request().query(`
    SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'AKTBLPTSTRA') AND type in (N'U')
  `)

  if (checkTrans.recordset.length === 0) {
    log('📋 AKTBLPTSTRA tablosu oluşturuluyor...')
    await pool.request().query(`
      CREATE TABLE AKTBLPTSTRA (
        ID BIGINT IDENTITY(1,1) PRIMARY KEY,
        TRANSFER_ID BIGINT NOT NULL,
        CARRIER_LABEL VARCHAR(25) NULL,
        PARENT_CARRIER_LABEL VARCHAR(25) NULL,
        CONTAINER_TYPE VARCHAR(5) NULL,
        CARRIER_LEVEL TINYINT NULL,
        GTIN VARCHAR(14) NULL,
        SERIAL_NUMBER VARCHAR(25) NULL,
        LOT_NUMBER VARCHAR(15) NULL,
        EXPIRATION_DATE DATE NULL,
        PRODUCTION_DATE DATE NULL,
        PO_NUMBER VARCHAR(25) NULL,
        BILDIRIM VARCHAR(20) NULL,
        BILDIRIM_TARIHI DATETIME NULL,
        BILDIRIM_KULLANICI VARCHAR(35) NULL,
        CONSTRAINT FK_AKTBLPTSTRA_TRANSFER_ID FOREIGN KEY (TRANSFER_ID) REFERENCES AKTBLPTSMAS(TRANSFER_ID) ON DELETE CASCADE
      )
    `)

    await pool.request().query(`CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_TRANSFER_ID ON AKTBLPTSTRA(TRANSFER_ID)`)
    await pool.request().query(`CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_CARRIER_LABEL ON AKTBLPTSTRA(CARRIER_LABEL) INCLUDE (TRANSFER_ID, GTIN, SERIAL_NUMBER)`)
    await pool.request().query(`CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_GTIN ON AKTBLPTSTRA(GTIN) INCLUDE (TRANSFER_ID, SERIAL_NUMBER, EXPIRATION_DATE)`)
    await pool.request().query(`CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_SERIAL_NUMBER ON AKTBLPTSTRA(SERIAL_NUMBER) INCLUDE (TRANSFER_ID, GTIN)`)
    await pool.request().query(`CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_EXPIRATION_DATE ON AKTBLPTSTRA(EXPIRATION_DATE) INCLUDE (TRANSFER_ID, GTIN)`)

    log('✅ AKTBLPTSTRA tablosu oluşturuldu')
  } else {
    log('✅ AKTBLPTSTRA tablosu mevcut')

    // Migration: Eksik kolonları ekle
    const kolonlar = [
      { name: 'ID', type: 'BIGINT IDENTITY(1,1)', special: true },
      { name: 'BILDIRIM', type: 'VARCHAR(20) NULL' },
      { name: 'BILDIRIM_TARIHI', type: 'DATETIME NULL' },
      { name: 'BILDIRIM_KULLANICI', type: 'VARCHAR(35) NULL' },
      { name: 'PARENT_CARRIER_LABEL', type: 'VARCHAR(25) NULL' },
      { name: 'CARRIER_LEVEL', type: 'TINYINT NULL' }
    ]

    for (const kolon of kolonlar) {
      if (kolon.special) {
        // ID kolonu için özel işlem - IDENTITY kolon sonradan eklenemez, bu yüzden kontrol et
        const hasId = await pool.request().query(`
          SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSTRA') AND name = 'ID'
        `)
        if (hasId.recordset.length === 0) {
          log('⚠️ AKTBLPTSTRA tablosuna ID kolonu eklenemedi - manuel migration gerekli')
          // NOT: Mevcut tabloya IDENTITY kolon eklemek için tablo yeniden oluşturulmalı
        }
      } else {
        await pool.request().query(`
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSTRA') AND name = '${kolon.name}')
            ALTER TABLE AKTBLPTSTRA ADD ${kolon.name} ${kolon.type};
      `)
      }
    }

    log('✅ PTS tabloları hazır')
  }
}

// ============================================================================
// 3. ITS TABLOLARI (AKTBLITSUTS)
// ============================================================================
async function createITSTables() {
  const pool = await getConnection()
  log('📋 ITS tabloları kontrol ediliyor...')

  // ----- AKTBLITSUTS -----
  const checkTable = await pool.request().query(`
    SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'AKTBLITSUTS') AND type in (N'U')
  `)

  if (checkTable.recordset.length === 0) {
    log('📋 AKTBLITSUTS tablosu oluşturuluyor...')
    await pool.request().query(`
      CREATE TABLE AKTBLITSUTS (
        RECNO INT IDENTITY(1,1) PRIMARY KEY,
        HAR_RECNO INT,
        TURU CHAR(1),
        FTIRSIP CHAR(1) NOT NULL,
        FATIRS_NO VARCHAR(15),
        CARI_KODU VARCHAR(35),
        STOK_KODU VARCHAR(35),
        MIKTAR FLOAT,
        GTIN VARCHAR(15),
        SERI_NO VARCHAR(25),
        MIAD DATE,
        LOT_NO VARCHAR(35),
        URETIM_TARIHI DATE,
        CARRIER_LABEL VARCHAR(25),
        CONTAINER_TYPE CHAR(1),
        BILDIRIM VARCHAR(20),
        BILDIRIM_ID VARCHAR(36),
        BILDIRIM_TARIHI DATETIME,
        KAYIT_TARIHI DATETIME DEFAULT GETDATE(),
        KAYIT_KULLANICI VARCHAR(35)
      )
    `)

    // Index'ler
    await pool.request().query(`CREATE NONCLUSTERED INDEX IX_AKTBLITSUTS_GTIN ON AKTBLITSUTS(GTIN) INCLUDE (SERI_NO, LOT_NO, MIAD)`)
    await pool.request().query(`CREATE NONCLUSTERED INDEX IX_AKTBLITSUTS_SERI_NO ON AKTBLITSUTS(SERI_NO) INCLUDE (GTIN, BILDIRIM)`)
    await pool.request().query(`CREATE NONCLUSTERED INDEX IX_AKTBLITSUTS_FATIRS_NO ON AKTBLITSUTS(FATIRS_NO, FTIRSIP) INCLUDE (CARI_KODU)`)
    await pool.request().query(`CREATE NONCLUSTERED INDEX IX_AKTBLITSUTS_CARI_STOK ON AKTBLITSUTS(CARI_KODU, STOK_KODU) INCLUDE (GTIN, SERI_NO, BILDIRIM)`)

    log('✅ AKTBLITSUTS tablosu oluşturuldu')
  } else {
    log('✅ AKTBLITSUTS tablosu mevcut')

    // Migration: CONTAINER_TYPE kolonu
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLITSUTS') AND name = 'CONTAINER_TYPE')
        ALTER TABLE AKTBLITSUTS ADD CONTAINER_TYPE CHAR(1) NULL;
    `)
  }

  // ----- AKTBLITSMESAJ (ITS Mesaj Kodları) -----
  // Bu tablo NETSIS veritabanında oluşturulur
  const ptsPool = await getPTSConnection()
  const checkMesajTable = await ptsPool.request().query(`
    SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'AKTBLITSMESAJ') AND type in (N'U')
  `)

  if (checkMesajTable.recordset.length === 0) {
    log('📋 AKTBLITSMESAJ tablosu oluşturuluyor...')
    await ptsPool.request().query(`
      CREATE TABLE AKTBLITSMESAJ (
        ID INT NOT NULL PRIMARY KEY,
        MESAJ NVARCHAR(500) NULL
      )
    `)
    log('✅ AKTBLITSMESAJ tablosu oluşturuldu')
  } else {
    log('✅ AKTBLITSMESAJ tablosu mevcut')
  }

  // ----- TBLFATUIRS ve TBLSIPAMAS Migration -----
  // Bu tablolar zaten mevcut NETSIS tabloları, sadece ITS/UTS/PTS kolonlarını ekliyoruz
  log('📋 TBLFATUIRS ve TBLSIPAMAS tabloları kontrol ediliyor...')

  const itsUtsKolonlari = [
    { name: 'FAST_DURUM', type: 'VARCHAR(3) NULL' },
    { name: 'FAST_TARIH', type: 'DATETIME NULL' },
    { name: 'FAST_KULLANICI', type: 'VARCHAR(35) NULL' },
    { name: 'ITS_BILDIRIM', type: 'VARCHAR(3) NULL' },
    { name: 'ITS_TARIH', type: 'DATETIME NULL' },
    { name: 'ITS_KULLANICI', type: 'VARCHAR(35) NULL' },
    { name: 'UTS_BILDIRIM', type: 'VARCHAR(3) NULL' },
    { name: 'UTS_TARIH', type: 'DATETIME NULL' },
    { name: 'UTS_KULLANICI', type: 'VARCHAR(35) NULL' },
    { name: 'PTS_ID', type: 'BIGINT NULL' },
    { name: 'PTS_TARIH', type: 'DATETIME NULL' },
    { name: 'PTS_KULLANICI', type: 'VARCHAR(35) NULL' }
  ]

  // TBLFATUIRS tablosuna kolonları ekle
  for (const kolon of itsUtsKolonlari) {
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'TBLFATUIRS') AND type in (N'U'))
      BEGIN
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLFATUIRS') AND name = '${kolon.name}')
          ALTER TABLE TBLFATUIRS ADD ${kolon.name} ${kolon.type};
      END
    `)
  }
  log('✅ TBLFATUIRS ITS/UTS/PTS kolonları kontrol edildi')

  // TBLSIPAMAS tablosuna kolonları ekle
  for (const kolon of itsUtsKolonlari) {
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'TBLSIPAMAS') AND type in (N'U'))
      BEGIN
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLSIPAMAS') AND name = '${kolon.name}')
          ALTER TABLE TBLSIPAMAS ADD ${kolon.name} ${kolon.type};
      END
    `)
  }
  log('✅ TBLSIPAMAS ITS/UTS/PTS kolonları kontrol edildi')

  log('✅ ITS tabloları hazır')
}

// ============================================================================
// 4. ŞİRKET BAZLI ITS TABLOLARI
// ============================================================================
/**
 * Belirli bir şirketin veritabanında ITS tablolarını oluştur
 * @param {string} databaseName - Veritabanı adı (şirket)
 */
async function createITSTablesForCompany(databaseName) {
  const pool = await getDynamicConnection(databaseName)

  // ----- AKTBLITSUTS -----
  const checkTable = await pool.request().query(`
    SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'AKTBLITSUTS') AND type in (N'U')
  `)

  if (checkTable.recordset.length === 0) {
    await pool.request().query(`
      CREATE TABLE AKTBLITSUTS (
        RECNO INT IDENTITY(1,1) PRIMARY KEY,
        HAR_RECNO INT,
        TURU CHAR(1),
        FTIRSIP CHAR(1) NOT NULL,
        FATIRS_NO VARCHAR(15),
        CARI_KODU VARCHAR(35),
        STOK_KODU VARCHAR(35),
        MIKTAR FLOAT,
        GTIN VARCHAR(15),
        SERI_NO VARCHAR(25),
        MIAD DATE,
        LOT_NO VARCHAR(35),
        URETIM_TARIHI DATE,
        CARRIER_LABEL VARCHAR(25),
        CONTAINER_TYPE CHAR(1),
        BILDIRIM VARCHAR(20),
        BILDIRIM_ID VARCHAR(36),
        BILDIRIM_TARIHI DATETIME,
        KAYIT_TARIHI DATETIME DEFAULT GETDATE(),
        KAYIT_KULLANICI VARCHAR(35)
      )
    `)

    await pool.request().query(`CREATE NONCLUSTERED INDEX IX_AKTBLITSUTS_GTIN ON AKTBLITSUTS(GTIN) INCLUDE (SERI_NO, LOT_NO, MIAD)`)
    await pool.request().query(`CREATE NONCLUSTERED INDEX IX_AKTBLITSUTS_SERI_NO ON AKTBLITSUTS(SERI_NO) INCLUDE (GTIN, BILDIRIM)`)
    await pool.request().query(`CREATE NONCLUSTERED INDEX IX_AKTBLITSUTS_FATIRS_NO ON AKTBLITSUTS(FATIRS_NO, FTIRSIP) INCLUDE (CARI_KODU)`)
    await pool.request().query(`CREATE NONCLUSTERED INDEX IX_AKTBLITSUTS_CARI_STOK ON AKTBLITSUTS(CARI_KODU, STOK_KODU) INCLUDE (GTIN, SERI_NO, BILDIRIM)`)
  } else {
    // Migration: CONTAINER_TYPE kolonu
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLITSUTS') AND name = 'CONTAINER_TYPE')
        ALTER TABLE AKTBLITSUTS ADD CONTAINER_TYPE CHAR(1) NULL;
    `)
  }

  // ----- TBLFATUIRS ve TBLSIPAMAS Migration -----
  const itsUtsKolonlari = [
    { name: 'FAST_DURUM', type: 'VARCHAR(3) NULL' },
    { name: 'FAST_TARIH', type: 'DATETIME NULL' },
    { name: 'FAST_KULLANICI', type: 'VARCHAR(35) NULL' },
    { name: 'ITS_BILDIRIM', type: 'VARCHAR(3) NULL' },
    { name: 'ITS_TARIH', type: 'DATETIME NULL' },
    { name: 'ITS_KULLANICI', type: 'VARCHAR(35) NULL' },
    { name: 'UTS_BILDIRIM', type: 'VARCHAR(3) NULL' },
    { name: 'UTS_TARIH', type: 'DATETIME NULL' },
    { name: 'UTS_KULLANICI', type: 'VARCHAR(35) NULL' },
    { name: 'PTS_ID', type: 'BIGINT NULL' },
    { name: 'PTS_TARIH', type: 'DATETIME NULL' },
    { name: 'PTS_KULLANICI', type: 'VARCHAR(35) NULL' }
  ]

  // TBLFATUIRS tablosuna kolonları ekle
  for (const kolon of itsUtsKolonlari) {
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'TBLFATUIRS') AND type in (N'U'))
      BEGIN
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLFATUIRS') AND name = '${kolon.name}')
          ALTER TABLE TBLFATUIRS ADD ${kolon.name} ${kolon.type};
      END
    `)
  }

  // TBLSIPAMAS tablosuna kolonları ekle
  for (const kolon of itsUtsKolonlari) {
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'TBLSIPAMAS') AND type in (N'U'))
      BEGIN
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLSIPAMAS') AND name = '${kolon.name}')
          ALTER TABLE TBLSIPAMAS ADD ${kolon.name} ${kolon.type};
      END
    `)
  }
}

export default {
  initializeDatabase
}

