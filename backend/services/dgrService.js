import { getConnection } from '../config/database.js'

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
      kullanici
    } = params

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
      `

      const checkRequest = pool.request()
      checkRequest.input('fatirs_no', fatirs_no)
      checkRequest.input('harRecno', harRecno)
      checkRequest.input('stokKodu', stokKodu)

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
        updateRequest.input('kullanici', kullanici || 'SYSTEM')
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
            TURU, KAYIT_TARIHI, DURUM, KULLANICI
          ) VALUES (
            @stokKodu, @gtin, @miktar,
            @harRecno, @fatirs_no, @ftirsip, @cariKodu,
            'D', GETDATE(), 'A', @kullanici
          )
        `

        const insertRequest = pool.request()
        insertRequest.input('stokKodu', stokKodu)
        insertRequest.input('gtin', gtin)
        insertRequest.input('miktar', quantity)
        insertRequest.input('harRecno', harRecno)
        insertRequest.input('fatirs_no', fatirs_no)
        insertRequest.input('ftirsip', ftirsip)
        insertRequest.input('cariKodu', cariKodu || '')
        insertRequest.input('kullanici', kullanici || 'SYSTEM')

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
  async deleteRecord(stokKodu, belgeNo, straInc, quantity = 1) {
    try {
      const pool = await getConnection()

      // Önce mevcut miktarı kontrol et
      const checkQuery = `
        SELECT RECNO, MIKTAR
        FROM AKTBLITSUTS WITH (NOLOCK)
        WHERE FATIRS_NO = @belgeNo
          AND HAR_RECNO = @straInc
          AND STOK_KODU = @stokKodu
          AND TURU = 'D'
      `

      const checkRequest = pool.request()
      checkRequest.input('belgeNo', belgeNo)
      checkRequest.input('straInc', straInc)
      checkRequest.input('stokKodu', stokKodu)

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
  async getRecords(belgeNo, straInc) {
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
          AND HAR_RECNO = @straInc
          AND TURU = 'D'
        ORDER BY RECNO
      `

      const request = pool.request()
      request.input('belgeNo', belgeNo)
      request.input('straInc', straInc)

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


