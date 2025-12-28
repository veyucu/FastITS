# PTS Carrier Hiyerarşi Yapısı

## Tablo Yapısı: AKTBLPTSTRA

Bu tablo, PTS XML'lerindeki iç içe carrier (taşıyıcı) yapısını hiyerarşik olarak saklar.

### ⚠️ ÖNEMLİ: İki Tür Kayıt Vardır

1. **CARRIER Kayıtları** (Koli/Palet/Bağ):
   - `SERIAL_NUMBER` = NULL
   - Sadece carrier bilgileri (barkod, tip, parent)
   - Kullanıcı barkod okuttuğunda bu kayıtları arıyoruz

2. **ÜRÜN Kayıtları**:
   - `SERIAL_NUMBER` = DOLU
   - Ürün bilgileri + hangi carrier'da olduğu

### Kolonlar

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `ID` | INT | Primary Key, auto-increment |
| `TRANSFER_ID` | BIGINT | Transfer ID (Foreign Key -> AKTBLPTSMAS) |
| `CARRIER_LABEL` | NVARCHAR(100) | Bu carrier'ın barkod numarası (20 karakter SSCC) |
| `PARENT_CARRIER_LABEL` | NVARCHAR(100) | Üst carrier'ın barkodu (NULL ise root level) |
| `CONTAINER_TYPE` | NVARCHAR(10) | P:Palet, C:Koli, S:Bağ, B:Koli içi kutu, E:Küçük bağ |
| `CARRIER_LEVEL` | INT | Hiyerarşi seviyesi (1:Palet, 2:Koli, 3:Alt koli, vb.) |
| `GTIN` | NVARCHAR(50) | Ürün GTIN kodu |
| `SERIAL_NUMBER` | NVARCHAR(100) | Ürün seri numarası |
| `LOT_NUMBER` | NVARCHAR(50) | Lot numarası |
| `EXPIRATION_DATE` | DATE | Son kullanma tarihi |
| `PRODUCTION_DATE` | DATE | Üretim tarihi |
| `PO_NUMBER` | NVARCHAR(50) | Sipariş numarası |
| `CREATED_DATE` | DATETIME | Kayıt tarihi |

## Hiyerarşi Örneği

### Veritabanında Nasıl Saklanıyor:

| ID | CARRIER_LABEL | PARENT_CARRIER_LABEL | CONTAINER_TYPE | LEVEL | SERIAL_NUMBER | KAYIT_TIPI |
|----|---------------|---------------------|----------------|-------|---------------|------------|
| 1 | 00986995250252836254 | NULL | P | 1 | NULL | **CARRIER (Palet)** |
| 2 | 00286802350018802744 | 00986995250252836254 | C | 2 | NULL | **CARRIER (Koli 1)** |
| 3 | 00286802350018802744 | 00986995250252836254 | C | 2 | 98091004725302 | Ürün 1 |
| 4 | 00286802350018802744 | 00986995250252836254 | C | 2 | 98091004725303 | Ürün 2 |
| 5 | 00286802350018802744 | 00986995250252836254 | C | 2 | 98091004725304 | Ürün 3 |
| 6 | 00286802350018802745 | 00986995250252836254 | C | 2 | NULL | **CARRIER (Koli 2)** |
| 7 | 00286802350018802746 | 00286802350018802745 | C | 3 | NULL | **CARRIER (Alt Koli)** |
| 8 | 00286802350018802746 | 00286802350018802745 | C | 3 | 98091004725310 | Ürün 4 |

### Ağaç Görünümü:

```
📦 Palet: 00986995250252836254 [P] (Level 1)
    ├── 📦 Koli 1: 00286802350018802744 [C] (Level 2)
    │   ├── 💊 Ürün 1: 98091004725302
    │   ├── 💊 Ürün 2: 98091004725303
    │   └── 💊 Ürün 3: 98091004725304
    │
    └── 📦 Koli 2: 00286802350018802745 [C] (Level 2)
        └── 📦 Alt Koli: 00286802350018802746 [C] (Level 3)
            └── 💊 Ürün 4: 98091004725310
```

### ✅ Kullanıcı Senaryoları:

**Senaryo 1:** Kullanıcı **Palet barkodunu** okuttu (`00986995250252836254`)
- ✅ Sistem: ID=1 kaydını bulur (CARRIER kayıt)
- ✅ Alt tüm kolileri bulur (ID=2, 6, 7)
- ✅ Tüm ürünleri bulur (ID=3,4,5,8) → **4 ürün**

**Senaryo 2:** Kullanıcı **Koli 1 barkodunu** okuttu (`00286802350018802744`)
- ✅ Sistem: ID=2 kaydını bulur (CARRIER kayıt)
- ✅ Bu kolinin ürünlerini bulur (ID=3,4,5) → **3 ürün**

**Senaryo 3:** Kullanıcı **Koli 2 barkodunu** okuttu (`00286802350018802745`)
- ✅ Sistem: ID=6 kaydını bulur (CARRIER kayıt)
- ✅ Alt kolileri bulur (ID=7)
- ✅ Tüm ürünleri bulur (ID=8) → **1 ürün**

## Kullanım Senaryoları

### 1. KULLANICI BARKOD OKUTTU - İçindeki Tüm Ürünleri Getir

**⚠️ ÖNEMLİ:** Kullanıcı hangi barkodu okuttuğunu bilmiyoruz (Palet mi? Koli mi? Bağ mı?)
Sistem otomatik bulup içindeki tüm ürünleri getirecek.

```sql
-- ADIM 1: Okutulan barkodu bul
DECLARE @OkutulanBarkod NVARCHAR(100) = '00286802350018802744'  -- Kullanıcının okuttuğu

-- Önce bu barkodun carrier kayıt olup olmadığını kontrol et
SELECT TOP 1 
    CARRIER_LABEL,
    CONTAINER_TYPE,
    CARRIER_LEVEL,
    PARENT_CARRIER_LABEL
FROM AKTBLPTSTRA
WHERE CARRIER_LABEL = @OkutulanBarkod
  AND SERIAL_NUMBER IS NULL  -- CARRIER kaydı (ürün değil)

-- ADIM 2: Bu carrier ve altındaki TÜM ürünleri getir (Recursive)
;WITH CarrierHierarchy AS (
    -- Root: Okutulan carrier
    SELECT 
        ID, TRANSFER_ID, CARRIER_LABEL, PARENT_CARRIER_LABEL,
        CONTAINER_TYPE, CARRIER_LEVEL, GTIN, SERIAL_NUMBER,
        LOT_NUMBER, EXPIRATION_DATE, 0 AS DEPTH
    FROM AKTBLPTSTRA
    WHERE CARRIER_LABEL = @OkutulanBarkod
    
    UNION ALL
    
    -- Recursive: Alt carrier'lar VE ürünler
    SELECT 
        t.ID, t.TRANSFER_ID, t.CARRIER_LABEL, t.PARENT_CARRIER_LABEL,
        t.CONTAINER_TYPE, t.CARRIER_LEVEL, t.GTIN, t.SERIAL_NUMBER,
        t.LOT_NUMBER, t.EXPIRATION_DATE, ch.DEPTH + 1
    FROM AKTBLPTSTRA t
    INNER JOIN CarrierHierarchy ch ON t.PARENT_CARRIER_LABEL = ch.CARRIER_LABEL
)
SELECT 
    SERIAL_NUMBER,
    GTIN,
    LOT_NUMBER,
    EXPIRATION_DATE,
    CARRIER_LABEL AS BULUNDUGU_CARRIER,
    CONTAINER_TYPE,
    DEPTH
FROM CarrierHierarchy
WHERE SERIAL_NUMBER IS NOT NULL  -- Sadece ürünleri getir (satış için)
ORDER BY DEPTH, CARRIER_LEVEL

-- SONUÇ: Bu carrier'ın içindeki TÜM ürünler (alt koliler dahil)
```

### 2. Belirli Bir Transferdeki Tüm Carrier Hiyerarşisini Görüntüleme

```sql
SELECT 
    REPLICATE('  ', CARRIER_LEVEL - 1) + CARRIER_LABEL AS HIERARCHY,
    CONTAINER_TYPE,
    CARRIER_LEVEL,
    COUNT(CASE WHEN SERIAL_NUMBER IS NOT NULL THEN 1 END) AS PRODUCT_COUNT
FROM AKTBLPTSTRA
WHERE TRANSFER_ID = 63396796465
GROUP BY CARRIER_LABEL, PARENT_CARRIER_LABEL, CONTAINER_TYPE, CARRIER_LEVEL
ORDER BY CARRIER_LEVEL, CARRIER_LABEL
```

### 3. Bir Palet İçindeki Koli Sayısını Bulma

```sql
SELECT 
    p.CARRIER_LABEL AS PALET,
    COUNT(DISTINCT c.CARRIER_LABEL) AS KOLI_SAYISI
FROM AKTBLPTSTRA p
LEFT JOIN AKTBLPTSTRA c ON c.PARENT_CARRIER_LABEL = p.CARRIER_LABEL
WHERE p.CONTAINER_TYPE = 'P'
  AND p.TRANSFER_ID = 63396796465
GROUP BY p.CARRIER_LABEL
```

### 4. Belirli Bir Kolinin Hangi Palet İçinde Olduğunu Bulma

```sql
WITH CarrierPath AS (
    -- Root: Aranan koli
    SELECT 
        CARRIER_LABEL,
        PARENT_CARRIER_LABEL,
        CONTAINER_TYPE,
        CARRIER_LEVEL,
        CAST(CARRIER_LABEL AS NVARCHAR(500)) AS PATH
    FROM AKTBLPTSTRA
    WHERE CARRIER_LABEL = '00286802350018802744'
    
    UNION ALL
    
    -- Parent'a çık
    SELECT 
        p.CARRIER_LABEL,
        p.PARENT_CARRIER_LABEL,
        p.CONTAINER_TYPE,
        p.CARRIER_LEVEL,
        CAST(p.CARRIER_LABEL + ' -> ' + cp.PATH AS NVARCHAR(500))
    FROM AKTBLPTSTRA p
    INNER JOIN CarrierPath cp ON p.CARRIER_LABEL = cp.PARENT_CARRIER_LABEL
)
SELECT TOP 1
    CARRIER_LABEL AS PALET,
    PATH AS FULL_PATH
FROM CarrierPath
WHERE CONTAINER_TYPE = 'P'
ORDER BY CARRIER_LEVEL
```

## API Endpoint'leri

### 1. Carrier Label ile Ürünleri Getir
```
GET /api/pts/carrier/:carrierLabel
```

**Örnek:**
```javascript
const response = await apiService.getProductsByCarrier('00286802350018802744')
// Returns: {
//   success: true,
//   data: {
//     carrierLabel: '00286802350018802744',
//     totalProducts: 25,
//     totalCarriers: 3,
//     products: [...],
//     carrierTree: [...]
//   }
// }
```

### 2. Transfer ID ve Carrier Label ile Detay
```
GET /api/pts/carrier-details/:transferId/:carrierLabel
```

**Örnek:**
```javascript
const response = await apiService.getCarrierDetails('63396796465', '00286802350018802744')
```

## Container Type Kodları

| Kod | Anlamı | Açıklama |
|-----|--------|----------|
| `P` | Palet | En üst seviye taşıyıcı |
| `C` | Koli | Koliler |
| `S` | Bağ | Ürün bağları |
| `B` | Koli içi kutu | Koli içindeki daha küçük kutular |
| `E` | Küçük bağ | Küçük ürün bağları |

## Önemli Notlar

1. **CARRIER_LABEL:** Tam 20 karakter uzunlukta olmalıdır. Doldurma karakterleri içermemelidir.
2. **Root Level:** PARENT_CARRIER_LABEL NULL olan kayıtlar root level'dır (genellikle paletler).
3. **SERIAL_NUMBER:** Sadece ürün kayıtlarında dolu olur. Carrier kayıtlarında NULL'dur.
4. **Recursive Query:** Alt carrier'ları bulmak için SQL'de CTE (Common Table Expression) kullanılır.

## Migration

Mevcut tabloyu yeni yapıya güncellemek için:

```sql
-- Migration script'i çalıştır
sqlcmd -S NB2 -d MUHASEBE2025 -U sa -P sapass1* -i migrate_pts_tables.sql
```

Ya da backend'i yeniden başlatın, otomatik olarak yeni yapıda oluşturulacaktır.

