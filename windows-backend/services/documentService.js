import { getConnection } from '../config/database.js'
import iconv from 'iconv-lite'

// Türkçe karakter düzeltme fonksiyonu - SQL Server CP1254 to UTF-8
const fixTurkishChars = (str) => {
  if (!str || typeof str !== 'string') return str
  
  try {
    let fixed = str
    
    // SQL Server'dan gelen yanlış encoded metni düzelt
    // CP1254 (Turkish) -> UTF-8 dönüşümü
    try {
      // Önce latin1 olarak encode edip cp1254 olarak decode et
      const buf = Buffer.from(fixed, 'latin1')
      fixed = iconv.decode(buf, 'cp1254')
    } catch (e) {
      console.log('iconv dönüşüm hatası:', e.message)
    }
    
    // Hala ? veya bozuk karakterler varsa manuel düzelt
    if (fixed.includes('?') || fixed.match(/[\u0080-\u00FF]/)) {
      // Karakter karakter düzeltme - SQL Server'dan gelen bozuk karakterler
      const charMap = {
        // UTF-8 çift byte sorunları
        'Ä°': 'İ', 'Ä±': 'ı',
        'ÅŸ': 'ş', 'Åž': 'Ş',
        'Ã§': 'ç', 'Ã‡': 'Ç',
        'ÄŸ': 'ğ', 'Äž': 'Ğ',
        'Ã¼': 'ü', 'Ãœ': 'Ü',
        'Ã¶': 'ö', 'Ã–': 'Ö',
        'Â': '',
        '�': '',
        // Single character replacements from CP1254
        '\u00DD': 'İ', // İ
        '\u00FD': 'ı', // ı  
        '\u00DE': 'Ş', // Ş
        '\u00FE': 'ş', // ş
        '\u00D0': 'Ğ', // Ğ
        '\u00F0': 'ğ', // ğ
      }
      
      for (const [wrong, correct] of Object.entries(charMap)) {
        fixed = fixed.split(wrong).join(correct)
      }
    }
    
    // ? karakteri context'e göre düzelt
    // Türkçe kelimelerde ? genelde şu karakterlerdir: ğ, ı, ş, ç, ö, ü, İ
    fixed = fixed
      .replace(/\?([AEIOU])/g, 'İ$1') // ?A, ?E -> İA, İE (ISTANBUL -> İSTANBUL)
      .replace(/([BCDFGHJKLMNPQRSTVWXYZ])\?/g, '$1İ') // Y? -> Yİ (KAYSER? -> KAYSERİ)
      .replace(/\?([bcdfghjklmnpqrstvwxyz])/g, 'ı$1') // ?n -> ın
      .replace(/([bcdfghjklmnpqrstvwxyz])\?([aeiou])/g, '$1ı$2') // n?a -> nıa
    
    // Başındaki nokta ve gereksiz boşlukları temizle
    fixed = fixed.replace(/^\.+/, '').trim()
    
    return fixed
  } catch (error) {
    console.error('Türkçe karakter düzeltme hatası:', error)
    return str
  }
}

// Objedeki tüm string alanları düzelt
const fixObjectStrings = (obj) => {
  if (!obj) return obj
  
  const fixed = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      fixed[key] = fixTurkishChars(value)
    } else if (Array.isArray(value)) {
      fixed[key] = value.map(item => 
        typeof item === 'object' ? fixObjectStrings(item) : 
        typeof item === 'string' ? fixTurkishChars(item) : item
      )
    } else if (typeof value === 'object' && value !== null) {
      fixed[key] = fixObjectStrings(value)
    } else {
      fixed[key] = value
    }
  }
  return fixed
}

const documentService = {
  // Tüm belgeleri getir (tarih filtreli - zorunlu)
  async getAllDocuments(date) {
    try {
      const pool = await getConnection()
      
      // Tarih zorunlu
      if (!date) {
        throw new Error('Tarih filtresi zorunludur')
      }
      
      // Filtre WHERE koşulları
      const additionalWhere = ` AND CAST(V.TARIH AS DATE) = @filterDate`
      const params = { filterDate: date }
      
      const query = `
        SELECT
          V.SUBE_KODU,
          V.FTIRSIP,
          V.TIPI,
          V.FATIRS_NO,
          V.TARIH,
          V.KALEM,
          V.CARI_KODU,
          C.CARI_ISIM,
          C.CARI_ILCE,
          C.CARI_IL,
          C.CARI_TEL AS TEL,
          C.EMAIL AS GLN,
          CE.KULL3S AS UTS_NO,
          (CASE WHEN ISNULL(C.VERGI_NUMARASI,'')='' THEN CE.TCKIMLIKNO ELSE C.VERGI_NUMARASI END) AS VKN,
          CAST(V.KAYITTARIHI AS DATETIME) AS KAYIT_TARIHI,
          V.MIKTAR,
          ISNULL(V.OKUTULAN,0) AS OKUTULAN,
          V.MIKTAR - ISNULL(V.OKUTULAN,0) AS KALAN,
          V.ITS_COUNT,
          V.UTS_COUNT,
          V.DGR_COUNT
        FROM
        (
          SELECT 
            A.SUBE_KODU,
            A.FTIRSIP,
            A.TIPI,
            A.FATIRS_NO,
            A.TARIH,
            A.FATKALEM_ADEDI AS KALEM,
            A.CARI_KODU,
            A.KAYITTARIHI,
            (SELECT SUM(STHAR_GCMIK) FROM TBLSIPATRA X WITH (NOLOCK) WHERE X.FISNO=A.FATIRS_NO AND X.SUBE_KODU=A.SUBE_KODU AND X.STHAR_ACIKLAMA=A.CARI_KODU AND X.STHAR_FTIRSIP=A.FTIRSIP) AS MIKTAR,
            (SELECT SUM(Y.MIKTAR) FROM TBLSIPATRA X WITH (NOLOCK) INNER JOIN TBLSERITRA Y WITH (NOLOCK) ON (X.FISNO = Y.BELGENO AND X.INCKEYNO = Y.STRA_INC AND X.STOK_KODU=Y.STOK_KODU AND X.STHAR_HTUR = Y.BELGETIP AND X.SUBE_KODU=Y.SUBE_KODU AND Y.KAYIT_TIPI='M' AND X.STHAR_GCKOD=Y.GCKOD)
            WHERE X.FISNO=A.FATIRS_NO AND X.SUBE_KODU=A.SUBE_KODU AND X.STHAR_ACIKLAMA=A.CARI_KODU AND X.STHAR_FTIRSIP=A.FTIRSIP) AS OKUTULAN,
            (SELECT COUNT(*) FROM TBLSIPATRA H WITH (NOLOCK) INNER JOIN TBLSTSABIT S WITH (NOLOCK) ON H.STOK_KODU=S.STOK_KODU WHERE H.FISNO=A.FATIRS_NO AND H.SUBE_KODU=A.SUBE_KODU AND H.STHAR_ACIKLAMA=A.CARI_KODU AND H.STHAR_FTIRSIP=A.FTIRSIP AND S.KOD_5='BESERI') AS ITS_COUNT,
            (SELECT COUNT(*) FROM TBLSIPATRA H WITH (NOLOCK) INNER JOIN TBLSTSABIT S WITH (NOLOCK) ON H.STOK_KODU=S.STOK_KODU WHERE H.FISNO=A.FATIRS_NO AND H.SUBE_KODU=A.SUBE_KODU AND H.STHAR_ACIKLAMA=A.CARI_KODU AND H.STHAR_FTIRSIP=A.FTIRSIP AND S.KOD_5='UTS') AS UTS_COUNT,
            (SELECT COUNT(*) FROM TBLSIPATRA H WITH (NOLOCK) INNER JOIN TBLSTSABIT S WITH (NOLOCK) ON H.STOK_KODU=S.STOK_KODU WHERE H.FISNO=A.FATIRS_NO AND H.SUBE_KODU=A.SUBE_KODU AND H.STHAR_ACIKLAMA=A.CARI_KODU AND H.STHAR_FTIRSIP=A.FTIRSIP AND (S.KOD_5 IS NULL OR S.KOD_5 NOT IN ('BESERI','UTS'))) AS DGR_COUNT
          FROM 
            TBLSIPAMAS A WITH (NOLOCK)
          WHERE FTIRSIP='6' ${additionalWhere.replace('V.TARIH', 'A.TARIH')}
          
          UNION ALL
          
          SELECT
            A.SUBE_KODU,
            A.FTIRSIP,
            A.TIPI,
            A.FATIRS_NO,
            A.TARIH,
            A.FATKALEM_ADEDI AS KALEM,
            A.CARI_KODU,
            A.KAYITTARIHI,
            (SELECT SUM(STHAR_GCMIK) FROM TBLSTHAR X WITH (NOLOCK) WHERE X.FISNO=A.FATIRS_NO AND X.SUBE_KODU=A.SUBE_KODU AND X.STHAR_ACIKLAMA=A.CARI_KODU AND X.STHAR_FTIRSIP=A.FTIRSIP) AS MIKTAR,
            (SELECT SUM(Y.MIKTAR) FROM TBLSTHAR X WITH (NOLOCK) INNER JOIN TBLSERITRA Y WITH (NOLOCK) ON (X.FISNO = Y.BELGENO AND X.INCKEYNO = Y.STRA_INC AND X.STOK_KODU=Y.STOK_KODU AND X.STHAR_HTUR = Y.BELGETIP AND X.SUBE_KODU=Y.SUBE_KODU AND Y.KAYIT_TIPI='A' AND X.STHAR_GCKOD=Y.GCKOD)
            WHERE X.FISNO=A.FATIRS_NO AND X.SUBE_KODU=A.SUBE_KODU AND X.STHAR_ACIKLAMA=A.CARI_KODU AND X.STHAR_FTIRSIP=A.FTIRSIP) AS OKUTULAN,
            (SELECT COUNT(*) FROM TBLSTHAR H WITH (NOLOCK) INNER JOIN TBLSTSABIT S WITH (NOLOCK) ON H.STOK_KODU=S.STOK_KODU WHERE H.FISNO=A.FATIRS_NO AND H.SUBE_KODU=A.SUBE_KODU AND H.STHAR_ACIKLAMA=A.CARI_KODU AND H.STHAR_FTIRSIP=A.FTIRSIP AND S.KOD_5='BESERI') AS ITS_COUNT,
            (SELECT COUNT(*) FROM TBLSTHAR H WITH (NOLOCK) INNER JOIN TBLSTSABIT S WITH (NOLOCK) ON H.STOK_KODU=S.STOK_KODU WHERE H.FISNO=A.FATIRS_NO AND H.SUBE_KODU=A.SUBE_KODU AND H.STHAR_ACIKLAMA=A.CARI_KODU AND H.STHAR_FTIRSIP=A.FTIRSIP AND S.KOD_5='UTS') AS UTS_COUNT,
            (SELECT COUNT(*) FROM TBLSTHAR H WITH (NOLOCK) INNER JOIN TBLSTSABIT S WITH (NOLOCK) ON H.STOK_KODU=S.STOK_KODU WHERE H.FISNO=A.FATIRS_NO AND H.SUBE_KODU=A.SUBE_KODU AND H.STHAR_ACIKLAMA=A.CARI_KODU AND H.STHAR_FTIRSIP=A.FTIRSIP AND (S.KOD_5 IS NULL OR S.KOD_5 NOT IN ('BESERI','UTS'))) AS DGR_COUNT
          FROM 
            TBLFATUIRS A WITH (NOLOCK)
          WHERE A.FTIRSIP IN ('1','2') ${additionalWhere.replace('V.TARIH', 'A.TARIH')}
        ) AS V
        LEFT JOIN
          TBLFATUEK E
          ON (V.FATIRS_NO=E.FATIRSNO AND V.SUBE_KODU=E.SUBE_KODU AND V.FTIRSIP=E.FKOD AND V.CARI_KODU=E.CKOD)
        INNER JOIN
          TBLCASABIT C
          ON (V.CARI_KODU=C.CARI_KOD)
        INNER JOIN
          TBLCASABITEK CE WITH (NOLOCK)
          ON (V.CARI_KODU=CE.CARI_KOD)
        ORDER BY V.TARIH DESC, V.FATIRS_NO DESC
      `
      
      // Parametreleri ekle
      const request = pool.request()
      request.input('filterDate', params.filterDate)
      
      const result = await request.query(query)
      
      // Veriyi frontend için uygun formata çevir
      const documents = result.recordset.map((row, index) => {
        // Türkçe karakterleri önce düzelt (SQL'den gelen raw data)
        const fixedRow = {
          SUBE_KODU: row.SUBE_KODU,
          FTIRSIP: row.FTIRSIP,
          TIPI: row.TIPI,
          FATIRS_NO: row.FATIRS_NO,
          TARIH: row.TARIH,
          KALEM: row.KALEM,
          CARI_KODU: row.CARI_KODU,
          CARI_ISIM: fixTurkishChars(row.CARI_ISIM),
          CARI_ILCE: fixTurkishChars(row.CARI_ILCE),
          CARI_IL: fixTurkishChars(row.CARI_IL),
          TEL: row.TEL,
          GLN: row.GLN,
          UTS_NO: row.UTS_NO,
          VKN: row.VKN,
          KAYIT_TARIHI: row.KAYIT_TARIHI,
          MIKTAR: row.MIKTAR,
          OKUTULAN: row.OKUTULAN,
          KALAN: row.KALAN,
          ITS_COUNT: row.ITS_COUNT || 0,
          UTS_COUNT: row.UTS_COUNT || 0,
          DGR_COUNT: row.DGR_COUNT || 0
        }
        
        
        const doc = {
          id: `${fixedRow.SUBE_KODU}-${fixedRow.FTIRSIP}-${fixedRow.FATIRS_NO}`,
          subeKodu: fixedRow.SUBE_KODU,
          docType: fixedRow.FTIRSIP,
          tipi: fixedRow.TIPI,
          orderNo: fixedRow.FATIRS_NO,
          orderDate: fixedRow.TARIH,
          totalItems: fixedRow.KALEM || 0,
          itsCount: fixedRow.ITS_COUNT,
          utsCount: fixedRow.UTS_COUNT,
          dgrCount: fixedRow.DGR_COUNT,
          customerCode: fixedRow.CARI_KODU,
          customerName: fixedRow.CARI_ISIM,
          district: fixedRow.CARI_ILCE,
          city: fixedRow.CARI_IL,
          phone: fixedRow.TEL,
          email: fixedRow.GLN,
          utsNo: fixedRow.UTS_NO,
          vkn: fixedRow.VKN,
          kayitTarihi: fixedRow.KAYIT_TARIHI ? fixedRow.KAYIT_TARIHI.toISOString() : null,
          miktar: fixedRow.MIKTAR || 0,
          okutulan: fixedRow.OKUTULAN || 0,
          kalan: fixedRow.KALAN || 0,
          preparedItems: fixedRow.OKUTULAN || 0,
          status: fixedRow.OKUTULAN === 0 ? 'pending' : 
                  fixedRow.OKUTULAN < fixedRow.MIKTAR ? 'preparing' : 'completed'
        }
        
        return doc
      })
      
      return documents
    } catch (error) {
      console.error('Belgeler getirme hatası:', error)
      throw error
    }
  },

  // Belirli bir belgeyi getir
  async getDocumentById(subeKodu, ftirsip, fatirs_no) {
    try {
      console.log('📄 getDocumentById çağrıldı:', { subeKodu, ftirsip, fatirs_no })
      const pool = await getConnection()
      
      // Belge detayı için sorgu
      const detailQuery = `
        SELECT
          V.SUBE_KODU,
          V.FTIRSIP,
          V.TIPI,
          V.FATIRS_NO,
          V.TARIH,
          V.KALEM,
          V.CARI_KODU,
          C.CARI_ISIM,
          C.CARI_ILCE,
          C.CARI_IL,
          C.CARI_TEL AS TEL,
          C.EMAIL AS GLN,
          CE.KULL3S AS UTS_NO,
          (CASE WHEN ISNULL(C.VERGI_NUMARASI,'')='' THEN CE.TCKIMLIKNO ELSE C.VERGI_NUMARASI END) AS VKN,
          CAST(V.KAYITTARIHI AS DATETIME) AS KAYIT_TARIHI,
          V.MIKTAR,
          ISNULL(V.OKUTULAN,0) AS OKUTULAN,
          V.MIKTAR - ISNULL(V.OKUTULAN,0) AS KALAN
        FROM
        (
          SELECT 
            A.SUBE_KODU,
            A.FTIRSIP,
            A.TIPI,
            A.FATIRS_NO,
            A.TARIH,
            A.FATKALEM_ADEDI AS KALEM,
            A.CARI_KODU,
            A.KAYITTARIHI,
            (SELECT SUM(STHAR_GCMIK) FROM TBLSIPATRA X WITH (NOLOCK) WHERE X.FISNO=A.FATIRS_NO AND X.SUBE_KODU=A.SUBE_KODU AND X.STHAR_ACIKLAMA=A.CARI_KODU AND X.STHAR_FTIRSIP=A.FTIRSIP) AS MIKTAR,
            (SELECT SUM(Y.MIKTAR) FROM TBLSIPATRA X WITH (NOLOCK) INNER JOIN TBLSERITRA Y WITH (NOLOCK) ON (X.FISNO = Y.BELGENO AND X.INCKEYNO = Y.STRA_INC AND X.STOK_KODU=Y.STOK_KODU AND X.STHAR_HTUR = Y.BELGETIP AND X.SUBE_KODU=Y.SUBE_KODU AND Y.KAYIT_TIPI='M' AND X.STHAR_GCKOD=Y.GCKOD)
            WHERE X.FISNO=A.FATIRS_NO AND X.SUBE_KODU=A.SUBE_KODU AND X.STHAR_ACIKLAMA=A.CARI_KODU AND X.STHAR_FTIRSIP=A.FTIRSIP) AS OKUTULAN
          FROM 
            TBLSIPAMAS A WITH (NOLOCK)
          WHERE A.SUBE_KODU=@subeKodu AND A.FTIRSIP=@ftirsip AND A.FATIRS_NO=@fatirs_no
          
          UNION ALL
          
          SELECT
            A.SUBE_KODU,
            A.FTIRSIP,
            A.TIPI,
            A.FATIRS_NO,
            A.TARIH,
            A.FATKALEM_ADEDI AS KALEM,
            A.CARI_KODU,
            A.KAYITTARIHI,
            (SELECT SUM(STHAR_GCMIK) FROM TBLSTHAR X WITH (NOLOCK) WHERE X.FISNO=A.FATIRS_NO AND X.SUBE_KODU=A.SUBE_KODU AND X.STHAR_ACIKLAMA=A.CARI_KODU AND X.STHAR_FTIRSIP=A.FTIRSIP) AS MIKTAR,
            (SELECT SUM(Y.MIKTAR) FROM TBLSTHAR X WITH (NOLOCK) INNER JOIN TBLSERITRA Y WITH (NOLOCK) ON (X.FISNO = Y.BELGENO AND X.INCKEYNO = Y.STRA_INC AND X.STOK_KODU=Y.STOK_KODU AND X.STHAR_HTUR = Y.BELGETIP AND X.SUBE_KODU=Y.SUBE_KODU AND Y.KAYIT_TIPI='A' AND X.STHAR_GCKOD=Y.GCKOD)
            WHERE X.FISNO=A.FATIRS_NO AND X.SUBE_KODU=A.SUBE_KODU AND X.STHAR_ACIKLAMA=A.CARI_KODU AND X.STHAR_FTIRSIP=A.FTIRSIP) AS OKUTULAN
          FROM 
            TBLFATUIRS A WITH (NOLOCK)
          WHERE A.SUBE_KODU=@subeKodu AND A.FTIRSIP=@ftirsip AND A.FATIRS_NO=@fatirs_no
        ) AS V
        LEFT JOIN
          TBLFATUEK E
          ON (V.FATIRS_NO=E.FATIRSNO AND V.SUBE_KODU=E.SUBE_KODU AND V.FTIRSIP=E.FKOD AND V.CARI_KODU=E.CKOD)
        INNER JOIN
          TBLCASABIT C
          ON (V.CARI_KODU=C.CARI_KOD)
        INNER JOIN
          TBLCASABITEK CE WITH (NOLOCK)
          ON (V.CARI_KODU=CE.CARI_KOD)
      `
      
      const request = pool.request()
      request.input('subeKodu', subeKodu)
      request.input('ftirsip', ftirsip)
      request.input('fatirs_no', fatirs_no)
      
      const result = await request.query(detailQuery)
      console.log('📊 SQL Sonuç sayısı:', result.recordset.length)
      
      if (result.recordset.length === 0) {
        console.log('❌ Belge bulunamadı')
        return null
      }
      
      const row = result.recordset[0]
      console.log('✅ Belge bulundu:', { FATIRS_NO: row.FATIRS_NO, CARI_ISIM: row.CARI_ISIM })
      
      // Belge kalemlerini getir
      const items = await this.getDocumentItems(subeKodu, ftirsip, fatirs_no, row.CARI_KODU)
      console.log('📦 Kalem sayısı:', items.length)
      
      // Türkçe karakterleri düzelt
      const fixedRow = {
        SUBE_KODU: row.SUBE_KODU,
        FTIRSIP: row.FTIRSIP,
        TIPI: row.TIPI,
        FATIRS_NO: row.FATIRS_NO,
        TARIH: row.TARIH,
        KALEM: row.KALEM,
        CARI_KODU: row.CARI_KODU,
        CARI_ISIM: fixTurkishChars(row.CARI_ISIM),
        CARI_ILCE: fixTurkishChars(row.CARI_ILCE),
        CARI_IL: fixTurkishChars(row.CARI_IL),
        TEL: row.TEL,
        GLN: row.GLN,
        UTS_NO: row.UTS_NO,
        VKN: row.VKN,
        KAYIT_TARIHI: row.KAYIT_TARIHI,
        MIKTAR: row.MIKTAR,
        OKUTULAN: row.OKUTULAN,
        KALAN: row.KALAN
      }
      
      const document = {
        id: `${fixedRow.SUBE_KODU}-${fixedRow.FTIRSIP}-${fixedRow.FATIRS_NO}`,
        subeKodu: fixedRow.SUBE_KODU,
        docType: fixedRow.FTIRSIP,
        tipi: fixedRow.TIPI,
        orderNo: fixedRow.FATIRS_NO,
        orderDate: fixedRow.TARIH,
        totalItems: fixedRow.KALEM || 0,
        customerCode: fixedRow.CARI_KODU,
        customerName: fixedRow.CARI_ISIM,
        district: fixedRow.CARI_ILCE,
        city: fixedRow.CARI_IL,
        phone: fixedRow.TEL,
        email: fixedRow.GLN,
        utsNo: fixedRow.UTS_NO,
        vkn: fixedRow.VKN,
        kayitTarihi: fixedRow.KAYIT_TARIHI ? fixedRow.KAYIT_TARIHI.toISOString() : null,
        miktar: fixedRow.MIKTAR || 0,
        okutulan: fixedRow.OKUTULAN || 0,
        kalan: fixedRow.KALAN || 0,
        preparedItems: fixedRow.OKUTULAN || 0,
        status: fixedRow.OKUTULAN === 0 ? 'pending' : 
                fixedRow.OKUTULAN < fixedRow.MIKTAR ? 'preparing' : 'completed',
        items: items
      }
      
      return document
    } catch (error) {
      console.error('Belge detay getirme hatası:', error)
      throw error
    }
  },

  // Belge kalemlerini getir
  async getDocumentItems(subeKodu, ftirsip, fatirs_no, cariKodu) {
    try {
      const pool = await getConnection()
      
      let itemsQuery = ''
      
      if (ftirsip === '6') {
        // Sipariş kalemleri
        itemsQuery = `
          SELECT
            H.STOK_KODU,
            S.STOK_ADI,
            (CASE WHEN S.KOD_5='BESERI' THEN 'ITS' WHEN S.KOD_5='UTS' THEN 'UTS' ELSE 'DGR' END) AS TURU,
            H.STHAR_GCMIK AS MIKTAR,
            H.INCKEYNO,
            H.STHAR_HTUR,
            H.STHAR_GCKOD,
            ISNULL((SELECT SUM(Y.MIKTAR) FROM TBLSERITRA Y WITH (NOLOCK) 
                    WHERE H.FISNO=Y.BELGENO 
                    AND H.STHAR_HTUR=Y.BELGETIP 
                    AND H.SUBE_KODU=Y.SUBE_KODU 
                    AND Y.KAYIT_TIPI='M' 
                    AND H.STHAR_GCKOD=Y.GCKOD
                    AND Y.STRA_INC=H.INCKEYNO), 0) AS OKUTULAN
          FROM TBLSIPATRA H WITH (NOLOCK)
          INNER JOIN TBLSTSABIT S WITH (NOLOCK) ON (H.STOK_KODU=S.STOK_KODU)
          INNER JOIN TBLSTSABITEK SE WITH (NOLOCK) ON (S.STOK_KODU=SE.STOK_KODU)
          WHERE H.SUBE_KODU = @subeKodu 
            AND H.FISNO = @fatirs_no 
            AND H.STHAR_ACIKLAMA = @cariKodu 
            AND H.STHAR_FTIRSIP = @ftirsip
          ORDER BY H.INCKEYNO
        `
      } else {
        // Fatura kalemleri
        itemsQuery = `
          SELECT
            H.STOK_KODU,
            S.STOK_ADI,
            (CASE WHEN S.KOD_5='BESERI' THEN 'ITS' WHEN S.KOD_5='UTS' THEN 'UTS' ELSE 'DGR' END) AS TURU,
            H.STHAR_GCMIK AS MIKTAR,
            H.INCKEYNO,
            H.STHAR_HTUR,
            H.STHAR_GCKOD,
            ISNULL((SELECT SUM(Y.MIKTAR) FROM TBLSERITRA Y WITH (NOLOCK) 
                    WHERE H.FISNO=Y.BELGENO 
                    AND H.STHAR_HTUR=Y.BELGETIP 
                    AND H.SUBE_KODU=Y.SUBE_KODU 
                    AND Y.KAYIT_TIPI='A' 
                    AND H.STHAR_GCKOD=Y.GCKOD
                    AND Y.STRA_INC=H.INCKEYNO), 0) AS OKUTULAN
          FROM TBLSTHAR H WITH (NOLOCK)
          INNER JOIN TBLSTSABIT S WITH (NOLOCK) ON (H.STOK_KODU=S.STOK_KODU)
          INNER JOIN TBLSTSABITEK SE WITH (NOLOCK) ON (S.STOK_KODU=SE.STOK_KODU)
          WHERE H.SUBE_KODU = @subeKodu 
            AND H.FISNO = @fatirs_no 
            AND H.STHAR_ACIKLAMA = @cariKodu 
            AND H.STHAR_FTIRSIP = @ftirsip
          ORDER BY H.INCKEYNO
        `
      }
      
      const request = pool.request()
      request.input('subeKodu', subeKodu)
      request.input('ftirsip', ftirsip)
      request.input('fatirs_no', fatirs_no)
      request.input('cariKodu', cariKodu)
      
      const result = await request.query(itemsQuery)
      
      const items = result.recordset.map(row => ({
        itemId: row.INCKEYNO,
        stokKodu: row.STOK_KODU,
        productName: fixTurkishChars(row.STOK_ADI), // Türkçe karakter düzelt
        barcode: row.STOK_KODU, // Barkod olarak stok kodu kullanılıyor
        quantity: row.MIKTAR,
        unit: 'ADET', // Sabit birim
        turu: row.TURU, // ITS, UTS veya DGR
        okutulan: row.OKUTULAN || 0,
        isPrepared: row.OKUTULAN >= row.MIKTAR,
        stharHtur: row.STHAR_HTUR, // ITS için gerekli
        stharGckod: row.STHAR_GCKOD // ITS için gerekli
      }))
      
      return items
    } catch (error) {
      console.error('Belge kalemleri getirme hatası:', error)
      throw error
    }
  },

  // TBLSERITRA Kayıtlarını Getir (Belirli bir kalem için) - ITS
  async getITSBarcodeRecords(subeKodu, belgeNo, straInc, kayitTipi) {
    try {
      const pool = await getConnection()
      
      const query = `
        SELECT
          SERI_NO,
          STOK_KODU,
          STRA_INC,
          TARIH,
          ACIK1 AS MIAD,
          ACIK2 AS LOT,
          GCKOD,
          MIKTAR,
          BELGENO,
          BELGETIP,
          SUBE_KODU,
          ILC_GTIN AS BARKOD,
          KAYIT_TIPI
        FROM TBLSERITRA WITH (NOLOCK)
        WHERE SUBE_KODU = @subeKodu
          AND BELGENO = @belgeNo
          AND STRA_INC = @straInc
          AND KAYIT_TIPI = @kayitTipi
        ORDER BY SERI_NO
      `
      
      const request = pool.request()
      request.input('subeKodu', subeKodu)
      request.input('belgeNo', belgeNo)
      request.input('straInc', straInc)
      request.input('kayitTipi', kayitTipi)
      
      const result = await request.query(query)
      
      const records = result.recordset.map(row => ({
        seriNo: row.SERI_NO,
        stokKodu: row.STOK_KODU,
        barkod: row.BARKOD,
        miad: row.MIAD,
        lot: row.LOT,
        miktar: row.MIKTAR,
        tarih: row.TARIH,
        gckod: row.GCKOD,
        belgeTip: row.BELGETIP
      }))
      
      return records
    } catch (error) {
      console.error('❌ ITS Kayıtları Getirme Hatası:', error)
      throw error
    }
  },

  // TBLSERITRA Kayıtlarını Getir (Belirli bir kalem için) - UTS
  async getUTSBarcodeRecords(subeKodu, belgeNo, straInc, kayitTipi) {
    try {
      const pool = await getConnection()
      
      const query = `
        SELECT
          SIRA_NO,
          SERI_NO,
          STOK_KODU,
          STRA_INC,
          TARIH,
          ACIK1 AS URETIM_TARIHI,
          ACIK2 AS LOT,
          GCKOD,
          MIKTAR,
          BELGENO,
          BELGETIP,
          SUBE_KODU,
          ILC_GTIN AS BARKOD,
          KAYIT_TIPI
        FROM TBLSERITRA WITH (NOLOCK)
        WHERE SUBE_KODU = @subeKodu
          AND BELGENO = @belgeNo
          AND STRA_INC = @straInc
          AND KAYIT_TIPI = @kayitTipi
        ORDER BY SIRA_NO
      `
      
      const request = pool.request()
      request.input('subeKodu', subeKodu)
      request.input('belgeNo', belgeNo)
      request.input('straInc', straInc)
      request.input('kayitTipi', kayitTipi)
      
      const result = await request.query(query)
      
      const records = result.recordset.map(row => ({
        siraNo: row.SIRA_NO, // Primary key - otomatik artan
        // Eğer hem SERI_NO hem LOT doluysa: seriNo = SERI_NO, lot = LOT
        // Eğer sadece SERI_NO dolu, LOT boş ise: seriNo = '', lot = SERI_NO
        seriNo: row.LOT ? row.SERI_NO : '', // LOT varsa SERI_NO göster, yoksa boş
        lot: row.LOT || row.SERI_NO, // LOT varsa LOT, yoksa SERI_NO
        stokKodu: row.STOK_KODU,
        barkod: row.BARKOD,
        uretimTarihi: row.URETIM_TARIHI, // YYMMDD formatında
        miktar: row.MIKTAR,
        tarih: row.TARIH,
        gckod: row.GCKOD,
        belgeTip: row.BELGETIP
      }))
      
      return records
    } catch (error) {
      console.error('❌ UTS Kayıtları Getirme Hatası:', error)
      throw error
    }
  },

  // TBLSERITRA Kayıtlarını Sil - ITS
  async deleteITSBarcodeRecords(seriNos, subeKodu, belgeNo, straInc) {
    try {
      const pool = await getConnection()
      
      // Seri numaralarını tek tek sil
      for (const seriNo of seriNos) {
        const query = `
          DELETE FROM TBLSERITRA
          WHERE SUBE_KODU = @subeKodu
            AND BELGENO = @belgeNo
            AND STRA_INC = @straInc
            AND SERI_NO = @seriNo
        `
        
        const request = pool.request()
        request.input('subeKodu', subeKodu)
        request.input('belgeNo', belgeNo)
        request.input('straInc', straInc)
        request.input('seriNo', seriNo)
        
        await request.query(query)
        console.log('🗑️ ITS Kayıt Silindi:', seriNo)
      }
      
      console.log('✅ ITS Kayıtlar Başarıyla Silindi:', seriNos.length)
      return { success: true, deletedCount: seriNos.length }
      
    } catch (error) {
      console.error('❌ ITS Kayıt Silme Hatası:', error)
      throw error
    }
  },

  // TBLSERITRA Kayıtlarını Sil - UTS
  async deleteUTSBarcodeRecords(records, subeKodu, belgeNo, straInc) {
    try {
      const pool = await getConnection()
      
      // Kayıtları tek tek sil (seriNo + lot kombinasyonu ile)
      for (const record of records) {
        const query = `
          DELETE FROM TBLSERITRA
          WHERE SUBE_KODU = @subeKodu
            AND BELGENO = @belgeNo
            AND STRA_INC = @straInc
            AND SERI_NO = @seriNo
            AND ACIK2 = @lot
        `
        
        const request = pool.request()
        request.input('subeKodu', subeKodu)
        request.input('belgeNo', belgeNo)
        request.input('straInc', straInc)
        request.input('seriNo', record.seriNo)
        request.input('lot', record.lot)
        
        await request.query(query)
        console.log('🗑️ UTS Kayıt Silindi:', { seriNo: record.seriNo, lot: record.lot })
      }
      
      console.log('✅ UTS Kayıtlar Başarıyla Silindi:', records.length)
      return { success: true, deletedCount: records.length }
      
    } catch (error) {
      console.error('❌ UTS Kayıt Silme Hatası:', error)
      throw error
    }
  },

  // ITS Karekod Kaydet
  async saveITSBarcode(data) {
    try {
      const pool = await getConnection()
      
      const {
        kayitTipi,    // 'M' veya 'A'
        seriNo,
        stokKodu,
        straInc,
        tarih,
        acik1,        // Miad
        acik2,        // Lot
        gckod,
        miktar = 1,
        belgeNo,
        belgeTip,
        subeKodu,
        depoKod = '0',
        ilcGtin,      // Okutulan Barkod
        expectedQuantity  // Beklenen miktar (kalem miktarı)
      } = data
      
      console.log('💾 ITS Karekod Kaydediliyor:', data)
      
      // 1. Mevcut okutulmuş miktarı kontrol et (miktar aşımı kontrolü)
      if (expectedQuantity) {
        const quantityCheckQuery = `
          SELECT ISNULL(SUM(MIKTAR), 0) AS TOTAL_OKUTULAN
          FROM TBLSERITRA WITH (NOLOCK)
          WHERE BELGENO = @belgeNo
            AND STRA_INC = @straInc
            AND STOK_KODU = @stokKodu
            AND BELGETIP = @belgeTip
            AND SUBE_KODU = @subeKodu
            AND KAYIT_TIPI = @kayitTipi
            AND GCKOD = @gckod
        `
        
        const quantityCheckRequest = pool.request()
        quantityCheckRequest.input('belgeNo', belgeNo)
        quantityCheckRequest.input('straInc', straInc)
        quantityCheckRequest.input('stokKodu', stokKodu)
        quantityCheckRequest.input('belgeTip', belgeTip)
        quantityCheckRequest.input('subeKodu', subeKodu)
        quantityCheckRequest.input('kayitTipi', kayitTipi)
        quantityCheckRequest.input('gckod', gckod)
        
        const quantityCheckResult = await quantityCheckRequest.query(quantityCheckQuery)
        const currentOkutulan = quantityCheckResult.recordset[0].TOTAL_OKUTULAN
        
        if (currentOkutulan >= expectedQuantity) {
          console.log('⚠️⚠️⚠️ MİKTAR AŞIMI! ⚠️⚠️⚠️')
          console.log('Stok Kodu:', stokKodu)
          console.log('Beklenen Miktar:', expectedQuantity)
          console.log('Mevcut Okutulan:', currentOkutulan)
          return {
            success: false,
            error: 'QUANTITY_EXCEEDED',
            message: `⚠️ Miktar aşımı! Bu üründen ${expectedQuantity} adet okutulması gerekiyor, ${currentOkutulan} adet zaten okutulmuş.`
          }
        }
        console.log('✓ Miktar kontrolü geçti:', currentOkutulan, '/', expectedQuantity)
      }
      
      // 2. Aynı seri numarasının daha önce okutulup okutulmadığını kontrol et
      const checkQuery = `
        SELECT COUNT(*) AS KAYIT_SAYISI
        FROM TBLSERITRA WITH (NOLOCK)
        WHERE SERI_NO = @seriNo
          AND SUBE_KODU = @subeKodu
          AND BELGENO = @belgeNo
      `
      
      const checkRequest = pool.request()
      checkRequest.input('seriNo', seriNo)
      checkRequest.input('subeKodu', subeKodu)
      checkRequest.input('belgeNo', belgeNo)
      
      const checkResult = await checkRequest.query(checkQuery)
      
      if (checkResult.recordset[0].KAYIT_SAYISI > 0) {
        console.log('⚠️⚠️⚠️ DUPLICATE KAREKOD TESPIT EDİLDİ! ⚠️⚠️⚠️')
        console.log('Seri No:', seriNo)
        console.log('Belge No:', belgeNo)
        console.log('Şube Kodu:', subeKodu)
        console.log('Bu karekod daha önce', checkResult.recordset[0].KAYIT_SAYISI, 'kere okutulmuş!')
        return { 
          success: false, 
          error: 'DUPLICATE',
          message: '⚠️ Bu karekod daha önce okutulmuş! Aynı seri numarası tekrar okutulamaz.'
        }
      }
      
      console.log('✓ Seri numarası kontrolü geçti, kayıt yapılacak:', seriNo)
      
      const query = `
        INSERT INTO TBLSERITRA (
          KAYIT_TIPI,
          SERI_NO,
          STOK_KODU,
          STRA_INC,
          TARIH,
          ACIK1,
          ACIK2,
          GCKOD,
          MIKTAR,
          BELGENO,
          BELGETIP,
          SUBE_KODU,
          DEPOKOD,
          ILC_GTIN
        ) VALUES (
          @kayitTipi,
          @seriNo,
          @stokKodu,
          @straInc,
          @tarih,
          @acik1,
          @acik2,
          @gckod,
          @miktar,
          @belgeNo,
          @belgeTip,
          @subeKodu,
          @depoKod,
          @ilcGtin
        )
      `
      
      // Tarih formatı - saat bilgisi olmadan (YYYY-MM-DD) - Local time, timezone sorunu olmasın
      const tarihDate = new Date(tarih)
      const year = tarihDate.getFullYear()
      const month = String(tarihDate.getMonth() + 1).padStart(2, '0')
      const day = String(tarihDate.getDate()).padStart(2, '0')
      const formattedTarih = `${year}-${month}-${day}`
      
      const request = pool.request()
      request.input('kayitTipi', kayitTipi)
      request.input('seriNo', seriNo)
      request.input('stokKodu', stokKodu)
      request.input('straInc', straInc)
      request.input('tarih', formattedTarih) // Belge tarihi - saat yok
      request.input('acik1', acik1)
      request.input('acik2', acik2)
      request.input('gckod', gckod)
      request.input('miktar', miktar)
      request.input('belgeNo', belgeNo)
      request.input('belgeTip', belgeTip)
      request.input('subeKodu', subeKodu)
      request.input('depoKod', depoKod)
      request.input('ilcGtin', ilcGtin)
      
      await request.query(query)
      
      console.log('✅✅✅ ITS KAREKOD BAŞARIYLA KAYDEDİLDİ! ✅✅✅')
      console.log('Seri No:', seriNo)
      console.log('Stok Kodu:', stokKodu)
      console.log('Miad:', acik1)
      console.log('Lot:', acik2)
      console.log('Belge No:', belgeNo)
      
      return { 
        success: true,
        data: {
          seriNo,
          miad: acik1,
          lot: acik2
        }
      }
      
    } catch (error) {
      console.error('❌ ITS Karekod Kaydetme Hatası:', error)
      throw error
    }
  },

  // DGR Barkod Kaydet (ITS olmayan normal ürünler)
  async saveDGRBarcode(data) {
    try {
      const pool = await getConnection()
      
      const {
        kayitTipi,    // 'M' veya 'A' (Sipariş = M, Fatura = A)
        stokKodu,     // Stok Kodu
        straInc,      // INCKEYNO
        tarih,        // Belge Tarihi
        gckod,        // STHAR_GCKOD
        belgeNo,      // Belge No
        belgeTip,     // STHAR_HTUR
        subeKodu,     // Şube Kodu
        ilcGtin,      // Okutulan Barkod
        expectedQuantity  // Beklenen miktar (kalem miktarı)
      } = data
      
      console.log('💾 DGR Barkod Kaydediliyor:', data)
      
      // Tarih formatı - saat bilgisi olmadan (YYYY-MM-DD)
      const tarihDate = new Date(tarih)
      const year = tarihDate.getFullYear()
      const month = String(tarihDate.getMonth() + 1).padStart(2, '0')
      const day = String(tarihDate.getDate()).padStart(2, '0')
      const formattedTarih = `${year}-${month}-${day}`
      
      // Aynı kayıt var mı kontrol et
      const checkQuery = `
        SELECT MIKTAR
        FROM TBLSERITRA WITH (NOLOCK)
        WHERE KAYIT_TIPI = @kayitTipi
          AND STOK_KODU = @stokKodu
          AND STRA_INC = @straInc
          AND BELGENO = @belgeNo
          AND BELGETIP = @belgeTip
          AND SUBE_KODU = @subeKodu
          AND GCKOD = @gckod
      `
      
      const checkRequest = pool.request()
      checkRequest.input('kayitTipi', kayitTipi)
      checkRequest.input('stokKodu', stokKodu)
      checkRequest.input('straInc', straInc)
      checkRequest.input('belgeNo', belgeNo)
      checkRequest.input('belgeTip', belgeTip)
      checkRequest.input('subeKodu', subeKodu)
      checkRequest.input('gckod', gckod)
      
      const checkResult = await checkRequest.query(checkQuery)
      
      if (checkResult.recordset.length > 0) {
        // Kayıt var, MIKTAR'ı +1 arttır (UPDATE)
        const currentMiktar = checkResult.recordset[0].MIKTAR || 0
        const newMiktar = currentMiktar + 1
        
        // Miktar kontrolü - beklenen miktarı aşmamalı
        if (expectedQuantity && newMiktar > expectedQuantity) {
          console.log('⚠️⚠️⚠️ MİKTAR AŞIMI! (DGR UPDATE) ⚠️⚠️⚠️')
          console.log('Stok Kodu:', stokKodu)
          console.log('Beklenen Miktar:', expectedQuantity)
          console.log('Mevcut Miktar:', currentMiktar)
          console.log('Yeni Miktar olacaktı:', newMiktar)
          return {
            success: false,
            error: 'QUANTITY_EXCEEDED',
            message: `⚠️ Miktar aşımı! Bu üründen ${expectedQuantity} adet okutulması gerekiyor, ${currentMiktar} adet zaten okutulmuş.`
          }
        }
        
        console.log(`✓ Kayıt bulundu, MIKTAR güncelleniyor: ${currentMiktar} -> ${newMiktar}`)
        
        const updateQuery = `
          UPDATE TBLSERITRA
          SET MIKTAR = @newMiktar
          WHERE KAYIT_TIPI = @kayitTipi
            AND STOK_KODU = @stokKodu
            AND STRA_INC = @straInc
            AND BELGENO = @belgeNo
            AND BELGETIP = @belgeTip
            AND SUBE_KODU = @subeKodu
            AND GCKOD = @gckod
        `
        
        const updateRequest = pool.request()
        updateRequest.input('kayitTipi', kayitTipi)
        updateRequest.input('stokKodu', stokKodu)
        updateRequest.input('straInc', straInc)
        updateRequest.input('belgeNo', belgeNo)
        updateRequest.input('belgeTip', belgeTip)
        updateRequest.input('subeKodu', subeKodu)
        updateRequest.input('gckod', gckod)
        updateRequest.input('newMiktar', newMiktar)
        
        await updateRequest.query(updateQuery)
        
        console.log('✅✅✅ DGR BARKOD BAŞARIYLA GÜNCELLENDİ! ✅✅✅')
        console.log('Stok Kodu:', stokKodu)
        console.log('Belge No:', belgeNo)
        console.log('Yeni Miktar:', newMiktar)
        
        return {
          success: true,
          data: {
            stokKodu,
            miktar: newMiktar,
            isUpdate: true
          }
        }
      } else {
        // Kayıt yok, yeni kayıt oluştur (INSERT)
        
        // Miktar kontrolü - ilk kayıt için de kontrol
        if (expectedQuantity && expectedQuantity < 1) {
          console.log('⚠️⚠️⚠️ MİKTAR AŞIMI! (DGR INSERT) ⚠️⚠️⚠️')
          console.log('Stok Kodu:', stokKodu)
          console.log('Beklenen Miktar:', expectedQuantity)
          return {
            success: false,
            error: 'QUANTITY_EXCEEDED',
            message: `⚠️ Miktar aşımı! Bu üründen ${expectedQuantity} adet okutulması gerekiyor, zaten tamamlanmış.`
          }
        }
        
        console.log('✓ Kayıt bulunamadı, yeni kayıt oluşturuluyor...')
        
        const insertQuery = `
          INSERT INTO TBLSERITRA (
            KAYIT_TIPI,
            SERI_NO,
            STOK_KODU,
            STRA_INC,
            TARIH,
            GCKOD,
            MIKTAR,
            BELGENO,
            BELGETIP,
            SUBE_KODU,
            DEPOKOD,
            ILC_GTIN
          ) VALUES (
            @kayitTipi,
            @stokKodu,
            @stokKodu,
            @straInc,
            @tarih,
            @gckod,
            1,
            @belgeNo,
            @belgeTip,
            @subeKodu,
            '0',
            @ilcGtin
          )
        `
        
        const insertRequest = pool.request()
        insertRequest.input('kayitTipi', kayitTipi)
        insertRequest.input('stokKodu', stokKodu)
        insertRequest.input('straInc', straInc)
        insertRequest.input('tarih', formattedTarih)
        insertRequest.input('gckod', gckod)
        insertRequest.input('belgeNo', belgeNo)
        insertRequest.input('belgeTip', belgeTip)
        insertRequest.input('subeKodu', subeKodu)
        insertRequest.input('ilcGtin', ilcGtin)
        
        await insertRequest.query(insertQuery)
        
        console.log('✅✅✅ DGR BARKOD BAŞARIYLA KAYDEDİLDİ! ✅✅✅')
        console.log('Stok Kodu:', stokKodu)
        console.log('Belge No:', belgeNo)
        console.log('Miktar:', 1)
        
        return {
          success: true,
          data: {
            stokKodu,
            miktar: 1,
            isUpdate: false
          }
        }
      }
      
    } catch (error) {
      console.error('❌ DGR Barkod Kaydetme Hatası:', error)
      throw error
    }
  },

  // UTS Barkod Kaydet
  async saveUTSBarcode(data) {
    try {
      const pool = await getConnection()
      
      const {
        kayitTipi,    // 'M' veya 'A' (Sipariş = M, Fatura = A)
        seriNo,       // Seri No (opsiyonel)
        lotNo,        // Lot No (opsiyonel ama en az biri olmalı)
        stokKodu,     // Stok Kodu
        straInc,      // INCKEYNO
        tarih,        // Belge Tarihi
        uretimTarihi, // Üretim Tarihi (YYYY-MM-DD)
        gckod,        // STHAR_GCKOD
        miktar,       // Miktar (seri no varsa 1, yoksa kullanıcı girer)
        belgeNo,      // Belge No
        belgeTip,     // STHAR_HTUR
        subeKodu,     // Şube Kodu
        ilcGtin,      // Okutulan Barkod
        expectedQuantity  // Beklenen miktar (kalem miktarı)
      } = data
      
      console.log('💾 UTS Barkod Kaydediliyor:', data)
      
      // Üretim tarihini YYMMDD formatına çevir (YYAAGG - Yıl Ay Gün)
      let formattedUretimTarihi = ''
      if (uretimTarihi) {
        // YYYY-MM-DD string'inden direkt parse et (timezone problemi olmasın)
        if (uretimTarihi.includes('-')) {
          const [yyyy, mm, dd] = uretimTarihi.split('-')
          const yy = yyyy.substring(2, 4) // Son 2 hane
          formattedUretimTarihi = `${yy}${mm}${dd}` // YYMMDD (YYAAGG)
          console.log(`📅 Tarih dönüşümü: ${uretimTarihi} -> ${formattedUretimTarihi}`)
        } else {
          // Fallback: Date parse et
          const date = new Date(uretimTarihi)
          const yy = String(date.getFullYear()).slice(-2)
          const mm = String(date.getMonth() + 1).padStart(2, '0')
          const dd = String(date.getDate()).padStart(2, '0')
          formattedUretimTarihi = `${yy}${mm}${dd}` // YYMMDD
          console.log(`📅 Tarih dönüşümü (fallback): ${uretimTarihi} -> ${formattedUretimTarihi}`)
        }
      }
      
      // Belge Tarih formatı - saat bilgisi olmadan (YYYY-MM-DD)
      const tarihDate = new Date(tarih)
      const year = tarihDate.getFullYear()
      const month = String(tarihDate.getMonth() + 1).padStart(2, '0')
      const day = String(tarihDate.getDate()).padStart(2, '0')
      const formattedTarih = `${year}-${month}-${day}`
      
      // SERI_NO: Seri no varsa seri, yoksa lot numarası
      const finalSeriNo = seriNo || lotNo
      
      // Miktar kontrolü - beklenen miktarı aşmamalı
      if (expectedQuantity) {
        const quantityCheckQuery = `
          SELECT ISNULL(SUM(MIKTAR), 0) AS TOTAL_OKUTULAN
          FROM TBLSERITRA WITH (NOLOCK)
          WHERE BELGENO = @belgeNo
            AND STRA_INC = @straInc
            AND STOK_KODU = @stokKodu
            AND BELGETIP = @belgeTip
            AND SUBE_KODU = @subeKodu
            AND KAYIT_TIPI = @kayitTipi
            AND GCKOD = @gckod
        `
        
        const quantityCheckRequest = pool.request()
        quantityCheckRequest.input('belgeNo', belgeNo)
        quantityCheckRequest.input('straInc', straInc)
        quantityCheckRequest.input('stokKodu', stokKodu)
        quantityCheckRequest.input('belgeTip', belgeTip)
        quantityCheckRequest.input('subeKodu', subeKodu)
        quantityCheckRequest.input('kayitTipi', kayitTipi)
        quantityCheckRequest.input('gckod', gckod)
        
        const quantityCheckResult = await quantityCheckRequest.query(quantityCheckQuery)
        const currentOkutulan = quantityCheckResult.recordset[0].TOTAL_OKUTULAN
        
        if (currentOkutulan + miktar > expectedQuantity) {
          console.log('⚠️⚠️⚠️ MİKTAR AŞIMI! (UTS) ⚠️⚠️⚠️')
          console.log('Stok Kodu:', stokKodu)
          console.log('Beklenen Miktar:', expectedQuantity)
          console.log('Mevcut Okutulan:', currentOkutulan)
          console.log('Eklenecek Miktar:', miktar)
          return {
            success: false,
            error: 'QUANTITY_EXCEEDED',
            message: `⚠️ Miktar aşımı! Bu üründen ${expectedQuantity} adet okutulması gerekiyor, ${currentOkutulan} adet zaten okutulmuş.`
          }
        }
        console.log('✓ Miktar kontrolü geçti:', currentOkutulan + miktar, '/', expectedQuantity)
      }
      
      // Unique kontroller - Seri No ve Lot No teklik kontrolü
      // Seri No unique kontrolü
      if (seriNo) {
        const seriCheckQuery = `
          SELECT SERI_NO, ACIK2
          FROM TBLSERITRA WITH (NOLOCK)
          WHERE BELGENO = @belgeNo
            AND STRA_INC = @straInc
            AND STOK_KODU = @stokKodu
            AND BELGETIP = @belgeTip
            AND SUBE_KODU = @subeKodu
            AND KAYIT_TIPI = @kayitTipi
            AND GCKOD = @gckod
            AND SERI_NO = @seriNo
        `
        
        const seriCheckRequest = pool.request()
        seriCheckRequest.input('belgeNo', belgeNo)
        seriCheckRequest.input('straInc', straInc)
        seriCheckRequest.input('stokKodu', stokKodu)
        seriCheckRequest.input('belgeTip', belgeTip)
        seriCheckRequest.input('subeKodu', subeKodu)
        seriCheckRequest.input('kayitTipi', kayitTipi)
        seriCheckRequest.input('gckod', gckod)
        seriCheckRequest.input('seriNo', seriNo)
        
        const seriCheckResult = await seriCheckRequest.query(seriCheckQuery)
        
        if (seriCheckResult.recordset.length > 0) {
          console.log('⚠️ DUPLICATE! Aynı Seri No zaten kayıtlı:', seriNo)
          return {
            success: false,
            error: 'DUPLICATE',
            message: `Bu Seri No zaten kayıtlı: ${seriNo}`
          }
        }
      }
      
      // Lot No unique kontrolü
      if (lotNo) {
        const lotCheckQuery = `
          SELECT SERI_NO, ACIK2, MIKTAR
          FROM TBLSERITRA WITH (NOLOCK)
          WHERE BELGENO = @belgeNo
            AND STRA_INC = @straInc
            AND STOK_KODU = @stokKodu
            AND BELGETIP = @belgeTip
            AND SUBE_KODU = @subeKodu
            AND KAYIT_TIPI = @kayitTipi
            AND GCKOD = @gckod
            AND ACIK2 = @lotNo
        `
        
        const lotCheckRequest = pool.request()
        lotCheckRequest.input('belgeNo', belgeNo)
        lotCheckRequest.input('straInc', straInc)
        lotCheckRequest.input('stokKodu', stokKodu)
        lotCheckRequest.input('belgeTip', belgeTip)
        lotCheckRequest.input('subeKodu', subeKodu)
        lotCheckRequest.input('kayitTipi', kayitTipi)
        lotCheckRequest.input('gckod', gckod)
        lotCheckRequest.input('lotNo', lotNo)
        
        const lotCheckResult = await lotCheckRequest.query(lotCheckQuery)
        
        if (lotCheckResult.recordset.length > 0) {
          console.log('⚠️ DUPLICATE! Aynı Lot No zaten kayıtlı:', lotNo)
          return {
            success: false,
            error: 'DUPLICATE',
            message: `Bu Lot No zaten kayıtlı: ${lotNo}`
          }
        }
      }
      
      // Yeni kayıt oluştur (INSERT)
      console.log('✓ Yeni kayıt oluşturuluyor...')
      
      const insertQuery = `
        INSERT INTO TBLSERITRA (
          KAYIT_TIPI,
          SERI_NO,
          STOK_KODU,
          STRA_INC,
          TARIH,
          ACIK1,
          ACIK2,
          GCKOD,
          MIKTAR,
          BELGENO,
          BELGETIP,
          SUBE_KODU,
          DEPOKOD,
          ILC_GTIN
        ) VALUES (
          @kayitTipi,
          @finalSeriNo,
          @stokKodu,
          @straInc,
          @tarih,
          @formattedUretimTarihi,
          @acik2,
          @gckod,
          @miktar,
          @belgeNo,
          @belgeTip,
          @subeKodu,
          '0',
          @ilcGtin
        )
      `
      
      const insertRequest = pool.request()
      insertRequest.input('kayitTipi', kayitTipi)
      insertRequest.input('finalSeriNo', finalSeriNo)
      insertRequest.input('stokKodu', stokKodu)
      insertRequest.input('straInc', straInc)
      insertRequest.input('tarih', formattedTarih)
      insertRequest.input('formattedUretimTarihi', formattedUretimTarihi)
      insertRequest.input('acik2', seriNo ? (lotNo || '') : '') // Seri no varsa ACIK2'ye lot numarası
      insertRequest.input('gckod', gckod)
      insertRequest.input('miktar', miktar)
      insertRequest.input('belgeNo', belgeNo)
      insertRequest.input('belgeTip', belgeTip)
      insertRequest.input('subeKodu', subeKodu)
      insertRequest.input('ilcGtin', ilcGtin)
      
      await insertRequest.query(insertQuery)
      
      console.log('✅✅✅ UTS BARKOD BAŞARIYLA KAYDEDİLDİ! ✅✅✅')
      console.log('Stok Kodu:', stokKodu)
      console.log('Seri No:', seriNo || 'YOK')
      console.log('Lot No:', lotNo || 'YOK')
      console.log('Üretim Tarihi:', formattedUretimTarihi)
      console.log('Miktar:', miktar)
      
      return {
        success: true,
        data: {
          stokKodu,
          seriNo,
          lotNo,
          miktar,
          isUpdate: false
        }
      }
      
    } catch (error) {
      console.error('❌ UTS Barkod Kaydetme Hatası:', error)
      throw error
    }
  },

  // UTS Kayıtlarını Toplu Kaydet/Güncelle/Sil
  async saveUTSRecords(data) {
    try {
      const pool = await getConnection()
      
      const {
        records,          // Grid'den gelen kayıtlar (siraNo, seriNo, lot, miktar, uretimTarihi)
        originalRecords,  // DB'den gelen orijinal kayıtlar (siraNo)
        kayitTipi,        // 'M' veya 'A'
        stokKodu,
        straInc,
        tarih,
        belgeNo,
        belgeTip,
        subeKodu,
        gckod,
        ilcGtin,
        expectedQuantity
      } = data
      
      console.log('💾 UTS Toplu Kayıt İşlemi Başlıyor...')
      console.log('Toplam Kayıt:', records.length)
      
      // Belge Tarih formatı
      const tarihDate = new Date(tarih)
      const year = tarihDate.getFullYear()
      const month = String(tarihDate.getMonth() + 1).padStart(2, '0')
      const day = String(tarihDate.getDate()).padStart(2, '0')
      const formattedTarih = `${year}-${month}-${day}`
      
      const transaction = pool.transaction()
      await transaction.begin()
      
      try {
        // 1. Silinen kayıtları bul ve DELETE
        const originalSiraNumbers = originalRecords.map(r => r.siraNo)
        const currentSiraNumbers = records.filter(r => r.siraNo).map(r => r.siraNo)
        const deletedSiraNumbers = originalSiraNumbers.filter(sno => !currentSiraNumbers.includes(sno))
        
        if (deletedSiraNumbers.length > 0) {
          console.log(`🗑️ ${deletedSiraNumbers.length} kayıt silinecek:`, deletedSiraNumbers)
          
          for (const siraNo of deletedSiraNumbers) {
            const deleteQuery = `DELETE FROM TBLSERITRA WHERE SIRA_NO = @siraNo`
            const deleteRequest = transaction.request()
            deleteRequest.input('siraNo', siraNo)
            await deleteRequest.query(deleteQuery)
          }
          
          console.log('✅ Silme işlemi tamamlandı')
        }
        
        // 2. Her satır için INSERT veya UPDATE
        let insertCount = 0
        let updateCount = 0
        
        for (const record of records) {
          // Üretim tarihini YYMMDD formatına çevir
          let formattedUretimTarihi = ''
          if (record.uretimTarihiDisplay && record.uretimTarihiDisplay.includes('-')) {
            const [yyyy, mm, dd] = record.uretimTarihiDisplay.split('-')
            const yy = yyyy.substring(2, 4)
            formattedUretimTarihi = `${yy}${mm}${dd}`
          } else if (record.uretimTarihi) {
            formattedUretimTarihi = record.uretimTarihi
          }
          
          // SERI_NO ve ACIK2 ayarla
          const finalSeriNo = record.seriNo || record.lot
          const finalAcik2 = record.seriNo ? record.lot : '' // Seri no varsa lot ACIK2'ye, yoksa boş
          
          if (record.siraNo) {
            // UPDATE mevcut kayıt
            const updateQuery = `
              UPDATE TBLSERITRA
              SET SERI_NO = @finalSeriNo,
                  ACIK1 = @formattedUretimTarihi,
                  ACIK2 = @finalAcik2,
                  MIKTAR = @miktar
              WHERE SIRA_NO = @siraNo
            `
            
            const updateRequest = transaction.request()
            updateRequest.input('siraNo', record.siraNo)
            updateRequest.input('finalSeriNo', finalSeriNo)
            updateRequest.input('formattedUretimTarihi', formattedUretimTarihi)
            updateRequest.input('finalAcik2', finalAcik2)
            updateRequest.input('miktar', record.miktar)
            
            await updateRequest.query(updateQuery)
            updateCount++
            console.log(`✏️ Kayıt güncellendi: SIRA_NO=${record.siraNo}`)
            
          } else {
            // INSERT yeni kayıt
            const insertQuery = `
              INSERT INTO TBLSERITRA (
                KAYIT_TIPI,
                SERI_NO,
                STOK_KODU,
                STRA_INC,
                TARIH,
                ACIK1,
                ACIK2,
                GCKOD,
                MIKTAR,
                BELGENO,
                BELGETIP,
                SUBE_KODU,
                DEPOKOD,
                ILC_GTIN
              ) VALUES (
                @kayitTipi,
                @finalSeriNo,
                @stokKodu,
                @straInc,
                @tarih,
                @formattedUretimTarihi,
                @finalAcik2,
                @gckod,
                @miktar,
                @belgeNo,
                @belgeTip,
                @subeKodu,
                '0',
                @ilcGtin
              )
            `
            
            const insertRequest = transaction.request()
            insertRequest.input('kayitTipi', kayitTipi)
            insertRequest.input('finalSeriNo', finalSeriNo)
            insertRequest.input('stokKodu', stokKodu)
            insertRequest.input('straInc', straInc)
            insertRequest.input('tarih', formattedTarih)
            insertRequest.input('formattedUretimTarihi', formattedUretimTarihi)
            insertRequest.input('finalAcik2', finalAcik2)
            insertRequest.input('gckod', gckod)
            insertRequest.input('miktar', record.miktar)
            insertRequest.input('belgeNo', belgeNo)
            insertRequest.input('belgeTip', belgeTip)
            insertRequest.input('subeKodu', subeKodu)
            insertRequest.input('ilcGtin', ilcGtin)
            
            await insertRequest.query(insertQuery)
            insertCount++
            console.log(`➕ Yeni kayıt eklendi: ${finalSeriNo}`)
          }
        }
        
        // Transaction commit
        await transaction.commit()
        
        console.log('✅✅✅ UTS TOPLU KAYIT BAŞARILI! ✅✅✅')
        console.log(`➕ ${insertCount} yeni kayıt eklendi`)
        console.log(`✏️ ${updateCount} kayıt güncellendi`)
        console.log(`🗑️ ${deletedSiraNumbers.length} kayıt silindi`)
        
        return {
          success: true,
          insertCount,
          updateCount,
          deleteCount: deletedSiraNumbers.length
        }
        
      } catch (error) {
        await transaction.rollback()
        throw error
      }
      
    } catch (error) {
      console.error('❌ UTS Toplu Kayıt Hatası:', error)
      throw error
    }
  }
}

export default documentService

