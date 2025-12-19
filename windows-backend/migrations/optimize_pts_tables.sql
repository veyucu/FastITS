-- PTS Tabloları Optimizasyon Migration Script
-- Tarih: 2024-12-19
-- Açıklama: Gerçek veri analizine göre optimize edildi
--
-- ANALİZ SONUÇLARI:
-- AKTBLPTSMAS: 2,355 kayıt
-- AKTBLPTSTRA: 1,531,445 kayıt
-- XML_CONTENT: 153 MB (kaldırılacak)
--
-- =====================================================
-- UYARI: Bu script'i çalıştırmadan önce BACKUP alın!
-- =====================================================

USE NETSIS
GO

-- Önce mevcut verileri yedekle
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'AKTBLPTSMAS_BACKUP') AND type in (N'U'))
BEGIN
    SELECT * INTO AKTBLPTSMAS_BACKUP FROM AKTBLPTSMAS
    PRINT 'AKTBLPTSMAS yedeklendi'
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'AKTBLPTSTRA_BACKUP') AND type in (N'U'))
BEGIN
    SELECT * INTO AKTBLPTSTRA_BACKUP FROM AKTBLPTSTRA
    PRINT 'AKTBLPTSTRA yedeklendi'
END
GO

-- =====================================================
-- ADIM 1: Foreign Key ve Index'leri kaldır
-- =====================================================

-- FK constraint'i kaldır (varsa)
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_AKTBLPTSTRA_TRANSFER_ID')
BEGIN
    ALTER TABLE AKTBLPTSTRA DROP CONSTRAINT FK_AKTBLPTSTRA_TRANSFER_ID
    PRINT 'FK_AKTBLPTSTRA_TRANSFER_ID kaldırıldı'
END
GO

-- AKTBLPTSMAS Index'leri kaldır
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AKTBLPTSMAS_TRANSFER_ID' AND object_id = OBJECT_ID('AKTBLPTSMAS'))
    DROP INDEX IX_AKTBLPTSMAS_TRANSFER_ID ON AKTBLPTSMAS
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AKTBLPTSMAS_DOCUMENT_DATE' AND object_id = OBJECT_ID('AKTBLPTSMAS'))
    DROP INDEX IX_AKTBLPTSMAS_DOCUMENT_DATE ON AKTBLPTSMAS
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AKTBLPTSMAS_SOURCE_GLN' AND object_id = OBJECT_ID('AKTBLPTSMAS'))
    DROP INDEX IX_AKTBLPTSMAS_SOURCE_GLN ON AKTBLPTSMAS
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AKTBLPTSMAS_DESTINATION_GLN' AND object_id = OBJECT_ID('AKTBLPTSMAS'))
    DROP INDEX IX_AKTBLPTSMAS_DESTINATION_GLN ON AKTBLPTSMAS
PRINT 'AKTBLPTSMAS indexleri kaldırıldı'
GO

-- AKTBLPTSTRA Index'leri kaldır
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AKTBLPTSTRA_TRANSFER_ID' AND object_id = OBJECT_ID('AKTBLPTSTRA'))
    DROP INDEX IX_AKTBLPTSTRA_TRANSFER_ID ON AKTBLPTSTRA
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AKTBLPTSTRA_CARRIER_LABEL' AND object_id = OBJECT_ID('AKTBLPTSTRA'))
    DROP INDEX IX_AKTBLPTSTRA_CARRIER_LABEL ON AKTBLPTSTRA
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AKTBLPTSTRA_PARENT_CARRIER_LABEL' AND object_id = OBJECT_ID('AKTBLPTSTRA'))
    DROP INDEX IX_AKTBLPTSTRA_PARENT_CARRIER_LABEL ON AKTBLPTSTRA
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AKTBLPTSTRA_GTIN' AND object_id = OBJECT_ID('AKTBLPTSTRA'))
    DROP INDEX IX_AKTBLPTSTRA_GTIN ON AKTBLPTSTRA
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AKTBLPTSTRA_SERIAL_NUMBER' AND object_id = OBJECT_ID('AKTBLPTSTRA'))
    DROP INDEX IX_AKTBLPTSTRA_SERIAL_NUMBER ON AKTBLPTSTRA
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AKTBLPTSTRA_EXPIRATION_DATE' AND object_id = OBJECT_ID('AKTBLPTSTRA'))
    DROP INDEX IX_AKTBLPTSTRA_EXPIRATION_DATE ON AKTBLPTSTRA
PRINT 'AKTBLPTSTRA indexleri kaldırıldı'
GO

-- =====================================================
-- ADIM 2: Yeni optimize tablolar oluştur
-- =====================================================

-- Yeni AKTBLPTSMAS tablosu - Gerçek verilere göre boyutlandırıldı
-- TRANSFER_ID: max 11 karakter (sayısal) → BIGINT
-- DOCUMENT_NUMBER: max 23 karakter → VARCHAR(25)
-- SOURCE_GLN: max 13 karakter → VARCHAR(15)
-- DESTINATION_GLN: max 13 karakter → VARCHAR(15)
-- ACTION_TYPE: max 1 karakter → VARCHAR(5)
-- SHIP_TO: max 13 karakter → VARCHAR(15)
-- NOTE: max 57 karakter → VARCHAR(100)
-- VERSION: max 4 karakter → VARCHAR(10)
-- XML_CONTENT: 153 MB → KALDIRILDI

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'AKTBLPTSMAS_NEW') AND type in (N'U'))
    DROP TABLE AKTBLPTSMAS_NEW
GO

CREATE TABLE AKTBLPTSMAS_NEW (
    TRANSFER_ID BIGINT NOT NULL PRIMARY KEY,
    DOCUMENT_NUMBER VARCHAR(25) NULL,
    DOCUMENT_DATE DATE NULL,
    SOURCE_GLN VARCHAR(15) NULL,
    DESTINATION_GLN VARCHAR(15) NULL,
    ACTION_TYPE VARCHAR(5) NULL,
    SHIP_TO VARCHAR(15) NULL,
    NOTE VARCHAR(100) NULL,
    VERSION VARCHAR(10) NULL,
    DURUM VARCHAR(20) NULL,
    BILDIRIM_TARIHI DATETIME NULL,
    CREATED_DATE DATETIME DEFAULT GETDATE(),
    UPDATED_DATE DATETIME NULL
)
PRINT 'AKTBLPTSMAS_NEW oluşturuldu'
GO

-- Yeni AKTBLPTSTRA tablosu - Gerçek verilere göre boyutlandırıldı
-- TRANSFER_ID: max 11 karakter → BIGINT
-- CARRIER_LABEL: max 20 karakter → VARCHAR(25)
-- PARENT_CARRIER_LABEL: max 20 karakter → VARCHAR(25)
-- CONTAINER_TYPE: max 1 karakter → VARCHAR(5)
-- CARRIER_LEVEL: max 3 → TINYINT
-- GTIN: max 14 karakter → VARCHAR(14)
-- SERIAL_NUMBER: max 20 karakter → VARCHAR(25)
-- LOT_NUMBER: max 10 karakter → VARCHAR(15)
-- PO_NUMBER: max 20 karakter → VARCHAR(25)

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'AKTBLPTSTRA_NEW') AND type in (N'U'))
    DROP TABLE AKTBLPTSTRA_NEW
GO

CREATE TABLE AKTBLPTSTRA_NEW (
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
    DURUM VARCHAR(20) NULL,
    BILDIRIM_TARIHI DATETIME NULL,
    CREATED_DATE DATETIME DEFAULT GETDATE()
)
PRINT 'AKTBLPTSTRA_NEW oluşturuldu'
GO

-- =====================================================
-- ADIM 3: Verileri taşı
-- =====================================================

-- Master verileri taşı
SET NOCOUNT ON
INSERT INTO AKTBLPTSMAS_NEW (
    TRANSFER_ID, DOCUMENT_NUMBER, DOCUMENT_DATE, SOURCE_GLN, DESTINATION_GLN,
    ACTION_TYPE, SHIP_TO, NOTE, VERSION, DURUM, BILDIRIM_TARIHI, CREATED_DATE, UPDATED_DATE
)
SELECT 
    CAST(TRANSFER_ID AS BIGINT),
    LEFT(DOCUMENT_NUMBER, 25),
    DOCUMENT_DATE,
    LEFT(SOURCE_GLN, 15),
    LEFT(DESTINATION_GLN, 15),
    LEFT(ACTION_TYPE, 5),
    LEFT(SHIP_TO, 15),
    LEFT(NOTE, 100),
    LEFT(VERSION, 10),
    LEFT(DURUM, 20),
    BILDIRIM_TARIHI,
    CREATED_DATE,
    UPDATED_DATE
FROM AKTBLPTSMAS
WHERE ISNUMERIC(TRANSFER_ID) = 1

PRINT 'AKTBLPTSMAS verileri taşındı: ' + CAST(@@ROWCOUNT AS VARCHAR)
GO

-- Transaction verileri taşı (batch halinde - 1.5 milyon kayıt için)
SET NOCOUNT ON
DECLARE @BatchSize INT = 100000
DECLARE @Offset INT = 0
DECLARE @TotalRows INT
DECLARE @InsertedRows INT = 0

SELECT @TotalRows = COUNT(*) FROM AKTBLPTSTRA WHERE ISNUMERIC(TRANSFER_ID) = 1

WHILE @Offset < @TotalRows
BEGIN
    INSERT INTO AKTBLPTSTRA_NEW (
        TRANSFER_ID, CARRIER_LABEL, PARENT_CARRIER_LABEL, CONTAINER_TYPE, CARRIER_LEVEL,
        GTIN, SERIAL_NUMBER, LOT_NUMBER, EXPIRATION_DATE, PRODUCTION_DATE, PO_NUMBER,
        DURUM, BILDIRIM_TARIHI, CREATED_DATE
    )
    SELECT 
        CAST(t.TRANSFER_ID AS BIGINT),
        LEFT(t.CARRIER_LABEL, 25),
        LEFT(t.PARENT_CARRIER_LABEL, 25),
        LEFT(t.CONTAINER_TYPE, 5),
        CAST(t.CARRIER_LEVEL AS TINYINT),
        LEFT(t.GTIN, 14),
        LEFT(t.SERIAL_NUMBER, 25),
        LEFT(t.LOT_NUMBER, 15),
        t.EXPIRATION_DATE,
        t.PRODUCTION_DATE,
        LEFT(t.PO_NUMBER, 25),
        LEFT(t.DURUM, 20),
        t.BILDIRIM_TARIHI,
        t.CREATED_DATE
    FROM AKTBLPTSTRA t
    WHERE ISNUMERIC(t.TRANSFER_ID) = 1
      AND EXISTS (SELECT 1 FROM AKTBLPTSMAS_NEW m WHERE m.TRANSFER_ID = CAST(t.TRANSFER_ID AS BIGINT))
    ORDER BY t.ID
    OFFSET @Offset ROWS FETCH NEXT @BatchSize ROWS ONLY
    
    SET @InsertedRows = @InsertedRows + @@ROWCOUNT
    SET @Offset = @Offset + @BatchSize
    
    PRINT 'AKTBLPTSTRA: ' + CAST(@InsertedRows AS VARCHAR) + ' / ' + CAST(@TotalRows AS VARCHAR) + ' kayıt taşındı'
END
GO

-- =====================================================
-- ADIM 4: Index'leri oluştur
-- =====================================================

PRINT 'Indexler oluşturuluyor...'

-- AKTBLPTSMAS Index'leri (PK zaten clustered)
CREATE INDEX IX_AKTBLPTSMAS_DOCUMENT_DATE ON AKTBLPTSMAS_NEW(DOCUMENT_DATE)
CREATE INDEX IX_AKTBLPTSMAS_SOURCE_GLN ON AKTBLPTSMAS_NEW(SOURCE_GLN)
CREATE INDEX IX_AKTBLPTSMAS_BILDIRIM_TARIHI ON AKTBLPTSMAS_NEW(BILDIRIM_TARIHI)
CREATE INDEX IX_AKTBLPTSMAS_CREATED_DATE ON AKTBLPTSMAS_NEW(CREATED_DATE)
PRINT 'AKTBLPTSMAS indexleri oluşturuldu'
GO

-- AKTBLPTSTRA Index'leri (Clustered index TRANSFER_ID üzerinde)
CREATE CLUSTERED INDEX IX_AKTBLPTSTRA_TRANSFER_ID ON AKTBLPTSTRA_NEW(TRANSFER_ID)
PRINT 'AKTBLPTSTRA clustered index oluşturuldu'
GO

-- Nonclustered indexler (covering index'ler ile)
CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_CARRIER_LABEL ON AKTBLPTSTRA_NEW(CARRIER_LABEL) 
    INCLUDE (GTIN, SERIAL_NUMBER)
CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_GTIN ON AKTBLPTSTRA_NEW(GTIN) 
    INCLUDE (SERIAL_NUMBER, EXPIRATION_DATE)
CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_SERIAL_NUMBER ON AKTBLPTSTRA_NEW(SERIAL_NUMBER) 
    INCLUDE (GTIN)
CREATE NONCLUSTERED INDEX IX_AKTBLPTSTRA_EXPIRATION_DATE ON AKTBLPTSTRA_NEW(EXPIRATION_DATE) 
    INCLUDE (GTIN)
PRINT 'AKTBLPTSTRA nonclustered indexler oluşturuldu'
GO

-- FK Constraint ekle
ALTER TABLE AKTBLPTSTRA_NEW
ADD CONSTRAINT FK_AKTBLPTSTRA_NEW_TRANSFER_ID 
FOREIGN KEY (TRANSFER_ID) REFERENCES AKTBLPTSMAS_NEW(TRANSFER_ID) ON DELETE CASCADE
PRINT 'FK constraint eklendi'
GO

-- =====================================================
-- ADIM 5: Eski tabloları yeniden adlandır, yenileri aktif et
-- =====================================================

-- Eski tabloları rename
EXEC sp_rename 'AKTBLPTSTRA', 'AKTBLPTSTRA_OLD'
EXEC sp_rename 'AKTBLPTSMAS', 'AKTBLPTSMAS_OLD'
PRINT 'Eski tablolar yeniden adlandırıldı (_OLD)'
GO

-- Yeni tabloları rename
EXEC sp_rename 'AKTBLPTSMAS_NEW', 'AKTBLPTSMAS'
EXEC sp_rename 'AKTBLPTSTRA_NEW', 'AKTBLPTSTRA'
PRINT 'Yeni tablolar aktif edildi'
GO

-- Constraint'i yeniden adlandır
EXEC sp_rename 'FK_AKTBLPTSTRA_NEW_TRANSFER_ID', 'FK_AKTBLPTSTRA_TRANSFER_ID', 'OBJECT'
GO

-- =====================================================
-- ADIM 6: İstatistikleri güncelle
-- =====================================================

UPDATE STATISTICS AKTBLPTSMAS WITH FULLSCAN
UPDATE STATISTICS AKTBLPTSTRA WITH FULLSCAN
PRINT 'İstatistikler güncellendi'
GO

-- =====================================================
-- Sonuç kontrolü ve boyut karşılaştırması
-- =====================================================

SELECT 'Yeni Tablolar' as Durum
SELECT 'AKTBLPTSMAS' as Tablo, COUNT(*) as Kayit FROM AKTBLPTSMAS
UNION ALL
SELECT 'AKTBLPTSTRA' as Tablo, COUNT(*) as Kayit FROM AKTBLPTSTRA

SELECT 'Eski Tablolar' as Durum
SELECT 'AKTBLPTSMAS_OLD' as Tablo, COUNT(*) as Kayit FROM AKTBLPTSMAS_OLD
UNION ALL
SELECT 'AKTBLPTSTRA_OLD' as Tablo, COUNT(*) as Kayit FROM AKTBLPTSTRA_OLD

-- Boyut karşılaştırması
SELECT 
    t.name AS Tablo,
    SUM(a.total_pages) * 8 / 1024 AS TotalMB,
    SUM(a.used_pages) * 8 / 1024 AS UsedMB
FROM sys.tables t
INNER JOIN sys.indexes i ON t.object_id = i.object_id
INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
WHERE t.name IN ('AKTBLPTSMAS', 'AKTBLPTSTRA', 'AKTBLPTSMAS_OLD', 'AKTBLPTSTRA_OLD')
GROUP BY t.name
ORDER BY t.name

PRINT '=====================================================
Migration tamamlandı!

DEĞİŞİKLİKLER:
1. TRANSFER_ID: NVARCHAR(100) → BIGINT PRIMARY KEY
2. ID alanları kaldırıldı (gereksiz)
3. NVARCHAR → VARCHAR (yarı boyut)
4. XML_CONTENT kaldırıldı (153 MB kazanç)
5. Kolon boyutları gerçek verilere göre optimize edildi
6. Clustered index TRANSFER_ID üzerinde
7. Covering index''ler eklendi
8. ON DELETE CASCADE ile FK

TAHMİNİ KAZANÇ:
- ~%50 disk alanı tasarrufu (NVARCHAR → VARCHAR)
- ~153 MB XML_CONTENT kaldırıldı
- Daha hızlı sorgular (BIGINT karşılaştırması)

Kontrol ettikten sonra eski tabloları silebilirsiniz:
DROP TABLE AKTBLPTSTRA_OLD
DROP TABLE AKTBLPTSMAS_OLD
DROP TABLE AKTBLPTSTRA_BACKUP
DROP TABLE AKTBLPTSMAS_BACKUP
====================================================='

