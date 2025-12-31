import { getConnection } from '../config/database.js'
import sql from 'mssql'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * ITS kaydı ekler
 */
export async function addITSRecord(data) {
  try {
    const pool = await getConnection()

    const result = await pool.request()
      .input('HAR_RECNO', sql.Int, data.HAR_RECNO)
      .input('TURU', sql.Char(1), data.TURU)
      .input('FTIRSIP', sql.Char(1), data.FTIRSIP)
      .input('FATIRS_NO', sql.VarChar(15), data.FATIRS_NO)
      .input('CARI_KODU', sql.VarChar(35), data.CARI_KODU)
      .input('STOK_KODU', sql.VarChar(35), data.STOK_KODU)
      .input('GTIN', sql.VarChar(15), data.GTIN)
      .input('SERI_NO', sql.VarChar(25), data.SERI_NO)
      .input('MIAD', sql.Date, data.MIAD ? new Date(data.MIAD) : null)
      .input('LOT_NO', sql.VarChar(35), data.LOT_NO)
      .input('URETIM_TARIHI', sql.Date, data.URETIM_TARIHI ? new Date(data.URETIM_TARIHI) : null)
      .input('CARRIER_LABEL', sql.VarChar(25), data.CARRIER_LABEL)
      .input('KAYIT_KULLANICI', sql.VarChar(35), data.KAYIT_KULLANICI)
      .input('SUBE_KODU', sql.Int, data.SUBE_KODU)
      .query(`
        INSERT INTO AKTBLITSUTS (
          HAR_RECNO, TURU, FTIRSIP, FATIRS_NO, CARI_KODU, STOK_KODU, GTIN, SERI_NO,
          MIAD, LOT_NO, URETIM_TARIHI, CARRIER_LABEL, KAYIT_KULLANICI, KAYIT_TARIHI, SUBE_KODU
        ) VALUES (
          @HAR_RECNO, @TURU, @FTIRSIP, @FATIRS_NO, @CARI_KODU, @STOK_KODU, @GTIN, @SERI_NO,
          @MIAD, @LOT_NO, @URETIM_TARIHI, @CARRIER_LABEL, @KAYIT_KULLANICI, GETDATE(), @SUBE_KODU
        );
        SELECT SCOPE_IDENTITY() AS RECNO;
      `)

    return {
      success: true,
      recno: result.recordset[0].RECNO
    }
  } catch (error) {
    console.error('❌ ITS kaydı ekleme hatası:', error)
    throw error
  }
}

/**
 * ITS kayıtlarını listeler
 */
export async function listITSRecords(filters = {}) {
  try {
    const pool = await getConnection()
    const request = pool.request()

    let query = `
      SELECT 
        RECNO,
        HAR_RECNO,
        TURU,
        FTIRSIP,
        FATIRS_NO,
        CARI_KODU,
        STOK_KODU,
        GTIN,
        SERI_NO,
        MIAD,
        LOT_NO,
        URETIM_TARIHI,
        CARRIER_LABEL,
        BILDIRIM,
        BILDIRIM_ID,
        BILDIRIM_TARIHI,
        KAYIT_TARIHI,
        KAYIT_KULLANICI
      FROM AKTBLITSUTS WITH (NOLOCK)
      WHERE 1=1
    `

    // Filtreleme
    if (filters.startDate && filters.endDate) {
      request.input('startDate', sql.DateTime, new Date(filters.startDate))
      request.input('endDate', sql.DateTime, new Date(filters.endDate))
      query += ` AND KAYIT_TARIHI BETWEEN @startDate AND @endDate`
    }

    if (filters.durum) {
      request.input('durum', sql.VarChar(20), filters.durum)
      query += ` AND BILDIRIM = @durum`
    }

    if (filters.fatirsNo) {
      request.input('fatirsNo', sql.VarChar(15), filters.fatirsNo)
      query += ` AND FATIRS_NO = @fatirsNo`
    }

    if (filters.gtin) {
      request.input('gtin', sql.VarChar(15), filters.gtin)
      query += ` AND GTIN = @gtin`
    }

    if (filters.seriNo) {
      request.input('seriNo', sql.VarChar(25), filters.seriNo)
      query += ` AND SERI_NO = @seriNo`
    }

    if (filters.cariKodu) {
      request.input('cariKodu', sql.VarChar(35), filters.cariKodu)
      query += ` AND CARI_KODU = @cariKodu`
    }

    if (filters.kullanici) {
      request.input('kullanici', sql.VarChar(35), filters.kullanici)
      query += ` AND KAYIT_KULLANICI = @kullanici`
    }

    query += ` ORDER BY KAYIT_TARIHI DESC`

    const result = await request.query(query)

    return {
      success: true,
      data: result.recordset,
      count: result.recordset.length
    }
  } catch (error) {
    console.error('❌ ITS kayıtları listeleme hatası:', error)
    throw error
  }
}

/**
 * ITS kaydını RECNO'ya göre getirir
 */
export async function getITSRecord(recno) {
  try {
    const pool = await getConnection()

    const result = await pool.request()
      .input('recno', sql.Int, recno)
      .query(`
        SELECT 
          RECNO,
          HAR_RECNO,
          TURU,
          FTIRSIP,
          FATIRS_NO,
          CARI_KODU,
          STOK_KODU,
          GTIN,
          SERI_NO,
          MIAD,
          LOT_NO,
          URETIM_TARIHI,
          CARRIER_LABEL,
          BILDIRIM,
          BILDIRIM_ID,
          BILDIRIM_TARIHI,
          KAYIT_TARIHI,
          KAYIT_KULLANICI
        FROM AKTBLITSUTS WITH (NOLOCK)
        WHERE RECNO = @recno
      `)

    if (result.recordset.length === 0) {
      return { success: false, message: 'Kayıt bulunamadı' }
    }

    return {
      success: true,
      data: result.recordset[0]
    }
  } catch (error) {
    console.error('❌ ITS kaydı getirme hatası:', error)
    throw error
  }
}

/**
 * ITS kaydını günceller
 */
export async function updateITSRecord(recno, data) {
  try {
    const pool = await getConnection()
    const request = pool.request().input('recno', sql.Int, recno)

    const updateFields = []

    if (data.HAR_RECNO !== undefined) {
      request.input('HAR_RECNO', sql.Int, data.HAR_RECNO)
      updateFields.push('HAR_RECNO = @HAR_RECNO')
    }
    if (data.TURU !== undefined) {
      request.input('TURU', sql.Char(1), data.TURU)
      updateFields.push('TURU = @TURU')
    }
    if (data.FTIRSIP !== undefined) {
      request.input('FTIRSIP', sql.Char(1), data.FTIRSIP)
      updateFields.push('FTIRSIP = @FTIRSIP')
    }
    if (data.FATIRS_NO !== undefined) {
      request.input('FATIRS_NO', sql.VarChar(15), data.FATIRS_NO)
      updateFields.push('FATIRS_NO = @FATIRS_NO')
    }
    if (data.CARI_KODU !== undefined) {
      request.input('CARI_KODU', sql.VarChar(35), data.CARI_KODU)
      updateFields.push('CARI_KODU = @CARI_KODU')
    }
    if (data.STOK_KODU !== undefined) {
      request.input('STOK_KODU', sql.VarChar(35), data.STOK_KODU)
      updateFields.push('STOK_KODU = @STOK_KODU')
    }
    if (data.GTIN !== undefined) {
      request.input('GTIN', sql.VarChar(15), data.GTIN)
      updateFields.push('GTIN = @GTIN')
    }
    if (data.SERI_NO !== undefined) {
      request.input('SERI_NO', sql.VarChar(25), data.SERI_NO)
      updateFields.push('SERI_NO = @SERI_NO')
    }
    if (data.MIAD !== undefined) {
      request.input('MIAD', sql.Date, data.MIAD ? new Date(data.MIAD) : null)
      updateFields.push('MIAD = @MIAD')
    }
    if (data.LOT_NO !== undefined) {
      request.input('LOT_NO', sql.VarChar(35), data.LOT_NO)
      updateFields.push('LOT_NO = @LOT_NO')
    }
    if (data.URETIM_TARIHI !== undefined) {
      request.input('URETIM_TARIHI', sql.Date, data.URETIM_TARIHI ? new Date(data.URETIM_TARIHI) : null)
      updateFields.push('URETIM_TARIHI = @URETIM_TARIHI')
    }
    if (data.CARRIER_LABEL !== undefined) {
      request.input('CARRIER_LABEL', sql.VarChar(25), data.CARRIER_LABEL)
      updateFields.push('CARRIER_LABEL = @CARRIER_LABEL')
    }
    if (data.BILDIRIM !== undefined) {
      request.input('BILDIRIM', sql.VarChar(20), data.BILDIRIM)
      updateFields.push('BILDIRIM = @BILDIRIM')
    }
    if (data.BILDIRIM_ID !== undefined) {
      request.input('BILDIRIM_ID', sql.VarChar(36), data.BILDIRIM_ID)
      updateFields.push('BILDIRIM_ID = @BILDIRIM_ID')
    }
    if (data.BILDIRIM_TARIHI !== undefined) {
      request.input('BILDIRIM_TARIHI', sql.DateTime, data.BILDIRIM_TARIHI)
      updateFields.push('BILDIRIM_TARIHI = @BILDIRIM_TARIHI')
    }
    if (data.KAYIT_KULLANICI !== undefined) {
      request.input('KAYIT_KULLANICI', sql.VarChar(35), data.KAYIT_KULLANICI)
      updateFields.push('KAYIT_KULLANICI = @KAYIT_KULLANICI')
    }

    if (updateFields.length === 0) {
      return { success: false, message: 'Güncellenecek alan yok' }
    }

    const query = `
      UPDATE AKTBLITSUTS 
      SET ${updateFields.join(', ')}
      WHERE RECNO = @recno
    `

    await request.query(query)

    return { success: true, message: 'Kayıt güncellendi' }
  } catch (error) {
    console.error('❌ ITS kaydı güncelleme hatası:', error)
    throw error
  }
}

/**
 * ITS kaydını siler
 */
export async function deleteITSRecord(recno) {
  try {
    const pool = await getConnection()

    await pool.request()
      .input('recno', sql.Int, recno)
      .query(`DELETE FROM AKTBLITSUTS WHERE RECNO = @recno`)

    return { success: true, message: 'Kayıt silindi' }
  } catch (error) {
    console.error('❌ ITS kaydı silme hatası:', error)
    throw error
  }
}

/**
 * Toplu bildirim durumu güncelleme
 * Temp Table + JOIN ile performanslı (tüm SQL Server sürümleriyle uyumlu)
 */
export async function updateBulkNotificationStatus(recnos, bildirimId, bildirimTarihi, durum) {
  try {
    const pool = await getConnection()

    if (!recnos || recnos.length === 0) {
      return { success: true, message: 'Güncellenecek kayıt yok' }
    }

    // SQL Server VALUES limiti: 1000 satır
    const CHUNK_SIZE = 1000

    // INSERT statement'ları oluştur
    const insertStatements = []
    for (let i = 0; i < recnos.length; i += CHUNK_SIZE) {
      const chunk = recnos.slice(i, i + CHUNK_SIZE)
      const valuesList = chunk.map(recno => `(${Number(recno)})`).join(',')
      insertStatements.push(`INSERT INTO #BulkUpdate (RECNO) VALUES ${valuesList};`)
    }

    const query = `
      -- Temp table oluştur
      CREATE TABLE #BulkUpdate (RECNO INT PRIMARY KEY);

      -- Verileri chunk'lar halinde ekle
      ${insertStatements.join('\n      ')}

      -- JOIN ile toplu güncelle
      UPDATE A
      SET A.BILDIRIM_ID = @bildirimId,
          A.BILDIRIM_TARIHI = @bildirimTarihi,
          A.BILDIRIM = @durum
      FROM AKTBLITSUTS A
      INNER JOIN #BulkUpdate T ON A.RECNO = T.RECNO;

      -- Temp table'ı temizle
      DROP TABLE #BulkUpdate;
    `

    const request = pool.request()
    request.input('bildirimId', sql.VarChar(36), bildirimId)
    request.input('bildirimTarihi', sql.DateTime, bildirimTarihi)
    request.input('durum', sql.VarChar(20), durum)

    await request.query(query)

    return { success: true, message: 'Toplu güncelleme tamamlandı' }
  } catch (error) {
    console.error('❌ Toplu güncelleme hatası:', error)
    throw error
  }
}

/**
 * İstatistikler
 */
export async function getITSStatistics(filters = {}) {
  try {
    const pool = await getConnection()
    const request = pool.request()

    let whereClause = 'WHERE 1=1'

    if (filters.startDate && filters.endDate) {
      request.input('startDate', sql.DateTime, new Date(filters.startDate))
      request.input('endDate', sql.DateTime, new Date(filters.endDate))
      whereClause += ` AND KAYIT_TARIHI BETWEEN @startDate AND @endDate`
    }

    const result = await request.query(`
      SELECT 
        COUNT(*) as TOPLAM,
        COUNT(DISTINCT GTIN) as FARKLI_URUN,
        COUNT(DISTINCT FATIRS_NO) as FARKLI_FATURA,
        COUNT(DISTINCT CARI_KODU) as FARKLI_CARI,
        SUM(CASE WHEN BILDIRIM = 'BEKLEMEDE' THEN 1 ELSE 0 END) as BEKLEMEDE,
        SUM(CASE WHEN BILDIRIM = 'BILDIRILDI' THEN 1 ELSE 0 END) as BILDIRILDI,
        SUM(CASE WHEN BILDIRIM = 'HATA' THEN 1 ELSE 0 END) as HATA,
        SUM(CASE WHEN BILDIRIM_ID IS NOT NULL THEN 1 ELSE 0 END) as BILDIRIM_YAPILAN
      FROM AKTBLITSUTS WITH (NOLOCK)
      ${whereClause}
    `)

    return {
      success: true,
      data: result.recordset[0]
    }
  } catch (error) {
    console.error('❌ İstatistik getirme hatası:', error)
    throw error
  }
}

export default {
  addITSRecord,
  listITSRecords,
  getITSRecord,
  updateITSRecord,
  deleteITSRecord,
  updateBulkNotificationStatus,
  getITSStatistics
}

