-- ============================================================================
-- FASTITS - TÜM TABLOLAR VE VARSAYILAN VERİLER
-- ============================================================================
-- Bu dosya tüm uygulama tablolarını içerir.
-- Canlı kurulum için bu dosyayı NETSIS veritabanında çalıştırın.
-- Tablolar zaten varsa atlanır (IF NOT EXISTS kontrolleri mevcut).
-- ============================================================================
-- Oluşturulma: 2025-12-28
-- Güncelleme: dbInitService.js ile senkronize edildi
-- ============================================================================

-- ============================================================================
-- 1. KULLANICI TABLOSU (AKTBLKULLANICI) - NETSIS DB
-- ============================================================================
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
    PRINT '✅ AKTBLKULLANICI tablosu oluşturuldu';
END
ELSE
BEGIN
    PRINT '✅ AKTBLKULLANICI tablosu zaten mevcut';
END
GO

-- Yetki kolonlarını ekle (mevcut tabloya migration)
IF EXISTS (SELECT * FROM sysobjects WHERE name='AKTBLKULLANICI' AND xtype='U')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLKULLANICI') AND name = 'YETKI_URUN_HAZIRLAMA')
        ALTER TABLE AKTBLKULLANICI ADD YETKI_URUN_HAZIRLAMA BIT DEFAULT 1;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLKULLANICI') AND name = 'YETKI_PTS')
        ALTER TABLE AKTBLKULLANICI ADD YETKI_PTS BIT DEFAULT 1;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLKULLANICI') AND name = 'YETKI_MESAJ_KODLARI')
        ALTER TABLE AKTBLKULLANICI ADD YETKI_MESAJ_KODLARI BIT DEFAULT 0;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLKULLANICI') AND name = 'YETKI_AYARLAR')
        ALTER TABLE AKTBLKULLANICI ADD YETKI_AYARLAR BIT DEFAULT 0;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLKULLANICI') AND name = 'YETKI_KULLANICILAR')
        ALTER TABLE AKTBLKULLANICI ADD YETKI_KULLANICILAR BIT DEFAULT 0;
    
    PRINT '✅ AKTBLKULLANICI yetki kolonları kontrol edildi';
END
GO

-- Varsayılan admin kullanıcısı
IF NOT EXISTS (SELECT * FROM AKTBLKULLANICI WHERE KULLANICI_ADI = 'admin')
BEGIN
    INSERT INTO AKTBLKULLANICI (KULLANICI_ADI, SIFRE, AD_SOYAD, EMAIL, ROL, DEPARTMAN, AKTIF,
        YETKI_URUN_HAZIRLAMA, YETKI_PTS, YETKI_MESAJ_KODLARI, YETKI_AYARLAR, YETKI_KULLANICILAR)
    VALUES ('admin', 'admin123', 'Admin Kullanıcı', 'admin@fastits.com', 'admin', 'Yönetim', 1,
        1, 1, 1, 1, 1);
    PRINT '✅ Varsayılan admin kullanıcısı oluşturuldu';
END
ELSE
BEGIN
    -- Admin kullanıcısına tüm yetkileri ver
    UPDATE AKTBLKULLANICI SET 
        YETKI_URUN_HAZIRLAMA = 1, YETKI_PTS = 1, YETKI_MESAJ_KODLARI = 1, 
        YETKI_AYARLAR = 1, YETKI_KULLANICILAR = 1
    WHERE KULLANICI_ADI = 'admin';
    PRINT '✅ Admin kullanıcısı yetkileri güncellendi';
END
GO

-- Demo kullanıcı
IF NOT EXISTS (SELECT * FROM AKTBLKULLANICI WHERE KULLANICI_ADI = 'demo')
BEGIN
    INSERT INTO AKTBLKULLANICI (KULLANICI_ADI, SIFRE, AD_SOYAD, EMAIL, ROL, DEPARTMAN, AKTIF,
        YETKI_URUN_HAZIRLAMA, YETKI_PTS, YETKI_MESAJ_KODLARI, YETKI_AYARLAR, YETKI_KULLANICILAR)
    VALUES ('demo', 'demo123', 'Demo Kullanıcı', 'demo@fastits.com', 'user', 'Satış', 1,
        1, 1, 0, 0, 0);
    PRINT '✅ Demo kullanıcısı oluşturuldu';
END
GO

-- ============================================================================
-- 2. AYARLAR TABLOSU (AKTBLAYAR) - NETSIS DB
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AKTBLAYAR' AND xtype='U')
BEGIN
    CREATE TABLE AKTBLAYAR (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        AYAR_ADI NVARCHAR(100) NOT NULL UNIQUE,
        AYAR_DEGERI NVARCHAR(500),
        ACIKLAMA NVARCHAR(200),
        GUNCELLEME_TARIHI DATETIME DEFAULT GETDATE()
    );
    PRINT '✅ AKTBLAYAR tablosu oluşturuldu';
END
ELSE
BEGIN
    PRINT '✅ AKTBLAYAR tablosu zaten mevcut';
END
GO

-- Varsayılan ayarları ekle
-- ITS Temel Ayarları
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsGlnNo')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsGlnNo', '', 'ITS GLN No');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsUsername')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsUsername', '', 'ITS Kullanıcı Adı');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsPassword')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsPassword', '', 'ITS Şifre');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsWebServiceUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsWebServiceUrl', 'https://its2.saglik.gov.tr', 'ITS Web Servis Adresi');

-- ITS Endpoint URL'leri
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsTokenUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsTokenUrl', '/token/app/token', 'Token URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsDepoSatisUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsDepoSatisUrl', '/wholesale/app/dispatch', 'Depo Satış URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsCheckStatusUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsCheckStatusUrl', '/reference/app/check_status', 'Durum Kontrol URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsDeaktivasyonUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsDeaktivasyonUrl', '/common/app/deactivation', 'Deaktivasyon URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsMalAlimUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsMalAlimUrl', '/common/app/accept', 'Mal Alım URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsMalIadeUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsMalIadeUrl', '/common/app/return', 'Mal İade URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsSatisIptalUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsSatisIptalUrl', '/wholesale/app/dispatchcancel', 'Satış İptal URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsEczaneSatisUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsEczaneSatisUrl', '/prescription/app/pharmacysale', 'Eczane Satış URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsEczaneSatisIptalUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsEczaneSatisIptalUrl', '/prescription/app/pharmacysalecancel', 'Eczane Satış İptal URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsTakasDevirUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsTakasDevirUrl', '/common/app/transfer', 'Takas Devir URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsTakasIptalUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsTakasIptalUrl', '/common/app/transfercancel', 'Takas İptal URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsCevapKodUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsCevapKodUrl', '/reference/app/errorcode', 'Cevap Kod URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsPaketSorguUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsPaketSorguUrl', '/pts/app/search', 'Paket Sorgu URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsPaketIndirUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsPaketIndirUrl', '/pts/app/GetPackage', 'Paket İndir URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsPaketGonderUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsPaketGonderUrl', '/pts/app/SendPackage', 'Paket Gönder URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'itsDogrulamaUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('itsDogrulamaUrl', '/reference/app/verification', 'Doğrulama URL');

-- UTS Ayarları
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'utsNo')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('utsNo', '', 'Firma UTS Numarası');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'utsId')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('utsId', '', 'UTS ID (40 karakter)');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'utsWebServiceUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('utsWebServiceUrl', 'https://utsuygulama.saglik.gov.tr', 'UTS Web Servis Adresi');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'utsVermeBildirimiUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('utsVermeBildirimiUrl', '/UTS/uh/rest/bildirim/verme/ekle', 'Verme Bildirimi URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'utsVermeIptalBildirimiUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('utsVermeIptalBildirimiUrl', '/UTS/uh/rest/bildirim/verme/iptal', 'Verme İptal Bildirimi URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'utsAlmaBildirimiUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('utsAlmaBildirimiUrl', '/UTS/uh/rest/bildirim/alma/ekle', 'Alma Bildirimi URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'utsFirmaSorgulaUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('utsFirmaSorgulaUrl', '/UTS/rest/kurum/firmaSorgula', 'Firma Sorgula URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'utsUrunSorgulaUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('utsUrunSorgulaUrl', '/UTS/rest/tibbiCihaz/urunSorgula', 'Ürün Sorgula URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'utsBekleyenleriSorgulaUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('utsBekleyenleriSorgulaUrl', '/UTS/uh/rest/bildirim/alma/bekleyenler/sorgula', 'Bekleyenler Sorgula URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'utsBildirimSorgulaUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('utsBildirimSorgulaUrl', '/UTS/uh/rest/bildirim/sorgula/offset', 'Bildirim Sorgula URL');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'utsStokYapilabilirTekilUrunSorgulaUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('utsStokYapilabilirTekilUrunSorgulaUrl', '/UTS/uh/rest/stokYapilabilirTekilUrun/sorgula', 'Stok Yapılabilir Tekil Ürün URL');

-- ERP Ayarları
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'erpWebServiceUrl')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('erpWebServiceUrl', 'http://localhost:5000', 'ERP Web Servis Adresi');

-- Ürün Ayarları
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'urunBarkodBilgisi')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('urunBarkodBilgisi', 'STOK_KODU', 'Ürün barkod bilgisi alanı');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'urunItsBilgisi')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('urunItsBilgisi', 'TBLSTSABIT.KOD_5=''BESERI''', 'ITS ürün filtresi');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'urunUtsBilgisi')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('urunUtsBilgisi', 'TBLSTSABIT.KOD_5=''UTS''', 'UTS ürün filtresi');

-- Cari Ayarları
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'cariGlnBilgisi')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('cariGlnBilgisi', 'TBLCASABIT.EMAIL', 'Cari GLN bilgisi alanı');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'cariUtsBilgisi')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('cariUtsBilgisi', 'TBLCASABITEK.KULL3S', 'Cari UTS bilgisi alanı');
IF NOT EXISTS (SELECT * FROM AKTBLAYAR WHERE AYAR_ADI = 'cariEpostaBilgisi')
    INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) VALUES ('cariEpostaBilgisi', 'TBLCASABITEK.CARIALIAS', 'Cari ePosta bilgisi alanı');

PRINT '✅ Varsayılan ayarlar eklendi';
GO

-- ============================================================================
-- 3. PTS MASTER TABLOSU (AKTBLPTSMAS) - NETSIS DB
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'AKTBLPTSMAS') AND type in (N'U'))
BEGIN
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
    );
    
    -- Index'ler
    CREATE INDEX IX_AKTBLPTSMAS_DOCUMENT_DATE ON AKTBLPTSMAS(DOCUMENT_DATE);
    CREATE INDEX IX_AKTBLPTSMAS_SOURCE_GLN ON AKTBLPTSMAS(SOURCE_GLN);
    CREATE INDEX IX_AKTBLPTSMAS_BILDIRIM_TARIHI ON AKTBLPTSMAS(BILDIRIM_TARIHI);
    CREATE INDEX IX_AKTBLPTSMAS_KAYIT_TARIHI ON AKTBLPTSMAS(KAYIT_TARIHI);
    
    PRINT '✅ AKTBLPTSMAS tablosu oluşturuldu';
END
ELSE
BEGIN
    PRINT '✅ AKTBLPTSMAS tablosu zaten mevcut';
    
    -- Migration: Eksik kolonları ekle
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSMAS') AND name = 'BILDIRIM')
        ALTER TABLE AKTBLPTSMAS ADD BILDIRIM VARCHAR(3) NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSMAS') AND name = 'BILDIRIM_TARIHI')
        ALTER TABLE AKTBLPTSMAS ADD BILDIRIM_TARIHI DATETIME NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSMAS') AND name = 'BILDIRIM_KULLANICI')
        ALTER TABLE AKTBLPTSMAS ADD BILDIRIM_KULLANICI VARCHAR(35) NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSMAS') AND name = 'KALEM_SAYISI')
        ALTER TABLE AKTBLPTSMAS ADD KALEM_SAYISI INT NULL DEFAULT 0;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSMAS') AND name = 'URUN_ADEDI')
        ALTER TABLE AKTBLPTSMAS ADD URUN_ADEDI INT NULL DEFAULT 0;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSMAS') AND name = 'KAYIT_KULLANICI')
        ALTER TABLE AKTBLPTSMAS ADD KAYIT_KULLANICI VARCHAR(35) NULL;
    
    PRINT '✅ AKTBLPTSMAS migration kontrol edildi';
END
GO

-- ============================================================================
-- 4. PTS TRANSACTION TABLOSU (AKTBLPTSTRA) - NETSIS DB
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'AKTBLPTSTRA') AND type in (N'U'))
BEGIN
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
    );
    
    -- Index'ler
    CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_TRANSFER_ID ON AKTBLPTSTRA(TRANSFER_ID);
    CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_CARRIER_LABEL ON AKTBLPTSTRA(CARRIER_LABEL) INCLUDE (TRANSFER_ID, GTIN, SERIAL_NUMBER);
    CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_GTIN ON AKTBLPTSTRA(GTIN) INCLUDE (TRANSFER_ID, SERIAL_NUMBER, EXPIRATION_DATE);
    CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_SERIAL_NUMBER ON AKTBLPTSTRA(SERIAL_NUMBER) INCLUDE (TRANSFER_ID, GTIN);
    CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_EXPIRATION_DATE ON AKTBLPTSTRA(EXPIRATION_DATE) INCLUDE (TRANSFER_ID, GTIN);
    
    PRINT '✅ AKTBLPTSTRA tablosu oluşturuldu';
END
ELSE
BEGIN
    PRINT '✅ AKTBLPTSTRA tablosu zaten mevcut';
    
    -- Migration: Eksik kolonları ekle
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSTRA') AND name = 'BILDIRIM')
        ALTER TABLE AKTBLPTSTRA ADD BILDIRIM VARCHAR(20) NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSTRA') AND name = 'BILDIRIM_TARIHI')
        ALTER TABLE AKTBLPTSTRA ADD BILDIRIM_TARIHI DATETIME NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSTRA') AND name = 'BILDIRIM_KULLANICI')
        ALTER TABLE AKTBLPTSTRA ADD BILDIRIM_KULLANICI VARCHAR(35) NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSTRA') AND name = 'PARENT_CARRIER_LABEL')
        ALTER TABLE AKTBLPTSTRA ADD PARENT_CARRIER_LABEL VARCHAR(25) NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLPTSTRA') AND name = 'CARRIER_LEVEL')
        ALTER TABLE AKTBLPTSTRA ADD CARRIER_LEVEL TINYINT NULL;
    
    PRINT '✅ AKTBLPTSTRA migration kontrol edildi';
END
GO

-- ============================================================================
-- 5. ITS/UTS TAKIP TABLOSU (AKTBLITSUTS) - MUHASEBE DB
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'AKTBLITSUTS') AND type in (N'U'))
BEGIN
    CREATE TABLE AKTBLITSUTS (
        RECNO INT IDENTITY(1,1) PRIMARY KEY,
        HAR_RECNO INT,
        TURU CHAR(1),                    -- I=ITS, U=UTS, D=DGR
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
        CONTAINER_TYPE CHAR(1),          -- C=Carrier
        BILDIRIM VARCHAR(20),
        BILDIRIM_ID VARCHAR(36),
        BILDIRIM_TARIHI DATETIME,
        KAYIT_TARIHI DATETIME DEFAULT GETDATE(),
        KAYIT_KULLANICI VARCHAR(35)
    );
    
    -- Index'ler
    CREATE NONCLUSTERED INDEX IX_AKTBLITSUTS_GTIN ON AKTBLITSUTS(GTIN) INCLUDE (SERI_NO, LOT_NO, MIAD);
    CREATE NONCLUSTERED INDEX IX_AKTBLITSUTS_SERI_NO ON AKTBLITSUTS(SERI_NO) INCLUDE (GTIN, BILDIRIM);
    CREATE NONCLUSTERED INDEX IX_AKTBLITSUTS_FATIRS_NO ON AKTBLITSUTS(FATIRS_NO, FTIRSIP) INCLUDE (CARI_KODU);
    CREATE NONCLUSTERED INDEX IX_AKTBLITSUTS_CARI_STOK ON AKTBLITSUTS(CARI_KODU, STOK_KODU) INCLUDE (GTIN, SERI_NO, BILDIRIM);
    
    PRINT '✅ AKTBLITSUTS tablosu oluşturuldu';
END
ELSE
BEGIN
    PRINT '✅ AKTBLITSUTS tablosu zaten mevcut';
    
    -- Migration: CONTAINER_TYPE kolonu ekle
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AKTBLITSUTS') AND name = 'CONTAINER_TYPE')
        ALTER TABLE AKTBLITSUTS ADD CONTAINER_TYPE CHAR(1) NULL;
    
    PRINT '✅ AKTBLITSUTS migration kontrol edildi';
END
GO

-- ============================================================================
-- 6. ITS MESAJ KODLARI TABLOSU (AKTBLITSMESAJ) - NETSIS DB
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'AKTBLITSMESAJ') AND type in (N'U'))
BEGIN
    CREATE TABLE AKTBLITSMESAJ (
        ID INT NOT NULL PRIMARY KEY,
        MESAJ NVARCHAR(500) NULL
    );
    
    PRINT '✅ AKTBLITSMESAJ tablosu oluşturuldu';
END
ELSE
BEGIN
    PRINT '✅ AKTBLITSMESAJ tablosu zaten mevcut';
END
GO

-- ============================================================================
-- 7. TBLFATUIRS VE TBLSIPAMAS ITS/UTS/PTS KOLONLARI (Migration)
-- Bu tablolar NETSIS'te zaten mevcut, sadece yeni kolonları ekliyoruz
-- ============================================================================

-- TBLFATUIRS tablosuna ITS/UTS/PTS kolonları ekle
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'TBLFATUIRS') AND type in (N'U'))
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLFATUIRS') AND name = 'ITS_BILDIRIM')
        ALTER TABLE TBLFATUIRS ADD ITS_BILDIRIM VARCHAR(3) NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLFATUIRS') AND name = 'ITS_TARIH')
        ALTER TABLE TBLFATUIRS ADD ITS_TARIH DATETIME NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLFATUIRS') AND name = 'ITS_KULLANICI')
        ALTER TABLE TBLFATUIRS ADD ITS_KULLANICI VARCHAR(35) NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLFATUIRS') AND name = 'UTS_BILDIRIM')
        ALTER TABLE TBLFATUIRS ADD UTS_BILDIRIM VARCHAR(3) NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLFATUIRS') AND name = 'UTS_TARIH')
        ALTER TABLE TBLFATUIRS ADD UTS_TARIH DATETIME NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLFATUIRS') AND name = 'UTS_KULLANICI')
        ALTER TABLE TBLFATUIRS ADD UTS_KULLANICI VARCHAR(35) NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLFATUIRS') AND name = 'PTS_ID')
        ALTER TABLE TBLFATUIRS ADD PTS_ID BIGINT NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLFATUIRS') AND name = 'PTS_TARIH')
        ALTER TABLE TBLFATUIRS ADD PTS_TARIH DATETIME NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLFATUIRS') AND name = 'PTS_KULLANICI')
        ALTER TABLE TBLFATUIRS ADD PTS_KULLANICI VARCHAR(35) NULL;
    
    PRINT '✅ TBLFATUIRS ITS/UTS/PTS kolonları kontrol edildi';
END
GO

-- TBLSIPAMAS tablosuna ITS/UTS/PTS kolonları ekle
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'TBLSIPAMAS') AND type in (N'U'))
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLSIPAMAS') AND name = 'ITS_BILDIRIM')
        ALTER TABLE TBLSIPAMAS ADD ITS_BILDIRIM VARCHAR(3) NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLSIPAMAS') AND name = 'ITS_TARIH')
        ALTER TABLE TBLSIPAMAS ADD ITS_TARIH DATETIME NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLSIPAMAS') AND name = 'ITS_KULLANICI')
        ALTER TABLE TBLSIPAMAS ADD ITS_KULLANICI VARCHAR(35) NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLSIPAMAS') AND name = 'UTS_BILDIRIM')
        ALTER TABLE TBLSIPAMAS ADD UTS_BILDIRIM VARCHAR(3) NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLSIPAMAS') AND name = 'UTS_TARIH')
        ALTER TABLE TBLSIPAMAS ADD UTS_TARIH DATETIME NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLSIPAMAS') AND name = 'UTS_KULLANICI')
        ALTER TABLE TBLSIPAMAS ADD UTS_KULLANICI VARCHAR(35) NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLSIPAMAS') AND name = 'PTS_ID')
        ALTER TABLE TBLSIPAMAS ADD PTS_ID BIGINT NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLSIPAMAS') AND name = 'PTS_TARIH')
        ALTER TABLE TBLSIPAMAS ADD PTS_TARIH DATETIME NULL;
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TBLSIPAMAS') AND name = 'PTS_KULLANICI')
        ALTER TABLE TBLSIPAMAS ADD PTS_KULLANICI VARCHAR(35) NULL;
    
    PRINT '✅ TBLSIPAMAS ITS/UTS/PTS kolonları kontrol edildi';
END
GO

-- ============================================================================
-- ÖZET
-- ============================================================================
PRINT '============================================';
PRINT '✅ TÜM TABLOLAR HAZIR!';
PRINT '--------------------------------------------';
PRINT '1. AKTBLKULLANICI - Kullanıcı tablosu';
PRINT '2. AKTBLAYAR      - Ayarlar tablosu';
PRINT '3. AKTBLPTSMAS    - PTS Master tablosu';
PRINT '4. AKTBLPTSTRA    - PTS Transaction tablosu';
PRINT '5. AKTBLITSUTS    - ITS/UTS takip tablosu';
PRINT '6. AKTBLITSMESAJ  - ITS mesaj kodları tablosu';
PRINT '7. TBLFATUIRS     - ITS/UTS/PTS kolonları (migration)';
PRINT '8. TBLSIPAMAS     - ITS/UTS/PTS kolonları (migration)';
PRINT '============================================';
GO
