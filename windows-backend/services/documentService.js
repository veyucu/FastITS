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
            WHERE X.FISNO=A.FATIRS_NO AND X.SUBE_KODU=A.SUBE_KODU AND X.STHAR_ACIKLAMA=A.CARI_KODU AND X.STHAR_FTIRSIP=A.FTIRSIP) AS OKUTULAN
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
          KALAN: row.KALAN
        }
        
        
        const doc = {
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
      
      if (result.recordset.length === 0) {
        return null
      }
      
      const row = result.recordset[0]
      
      // Belge kalemlerini getir
      const items = await this.getDocumentItems(subeKodu, ftirsip, fatirs_no, row.CARI_KODU)
      
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
        isPrepared: row.OKUTULAN >= row.MIKTAR
      }))
      
      return items
    } catch (error) {
      console.error('Belge kalemleri getirme hatası:', error)
      throw error
    }
  }
}

export default documentService

