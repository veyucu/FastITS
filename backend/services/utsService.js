import { getConnection } from '../config/database.js'

// Not: Türkçe karakter düzeltmesi SQL'de DBO.TRK fonksiyonu ile yapılıyor

/**
 * UTS (Ürün Takip Sistemi) işlemleri servisi
 */
const utsService = {
  /**
   * UTS Kayıtlarını Getir
   */
  async getRecords(subeKodu, belgeNo, straInc, ftirsip, cariKodu) {
    try {
      const pool = await getConnection()

      const query = `
        SELECT
          RECNO,
          SERI_NO,
          LOT_NO,
          MIKTAR,
          STOK_KODU,
          GTIN AS BARKOD,
          URETIM_TARIHI,
          HAR_RECNO,
          FATIRS_NO,
          FTIRSIP,
          CARI_KODU,
          KAYIT_TARIHI,
          BILDIRIM,
          KAYIT_KULLANICI
        FROM AKTBLITSUTS WITH (NOLOCK)
        WHERE FATIRS_NO = @belgeNo
          AND HAR_RECNO = @straInc
          AND FTIRSIP = @ftirsip
          AND CARI_KODU = @cariKodu
          AND SUBE_KODU = @subeKodu
          AND TURU = 'U'
        ORDER BY RECNO
      `

      const request = pool.request()
      request.input('belgeNo', belgeNo)
      request.input('straInc', straInc)
      request.input('ftirsip', ftirsip)
      request.input('cariKodu', cariKodu)
      request.input('subeKodu', subeKodu)

      const result = await request.query(query)

      const records = result.recordset.map(row => ({
        siraNo: row.RECNO,
        recno: row.RECNO,
        seriNo: row.SERI_NO || '',
        lot: row.LOT_NO || '',
        miktar: row.MIKTAR || 1,
        stokKodu: row.STOK_KODU,
        barkod: row.BARKOD,
        uretimTarihi: row.URETIM_TARIHI,
        harRecno: row.HAR_RECNO,
        fatirs_no: row.FATIRS_NO,
        ftirsip: row.FTIRSIP,
        cariKodu: row.CARI_KODU,
        kayitTarihi: row.KAYIT_TARIHI,
        bildirim: row.BILDIRIM,
        kayitKullanici: row.KAYIT_KULLANICI
      }))

      return records
    } catch (error) {
      console.error('❌ UTS Kayıtları Getirme Hatası:', error)
      throw error
    }
  },

  /**
   * UTS Kayıt Ekle/Güncelle (Toplu)
   */
  async saveRecords(params) {
    const {
      records,
      originalRecords,
      documentId,
      itemId,
      stokKodu,
      belgeTip,
      gckod,
      belgeNo,
      belgeTarihi,
      docType,
      expectedQuantity,
      barcode,
      cariKodu,
      kullanici,
      subeKodu
    } = params

    try {
      const pool = await getConnection()

      // Silinecek kayıtları tespit et
      const newIds = new Set(records.map(r => r.id))
      const deletedRecords = originalRecords.filter(r => !newIds.has(r.id))

      // Önce silinen kayıtları sil
      for (const record of deletedRecords) {
        const deleteQuery = `
          DELETE FROM AKTBLITSUTS
          WHERE FATIRS_NO = @belgeNo
            AND HAR_RECNO = @harRecno
            AND RECNO = @recno
            AND TURU = 'U'
        `

        const deleteRequest = pool.request()
        deleteRequest.input('belgeNo', belgeNo)
        deleteRequest.input('harRecno', itemId)
        deleteRequest.input('recno', record.siraNo || record.recno)

        await deleteRequest.query(deleteQuery)
      }

      // Yeni ve güncellenmiş kayıtları işle
      for (const record of records) {
        // Üretim tarihini YYMMDD formatına çevir
        let uretimTarihiYYMMDD = ''
        if (record.uretimTarihiDisplay && record.uretimTarihiDisplay.includes('-')) {
          const [yyyy, mm, dd] = record.uretimTarihiDisplay.split('-')
          uretimTarihiYYMMDD = `${yyyy.substring(2, 4)}${mm}${dd}`
        }

        if (record.isNew || String(record.id).startsWith('new_')) {
          // Yeni kayıt ekle
          const insertQuery = `
            INSERT INTO AKTBLITSUTS (
              SERI_NO, LOT_NO, MIKTAR, STOK_KODU, GTIN,
              URETIM_TARIHI, HAR_RECNO, FATIRS_NO, FTIRSIP,
              CARI_KODU, TURU, KAYIT_TARIHI, SUBE_KODU, KAYIT_KULLANICI
            ) VALUES (
              @seriNo, @lot, @miktar, @stokKodu, @gtin,
              @uretimTarihi, @harRecno, @belgeNo, @ftirsip,
              @cariKodu, 'U', GETDATE(), @subeKodu, @kullanici
            )
          `

          const insertRequest = pool.request()
          insertRequest.input('seriNo', record.seriNo || '')
          insertRequest.input('lot', record.lot || '')
          insertRequest.input('miktar', record.miktar || 1)
          insertRequest.input('stokKodu', stokKodu)
          insertRequest.input('gtin', barcode || stokKodu)
          insertRequest.input('uretimTarihi', uretimTarihiYYMMDD)
          insertRequest.input('harRecno', itemId)
          insertRequest.input('belgeNo', belgeNo)
          insertRequest.input('ftirsip', docType)
          insertRequest.input('cariKodu', cariKodu)
          insertRequest.input('subeKodu', subeKodu)
          insertRequest.input('kullanici', kullanici)

          await insertRequest.query(insertQuery)
        } else {
          // Mevcut kaydı güncelle
          const updateQuery = `
            UPDATE AKTBLITSUTS
            SET SERI_NO = @seriNo,
                LOT_NO = @lot,
                MIKTAR = @miktar,
                URETIM_TARIHI = @uretimTarihi,
                KAYIT_KULLANICI = @kullanici,
                KAYIT_TARIHI = GETDATE()
            WHERE FATIRS_NO = @belgeNo
              AND HAR_RECNO = @harRecno
              AND RECNO = @recno
              AND TURU = 'U'
          `

          const updateRequest = pool.request()
          updateRequest.input('seriNo', record.seriNo || '')
          updateRequest.input('lot', record.lot || '')
          updateRequest.input('miktar', record.miktar || 1)
          updateRequest.input('uretimTarihi', uretimTarihiYYMMDD)
          updateRequest.input('belgeNo', belgeNo)
          updateRequest.input('harRecno', itemId)
          updateRequest.input('recno', record.siraNo || record.recno)
          updateRequest.input('kullanici', kullanici || 'SYSTEM')

          await updateRequest.query(updateQuery)
        }
      }

      return {
        success: true,
        message: `${records.length} UTS kaydı başarıyla işlendi`
      }
    } catch (error) {
      console.error('❌ UTS Kayıt Hatası:', error)
      throw error
    }
  },

  /**
   * UTS Kayıtlarını Sil
   */
  async deleteRecords(records, belgeNo, straInc, ftirsip, cariKodu, subeKodu) {
    try {
      const pool = await getConnection()

      for (const record of records) {
        const query = `
          DELETE FROM AKTBLITSUTS
          WHERE FATIRS_NO = @belgeNo
            AND HAR_RECNO = @straInc
            AND RECNO = @recno
            AND FTIRSIP = @ftirsip
            AND CARI_KODU = @cariKodu
            AND SUBE_KODU = @subeKodu
            AND TURU = 'U'
        `

        const request = pool.request()
        request.input('recno', record.siraNo || record.recno)
        request.input('belgeNo', belgeNo)
        request.input('straInc', straInc)
        request.input('ftirsip', ftirsip)
        request.input('cariKodu', cariKodu)
        request.input('subeKodu', subeKodu)

        await request.query(query)
      }

      return { success: true, deletedCount: records.length }

    } catch (error) {
      console.error('❌ UTS Kayıt Silme Hatası:', error)
      throw error
    }
  }
}

export default utsService


