import { getConnection } from '../config/database.js'
import { getCurrentUsername } from '../utils/requestContext.js'

/**
 * DGR (Diğer Ürünler) işlemleri servisi
 */
const dgrService = {
  /**
   * DGR Kayıt Ekle (Miktar bazlı)
   */
  async saveBarcode(params) {
    const {
      quantity,
      stokKodu,
      gtin,
      harRecno,
      fatirs_no,
      ftirsip,
      cariKodu,
      subeKodu
    } = params

    // Kullanıcıyı context'ten al
    const kullanici = getCurrentUsername()

    try {
      const pool = await getConnection()

      // Mevcut kayıt var mı kontrol et
      const checkQuery = `
        SELECT RECNO, MIKTAR
        FROM AKTBLITSUTS WITH (NOLOCK)
        WHERE FATIRS_NO = @fatirs_no
          AND HAR_RECNO = @harRecno
          AND STOK_KODU = @stokKodu
          AND TURU = 'D'
          AND SUBE_KODU = @subeKodu
          AND FTIRSIP = @ftirsip
          AND CARI_KODU = @cariKodu
      `

      const checkRequest = pool.request()
      checkRequest.input('fatirs_no', fatirs_no)
      checkRequest.input('harRecno', harRecno)
      checkRequest.input('stokKodu', stokKodu)
      checkRequest.input('subeKodu', subeKodu)
      checkRequest.input('ftirsip', ftirsip)
      checkRequest.input('cariKodu', cariKodu)


      const checkResult = await checkRequest.query(checkQuery)

      if (checkResult.recordset.length > 0) {
        // Mevcut kaydı güncelle (miktarı artır)
        const existingRecord = checkResult.recordset[0]
        const newQuantity = (existingRecord.MIKTAR || 0) + quantity

        const updateQuery = `
          UPDATE AKTBLITSUTS
          SET MIKTAR = @miktar,
              KULLANICI = @kullanici
          WHERE RECNO = @recno
            AND TURU = 'D'
        `

        const updateRequest = pool.request()
        updateRequest.input('miktar', newQuantity)
        updateRequest.input('kullanici', kullanici)
        updateRequest.input('recno', existingRecord.RECNO)

        await updateRequest.query(updateQuery)

        return {
          success: true,
          message: `DGR miktarı güncellendi: ${newQuantity}`,
          newQuantity
        }
      } else {
        // Yeni kayıt ekle (SERI_NO boş bırakılacak - DGR için)
        const insertQuery = `
          INSERT INTO AKTBLITSUTS (
            STOK_KODU, GTIN, MIKTAR,
            HAR_RECNO, FATIRS_NO, FTIRSIP, CARI_KODU,
            TURU, KAYIT_TARIHI, KAYIT_KULLANICI, SUBE_KODU
          ) VALUES (
            @stokKodu, @gtin, @miktar,
            @harRecno, @fatirs_no, @ftirsip, @cariKodu,
            'D', GETDATE(), @kullanici, @subeKodu
          )
        `

        const insertRequest = pool.request()
        insertRequest.input('stokKodu', stokKodu)
        insertRequest.input('gtin', gtin)
        insertRequest.input('miktar', quantity)
        insertRequest.input('harRecno', harRecno)
        insertRequest.input('fatirs_no', fatirs_no)
        insertRequest.input('ftirsip', ftirsip)
        insertRequest.input('cariKodu', cariKodu)
        insertRequest.input('kullanici', kullanici)
        insertRequest.input('subeKodu', subeKodu)

        await insertRequest.query(insertQuery)

        return { success: true, message: 'DGR kaydı başarıyla eklendi' }
      }
    } catch (error) {
      console.error('❌ DGR Kayıt Hatası:', error)
      throw error
    }
  },

  /**
   * DGR Kayıt Sil
   * DGR ürünlerde SERI_NO boş olduğu için STOK_KODU ile silme yapılır
   */
  async deleteRecord(stokKodu, belgeNo, harRecno, ftirsip, cariKodu, subeKodu, quantity = 1) {
    try {
      const pool = await getConnection()

      // Önce mevcut miktarı kontrol et
      const checkQuery = `
        SELECT RECNO, MIKTAR
        FROM AKTBLITSUTS WITH (NOLOCK)
        WHERE FATIRS_NO = @belgeNo
          AND HAR_RECNO = @harRecno
          AND STOK_KODU = @stokKodu
          AND SUBE_KODU = @subeKodu
          AND FTIRSIP = @ftirsip
          AND CARI_KODU = @cariKodu
          AND TURU = 'D'
      `

      const checkRequest = pool.request()
      checkRequest.input('belgeNo', belgeNo)
      checkRequest.input('harRecno', harRecno)
      checkRequest.input('stokKodu', stokKodu)
      checkRequest.input('subeKodu', subeKodu)
      checkRequest.input('ftirsip', ftirsip)
      checkRequest.input('cariKodu', cariKodu)

      const checkResult = await checkRequest.query(checkQuery)

      if (checkResult.recordset.length === 0) {
        return { success: false, message: 'Silinecek DGR kaydı bulunamadı' }
      }

      const existingRecord = checkResult.recordset[0]
      const currentQuantity = existingRecord.MIKTAR || 0

      if (currentQuantity <= quantity) {
        // Tüm kaydı sil
        const deleteQuery = `
          DELETE FROM AKTBLITSUTS
          WHERE RECNO = @recno
            AND TURU = 'D'
        `

        const deleteRequest = pool.request()
        deleteRequest.input('recno', existingRecord.RECNO)

        await deleteRequest.query(deleteQuery)

        return { success: true, message: 'DGR kaydı silindi', deletedQuantity: currentQuantity }
      } else {
        // Miktarı düşür
        const newQuantity = currentQuantity - quantity

        const updateQuery = `
          UPDATE AKTBLITSUTS
          SET MIKTAR = @miktar
          WHERE RECNO = @recno
            AND TURU = 'D'
        `

        const updateRequest = pool.request()
        updateRequest.input('miktar', newQuantity)
        updateRequest.input('recno', existingRecord.RECNO)

        await updateRequest.query(updateQuery)

        return {
          success: true,
          message: `DGR miktarı düşürüldü: ${newQuantity}`,
          newQuantity
        }
      }
    } catch (error) {
      console.error('❌ DGR Silme Hatası:', error)
      throw error
    }
  },

  /**
   * DGR Kayıtlarını Getir
   */
  async getRecords(belgeNo, harRecno, ftirsip, cariKodu, subeKodu) {
    try {
      const pool = await getConnection()

      const query = `
        SELECT
          RECNO,
          STOK_KODU,
          GTIN AS BARKOD,
          MIKTAR,
          HAR_RECNO,
          FATIRS_NO,
          FTIRSIP,
          CARI_KODU,
          KAYIT_TARIHI,
          DURUM,
          KULLANICI
        FROM AKTBLITSUTS WITH (NOLOCK)
        WHERE FATIRS_NO = @belgeNo
          AND HAR_RECNO = @harRecno
          AND TURU = 'D'
          AND SUBE_KODU = @subeKodu
          AND FTIRSIP = @ftirsip
          AND CARI_KODU = @cariKodu
        ORDER BY RECNO
      `

      const request = pool.request()
      request.input('belgeNo', belgeNo)
      request.input('harRecno', harRecno)
      request.input('subeKodu', subeKodu)
      request.input('ftirsip', ftirsip)
      request.input('cariKodu', cariKodu)

      const result = await request.query(query)

      return result.recordset.map(row => ({
        recno: row.RECNO,
        stokKodu: row.STOK_KODU,
        barkod: row.BARKOD,
        miktar: row.MIKTAR,
        harRecno: row.HAR_RECNO,
        fatirs_no: row.FATIRS_NO,
        ftirsip: row.FTIRSIP,
        cariKodu: row.CARI_KODU,
        kayitTarihi: row.KAYIT_TARIHI,
        durum: row.DURUM,
        kullanici: row.KULLANICI
      }))
    } catch (error) {
      console.error('❌ DGR Kayıtları Getirme Hatası:', error)
      throw error
    }
  }
}

export default dgrService


