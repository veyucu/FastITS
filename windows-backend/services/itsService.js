import { getConnection } from '../config/database.js'
import { fixObjectStrings } from '../utils/stringUtils.js'
import sql from 'mssql'

/**
 * ITS (İlaç Takip Sistemi) işlemleri servisi
 */
const itsService = {
  /**
   * AKTBLITSUTS Kayıtlarını Getir (Belirli bir kalem için) - ITS
   */
  async getRecords(subeKodu, belgeNo, straInc) {
    try {
      const pool = await getConnection()

      const query = `
        SELECT
          RECNO,
          SERI_NO,
          STOK_KODU,
          GTIN AS BARKOD,
          MIAD,
          LOT_NO AS LOT,
          CARRIER_LABEL,
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
          AND TURU = 'I'
        ORDER BY SERI_NO
      `

      const request = pool.request()
      request.input('belgeNo', belgeNo)
      request.input('straInc', straInc)

      const result = await request.query(query)

      const records = result.recordset.map(row => fixObjectStrings({
        recno: row.RECNO,
        seriNo: row.SERI_NO,
        stokKodu: row.STOK_KODU,
        barkod: row.BARKOD,
        miad: row.MIAD,
        lot: row.LOT,
        carrierLabel: row.CARRIER_LABEL,
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
      console.error('❌ ITS Kayıtları Getirme Hatası:', error)
      throw error
    }
  },

  /**
   * ITS Karekod Kaydet
   */
  async saveBarcode(params) {
    const {
      seriNo,
      stokKodu,
      gtin,
      miad,
      lot,
      harRecno,
      fatirs_no,
      ftirsip,
      cariKodu,
      kullanici
    } = params

    try {
      const pool = await getConnection()

      // Mükerrer seri no kontrolü
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM AKTBLITSUTS WITH (NOLOCK)
        WHERE FATIRS_NO = @fatirs_no
          AND HAR_RECNO = @harRecno
          AND SERI_NO = @seriNo
          AND TURU = 'I'
      `

      const checkRequest = pool.request()
      checkRequest.input('fatirs_no', fatirs_no)
      checkRequest.input('harRecno', harRecno)
      checkRequest.input('seriNo', seriNo)

      const checkResult = await checkRequest.query(checkQuery)

      if (checkResult.recordset[0].count > 0) {
        return { success: false, message: 'Bu seri numarası zaten kayıtlı!' }
      }

      // Yeni kayıt ekle
      const insertQuery = `
        INSERT INTO AKTBLITSUTS (
          SERI_NO, STOK_KODU, GTIN, MIAD, LOT_NO,
          HAR_RECNO, FATIRS_NO, FTIRSIP, CARI_KODU,
          TURU, KAYIT_TARIHI, BILDIRIM, KAYIT_KULLANICI
        ) VALUES (
          @seriNo, @stokKodu, @gtin, @miad, @lot,
          @harRecno, @fatirs_no, @ftirsip, @cariKodu,
          'I', GETDATE(), 'A', @kullanici
        )
      `

      const insertRequest = pool.request()
      insertRequest.input('seriNo', seriNo)
      insertRequest.input('stokKodu', stokKodu)
      insertRequest.input('gtin', gtin)
      insertRequest.input('miad', miad)
      insertRequest.input('lot', lot)
      insertRequest.input('harRecno', harRecno)
      insertRequest.input('fatirs_no', fatirs_no)
      insertRequest.input('ftirsip', ftirsip)
      insertRequest.input('cariKodu', cariKodu)
      insertRequest.input('kullanici', kullanici || 'SYSTEM')

      await insertRequest.query(insertQuery)

      return { success: true, message: 'ITS kaydı başarıyla eklendi' }
    } catch (error) {
      console.error('❌ ITS Kayıt Hatası:', error)
      throw error
    }
  },

  /**
   * ITS Kayıtlarını Sil
   */
  async deleteRecords(seriNos, belgeNo, straInc) {
    try {
      const pool = await getConnection()

      // Önce silinecek kayıtların CARRIER_LABEL değerlerini al
      const carrierLabelsToUpdate = new Set()

      for (const seriNo of seriNos) {
        const checkQuery = `
          SELECT CARRIER_LABEL
          FROM AKTBLITSUTS WITH (NOLOCK)
          WHERE FATIRS_NO = @belgeNo
            AND HAR_RECNO = @straInc
            AND SERI_NO = @seriNo
            AND TURU = 'I'
            AND CARRIER_LABEL IS NOT NULL
        `

        const checkRequest = pool.request()
        checkRequest.input('belgeNo', belgeNo)
        checkRequest.input('straInc', straInc)
        checkRequest.input('seriNo', seriNo)

        const checkResult = await checkRequest.query(checkQuery)
        if (checkResult.recordset.length > 0 && checkResult.recordset[0].CARRIER_LABEL) {
          carrierLabelsToUpdate.add(checkResult.recordset[0].CARRIER_LABEL)
        }
      }

      // Koli bütünlüğü korunuyor
      if (carrierLabelsToUpdate.size > 0) {
        for (const carrierLabel of carrierLabelsToUpdate) {
          const updateQuery = `
            UPDATE AKTBLITSUTS
            SET CARRIER_LABEL = NULL, CONTAINER_TYPE = NULL
            WHERE FATIRS_NO = @belgeNo
              AND HAR_RECNO = @straInc
              AND CARRIER_LABEL = @carrierLabel
              AND TURU = 'I'
          `

          const updateRequest = pool.request()
          updateRequest.input('belgeNo', belgeNo)
          updateRequest.input('straInc', straInc)
          updateRequest.input('carrierLabel', carrierLabel)

          await updateRequest.query(updateQuery)
        }
      }

      // Seri numaralarını tek tek sil
      let deletedCount = 0
      for (const seriNo of seriNos) {
        const query = `
          DELETE FROM AKTBLITSUTS
          WHERE FATIRS_NO = @belgeNo
            AND HAR_RECNO = @straInc
            AND SERI_NO = @seriNo
            AND TURU = 'I'
        `

        const request = pool.request()
        request.input('belgeNo', belgeNo)
        request.input('straInc', straInc)
        request.input('seriNo', seriNo)

        const result = await request.query(query)
        if (result.rowsAffected[0] > 0) {
          deletedCount++
        }
      }

      return { success: true, deletedCount }

    } catch (error) {
      console.error('❌ ITS Kayıt Silme Hatası:', error)
      throw error
    }
  },

  /**
   * Toplu ITS Karekod Kaydet
   */
  async bulkSave(barcodes, documentInfo, kullanici) {
    const results = {
      totalCount: barcodes.length,
      successCount: 0,
      errorCount: 0,
      errors: []
    }

    try {
      const pool = await getConnection()

      for (let i = 0; i < barcodes.length; i++) {
        const barcode = barcodes[i].trim()
        if (!barcode) continue

        try {
          const parsed = this.parseBarcode(barcode)
          if (!parsed) {
            results.errors.push({ line: i + 1, message: 'Geçersiz karekod formatı' })
            results.errorCount++
            continue
          }

          // Mükerrer kontrolü
          const checkQuery = `
            SELECT COUNT(*) as count
            FROM AKTBLITSUTS WITH (NOLOCK)
            WHERE SERI_NO = @seriNo
              AND TURU = 'I'
          `

          const checkRequest = pool.request()
          checkRequest.input('seriNo', parsed.serialNumber)

          const checkResult = await checkRequest.query(checkQuery)

          if (checkResult.recordset[0].count > 0) {
            results.errors.push({ line: i + 1, message: 'Bu seri numarası zaten kayıtlı' })
            results.errorCount++
            continue
          }

          // Kaydet
          const insertQuery = `
            INSERT INTO AKTBLITSUTS (
              SERI_NO, STOK_KODU, GTIN, MIAD, LOT_NO,
              HAR_RECNO, FATIRS_NO, FTIRSIP, CARI_KODU,
              TURU, KAYIT_TARIHI, BILDIRIM, KAYIT_KULLANICI
            ) VALUES (
              @seriNo, @stokKodu, @gtin, @miad, @lot,
              @harRecno, @fatirs_no, @ftirsip, @cariKodu,
              'I', GETDATE(), 'A', @kullanici
            )
          `

          const insertRequest = pool.request()
          insertRequest.input('seriNo', parsed.serialNumber)
          insertRequest.input('stokKodu', documentInfo.stokKodu)
          insertRequest.input('gtin', parsed.gtin)
          insertRequest.input('miad', parsed.expiryDate)
          insertRequest.input('lot', parsed.lotNumber)
          insertRequest.input('harRecno', documentInfo.harRecno)
          insertRequest.input('fatirs_no', documentInfo.belgeNo)
          insertRequest.input('ftirsip', documentInfo.ftirsip)
          insertRequest.input('cariKodu', documentInfo.cariKodu)
          insertRequest.input('kullanici', kullanici || 'SYSTEM')

          await insertRequest.query(insertQuery)
          results.successCount++

        } catch (error) {
          results.errors.push({ line: i + 1, message: error.message })
          results.errorCount++
        }
      }

      return results
    } catch (error) {
      console.error('❌ Toplu ITS Kayıt Hatası:', error)
      throw error
    }
  },

  /**
   * ITS Barkod Parse
   */
  parseBarcode(barcode) {
    if (!barcode || barcode.length < 30) {
      return null
    }

    try {
      const ai01Index = barcode.indexOf('01')
      const ai21Index = barcode.indexOf('21')

      if (ai01Index === -1 || ai21Index === -1) {
        return null
      }

      // GTIN: 01'den sonraki 14 karakter
      const gtin = barcode.substring(ai01Index + 2, ai01Index + 16)

      // Doğru 17 pozisyonunu bul
      let correctAi17Index = -1
      let searchStart = ai21Index + 2

      while (true) {
        const tempIndex = barcode.indexOf('17', searchStart)
        if (tempIndex === -1) break

        if (tempIndex + 8 <= barcode.length) {
          const afterDate = barcode.substring(tempIndex + 8, tempIndex + 10)
          if (afterDate === '10') {
            correctAi17Index = tempIndex
            break
          }
        }
        searchStart = tempIndex + 1
      }

      if (correctAi17Index === -1) {
        return null
      }

      // Seri No: 21'den sonra, doğru 17'ye kadar
      const serialNumber = barcode.substring(ai21Index + 2, correctAi17Index)

      // MIAD: 17'den sonra 6 karakter (YYMMDD)
      const expiryDate = barcode.substring(correctAi17Index + 2, correctAi17Index + 8)

      // Lot: 10'dan sonra, barkod sonuna kadar
      const lotStartIndex = correctAi17Index + 8 + 2
      const lotNumber = barcode.substring(lotStartIndex)

      return {
        gtin: gtin.replace(/^0+/, ''),
        gtinRaw: gtin,
        serialNumber,
        expiryDate,
        lotNumber,
        isValid: true
      }
    } catch (error) {
      console.error('Barkod parse hatası:', error)
      return null
    }
  }
}

export default itsService


