import { getConnection } from '../config/database.js'
import sql from 'mssql'
import { getCurrentUsername } from '../utils/requestContext.js'

// Not: Türkçe karakter düzeltmesi SQL'de DBO.TRK fonksiyonu ile yapılıyor

/**
 * ITS (İlaç Takip Sistemi) işlemleri servisi
 */
const itsService = {
  /**
   * AKTBLITSUTS Kayıtlarını Getir (Belirli bir kalem için) - ITS
   */
  async getRecords(subeKodu, belgeNo, harRecno, ftirsip, cariKodu) {
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
          AND HAR_RECNO = @harRecno
          AND FTIRSIP = @ftirsip
          AND CARI_KODU = @cariKodu
          AND SUBE_KODU = @subeKodu
          AND TURU = 'I'
        ORDER BY SERI_NO
      `

      const request = pool.request()
      request.input('belgeNo', belgeNo)
      request.input('harRecno', harRecno)
      request.input('ftirsip', ftirsip)
      request.input('cariKodu', cariKodu)
      request.input('subeKodu', subeKodu)

      const result = await request.query(query)

      const records = result.recordset.map(row => ({
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
      subeKodu
    } = params

    // Kullanıcıyı context'ten al
    const kullanici = getCurrentUsername()

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
          AND SUBE_KODU = @subeKodu
          AND FTIRSIP = @ftirsip
          AND CARI_KODU = @cariKodu
      `

      const checkRequest = pool.request()
      checkRequest.input('fatirs_no', fatirs_no)
      checkRequest.input('harRecno', harRecno)
      checkRequest.input('seriNo', seriNo)
      checkRequest.input('subeKodu', subeKodu)
      checkRequest.input('ftirsip', ftirsip)
      checkRequest.input('cariKodu', cariKodu)

      const checkResult = await checkRequest.query(checkQuery)

      if (checkResult.recordset[0].count > 0) {
        return { success: false, message: 'Bu seri numarası zaten kayıtlı!' }
      }

      // Yeni kayıt ekle
      const insertQuery = `
        INSERT INTO AKTBLITSUTS (
          SERI_NO, STOK_KODU, GTIN, MIAD, LOT_NO,
          HAR_RECNO, FATIRS_NO, FTIRSIP, CARI_KODU,
          TURU, KAYIT_TARIHI, SUBE_KODU, KAYIT_KULLANICI
        ) VALUES (
          @seriNo, @stokKodu, @gtin, @miad, @lot,
          @harRecno, @fatirs_no, @ftirsip, @cariKodu,
          'I', GETDATE(), @subeKodu, @kullanici
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
      insertRequest.input('kullanici', kullanici)
      insertRequest.input('subeKodu', subeKodu)

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
  async deleteRecords(seriNos, belgeNo, harRecno, ftirsip, cariKodu, subeKodu) {
    try {
      const pool = await getConnection()

      // Önce silinecek kayıtların CARRIER_LABEL değerlerini al
      const carrierLabelsToUpdate = new Set()

      for (const seriNo of seriNos) {
        const checkQuery = `
          SELECT CARRIER_LABEL
          FROM AKTBLITSUTS WITH (NOLOCK)
          WHERE FATIRS_NO = @belgeNo
            AND HAR_RECNO = @harRecno
            AND SERI_NO = @seriNo
            AND TURU = 'I'
            AND CARRIER_LABEL IS NOT NULL
            AND SUBE_KODU = @subeKodu
            AND FTIRSIP = @ftirsip
            AND CARI_KODU = @cariKodu
        `

        const checkRequest = pool.request()
        checkRequest.input('belgeNo', belgeNo)
        checkRequest.input('harRecno', harRecno)
        checkRequest.input('seriNo', seriNo)
        checkRequest.input('subeKodu', subeKodu)
        checkRequest.input('ftirsip', ftirsip)
        checkRequest.input('cariKodu', cariKodu)

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
              AND HAR_RECNO = @harRecno
              AND CARRIER_LABEL = @carrierLabel
              AND TURU = 'I'
              AND SUBE_KODU = @subeKodu
              AND FTIRSIP = @ftirsip
              AND CARI_KODU = @cariKodu
          `

          const updateRequest = pool.request()
          updateRequest.input('belgeNo', belgeNo)
          updateRequest.input('harRecno', harRecno)
          updateRequest.input('carrierLabel', carrierLabel)
          updateRequest.input('subeKodu', subeKodu)
          updateRequest.input('ftirsip', ftirsip)
          updateRequest.input('cariKodu', cariKodu)

          await updateRequest.query(updateQuery)
        }
      }

      // Seri numaralarını tek tek sil
      let deletedCount = 0
      for (const seriNo of seriNos) {
        const query = `
          DELETE FROM AKTBLITSUTS
          WHERE FATIRS_NO = @belgeNo
            AND HAR_RECNO = @harRecno
            AND SERI_NO = @seriNo
            AND TURU = 'I'
            AND SUBE_KODU = @subeKodu
            AND FTIRSIP = @ftirsip
            AND CARI_KODU = @cariKodu
        `

        const request = pool.request()
        request.input('belgeNo', belgeNo)
        request.input('harRecno', harRecno)
        request.input('seriNo', seriNo)
        request.input('subeKodu', subeKodu)
        request.input('ftirsip', ftirsip)
        request.input('cariKodu', cariKodu)

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
   * Toplu ITS Karekod Kaydet - Batch INSERT ile optimize edilmiş
   */
  async bulkSave(parsedBarcodes, documentInfo) {
    const results = {
      totalCount: parsedBarcodes.length,
      successCount: 0,
      errorCount: 0,
      duplicateCount: 0,
      errors: []
    }

    if (!parsedBarcodes || parsedBarcodes.length === 0) {
      return results
    }

    try {
      const pool = await getConnection()
      const kullanici = getCurrentUsername() // Context'ten al

      // SQL Server parametre limiti: 2100, güvenli chunk boyutu: 500
      const CHECK_CHUNK_SIZE = 500
      const INSERT_CHUNK_SIZE = 100 // Her kayıt için ~10 parametre, güvenli limit

      // 1. Mevcut seri numaralarını chunk'lar halinde kontrol et
      const existingSerials = new Set()
      const allSeriNos = parsedBarcodes.map(p => p.seriNo)

      for (let i = 0; i < allSeriNos.length; i += CHECK_CHUNK_SIZE) {
        const chunk = allSeriNos.slice(i, i + CHECK_CHUNK_SIZE)

        const existingQuery = `
          SELECT SERI_NO
          FROM AKTBLITSUTS WITH (NOLOCK)
          WHERE FATIRS_NO = @belgeNo
            AND FTIRSIP = @ftirsip
            AND CARI_KODU = @cariKodu
            AND SUBE_KODU = @subeKodu
            AND TURU = 'I'
            AND SERI_NO IN (${chunk.map((_, idx) => `@s${idx}`).join(',')})
        `

        const existingRequest = pool.request()
        existingRequest.input('belgeNo', documentInfo.belgeNo)
        existingRequest.input('ftirsip', documentInfo.ftirsip)
        existingRequest.input('cariKodu', documentInfo.cariKodu)
        existingRequest.input('subeKodu', documentInfo.subeKodu)
        chunk.forEach((sn, idx) => existingRequest.input(`s${idx}`, sn))

        const existingResult = await existingRequest.query(existingQuery)
        existingResult.recordset.forEach(r => existingSerials.add(r.SERI_NO))
      }

      // 2. Yeni kayıtları filtrele
      const newRecords = []
      parsedBarcodes.forEach((p, index) => {
        if (existingSerials.has(p.seriNo)) {
          results.duplicateCount++
          results.errors.push({ line: p.line || index + 1, message: 'Bu seri numarası zaten kayıtlı' })
        } else {
          newRecords.push(p)
        }
      })

      if (newRecords.length === 0) {
        results.errorCount = results.duplicateCount
        return results
      }

      // 3. Batch INSERT - küçük chunk'lar halinde
      for (let i = 0; i < newRecords.length; i += INSERT_CHUNK_SIZE) {
        const chunk = newRecords.slice(i, i + INSERT_CHUNK_SIZE)

        // VALUES listesi oluştur
        const valuesList = chunk.map((record, idx) => {
          return `(@seri${idx}, @stok${idx}, @gtin${idx}, @miad${idx}, @lot${idx}, @harRecno, @fatirs_no, @ftirsip, @cariKodu, 'I', GETDATE(), @subeKodu, @kullanici, 1)`
        }).join(',\n        ')

        const insertQuery = `
          INSERT INTO AKTBLITSUTS (
            SERI_NO, STOK_KODU, GTIN, MIAD, LOT_NO,
            HAR_RECNO, FATIRS_NO, FTIRSIP, CARI_KODU,
            TURU, KAYIT_TARIHI, SUBE_KODU, KAYIT_KULLANICI, MIKTAR
          ) VALUES ${valuesList}
        `

        const insertRequest = pool.request()
        insertRequest.input('harRecno', documentInfo.harRecno)
        insertRequest.input('fatirs_no', documentInfo.belgeNo)
        insertRequest.input('ftirsip', documentInfo.ftirsip)
        insertRequest.input('cariKodu', documentInfo.cariKodu)
        insertRequest.input('subeKodu', documentInfo.subeKodu)
        insertRequest.input('kullanici', kullanici)

        chunk.forEach((record, idx) => {
          insertRequest.input(`seri${idx}`, record.seriNo)
          insertRequest.input(`stok${idx}`, record.stokKodu || documentInfo.stokKodu)
          insertRequest.input(`gtin${idx}`, record.gtin)
          insertRequest.input(`miad${idx}`, record.miad || null)
          insertRequest.input(`lot${idx}`, record.lot || '')
        })

        await insertRequest.query(insertQuery)
        results.successCount += chunk.length
      }

      results.errorCount = results.duplicateCount

      console.log(`✅ Toplu ITS Kayıt: ${results.successCount}/${results.totalCount} başarılı, ${results.duplicateCount} mükerrer`)
      return results

    } catch (error) {
      console.error('❌ Toplu ITS Kayıt Hatası:', error)
      console.error('documentInfo:', documentInfo)
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


