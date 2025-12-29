import { getConnection } from '../config/database.js'
import { getCarrierProductsRecursive } from './ptsDbService.js'
import sql from 'mssql'

/**
 * Koli (Carrier) işlemleri servisi
 */
const carrierService = {
  /**
   * Koli Barkodu ile ITS Kayıtları Kaydet
   */
  async saveCarrierBarcode(params) {
    const {
      carrierLabel,
      docId,
      belgeNo,
      ftirsip,
      items,
      kullanici,
      subeKodu,
      cariKodu
    } = params

    try {
      const pool = await getConnection()

      // Koli içerisindeki ürünleri TBLPTSTRA'dan al
      const carrierProducts = await getCarrierProductsRecursive(carrierLabel)

      if (!carrierProducts || carrierProducts.length === 0) {
        return {
          success: false,
          message: 'Bu koli barkodu ile ürün bulunamadı'
        }
      }

      // Mükerrer seri no kontrolü
      const duplicates = []
      for (const product of carrierProducts) {
        const checkQuery = `
          SELECT COUNT(*) as count
          FROM AKTBLITSUTS WITH (NOLOCK)
          WHERE SERI_NO = @seriNo
            AND TURU = 'I'
            AND SUBE_KODU = @subeKodu
            AND FTIRSIP = @ftirsip
            AND FATIRS_NO = @belgeNo
            AND CARI_KODU = @cariKodu
        `

        const checkRequest = pool.request()
        checkRequest.input('seriNo', product.seriNo)
        checkRequest.input('subeKodu', subeKodu)
        checkRequest.input('ftirsip', ftirsip)
        checkRequest.input('belgeNo', belgeNo)
        checkRequest.input('cariKodu', cariKodu)

        const checkResult = await checkRequest.query(checkQuery)

        if (checkResult.recordset[0].count > 0) {
          duplicates.push(product.seriNo)
        }
      }

      if (duplicates.length > 0) {
        return {
          success: false,
          message: `Bu kolide daha önce kayıtlı seri numaraları var: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}`
        }
      }

      // GTIN bazında ürünleri grupla
      const gtinGroups = {}
      for (const product of carrierProducts) {
        const gtin = product.gtin?.replace(/^0+/, '') || ''
        if (!gtinGroups[gtin]) {
          gtinGroups[gtin] = []
        }
        gtinGroups[gtin].push(product)
      }

      // Her GTIN için ilgili item'ı bul ve miktar kontrolü yap
      const gtinCounts = {}
      const affectedGtins = []

      for (const [gtin, products] of Object.entries(gtinGroups)) {
        // Bu GTIN'e ait item'ı bul
        const matchingItem = items.find(item => {
          const itemGtin = (item.barcode || item.stokKodu || '').replace(/^0+/, '')
          return itemGtin === gtin
        })

        if (!matchingItem) {
          return {
            success: false,
            message: `Bu koli içindeki ürün (${gtin}) belgede bulunamadı`
          }
        }

        const remainingQty = matchingItem.quantity - (matchingItem.okutulan || 0)

        // Kalan miktar 0 veya altındaysa eklemeye izin verme
        if (remainingQty <= 0) {
          return {
            success: false,
            message: `${matchingItem.productName} için okutulacak ürün kalmadı (Tamamlandı)`
          }
        }

        gtinCounts[gtin] = products.length
        affectedGtins.push(gtin)
      }

      // Transaction başlat
      const transaction = new sql.Transaction(pool)
      await transaction.begin()

      try {
        let savedCount = 0

        for (const product of carrierProducts) {
          const gtin = product.gtin?.replace(/^0+/, '') || ''

          // Matching item'ı bul
          const matchingItem = items.find(item => {
            const itemGtin = (item.barcode || item.stokKodu || '').replace(/^0+/, '')
            return itemGtin === gtin
          })

          if (!matchingItem) continue

          const insertQuery = `
            INSERT INTO AKTBLITSUTS (
              SERI_NO, STOK_KODU, GTIN, MIAD, LOT_NO,
              HAR_RECNO, FATIRS_NO, FTIRSIP, CARI_KODU,
              CARRIER_LABEL, CONTAINER_TYPE,
              TURU, KAYIT_TARIHI, KAYIT_KULLANICI,SUBE_KODU
            ) VALUES (
              @seriNo, @stokKodu, @gtin, @miad, @lot,
              @harRecno, @fatirs_no, @ftirsip, @cariKodu,
              @carrierLabel, 'C',
              'I', GETDATE(), @kullanici, @subeKodu
            )
          `

          const insertRequest = transaction.request()
          insertRequest.input('seriNo', product.seriNo)
          insertRequest.input('stokKodu', matchingItem.stokKodu)
          insertRequest.input('gtin', gtin)

          // MIAD'ı YYMMDD string'den Date tipine dönüştür
          let miadDate = null
          if (product.miad && product.miad.length === 6) {
            const yy = product.miad.substring(0, 2)
            const mm = product.miad.substring(2, 4)
            const dd = product.miad.substring(4, 6)
            const yyyy = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`
            miadDate = new Date(`${yyyy}-${mm}-${dd}`)
          }
          insertRequest.input('miad', sql.Date, miadDate)

          insertRequest.input('lot', product.lot || '')
          insertRequest.input('harRecno', matchingItem.straInc)
          insertRequest.input('fatirs_no', belgeNo)
          insertRequest.input('ftirsip', ftirsip)
          insertRequest.input('cariKodu', matchingItem.cariKodu)
          insertRequest.input('carrierLabel', carrierLabel)
          insertRequest.input('kullanici', kullanici)
          insertRequest.input('subeKodu', subeKodu)

          await insertRequest.query(insertQuery)
          savedCount++
        }

        await transaction.commit()

        return {
          success: true,
          message: `${savedCount} ürün koliden başarıyla kaydedildi`,
          savedCount,
          affectedGtins,
          gtinCounts
        }
      } catch (error) {
        await transaction.rollback()
        throw error
      }
    } catch (error) {
      console.error('❌ Koli Kayıt Hatası:', error)
      throw error
    }
  },

  /**
   * Koli Barkoduna Göre ITS Kayıtlarını Sil
   */
  async deleteCarrierRecords(carrierLabel, docId) {
    try {
      const pool = await getConnection()

      // docId'yi parse et (format: SUBE_KODU|FTIRSIP|FATIRS_NO|CARI_KODU)
      const parts = docId.split('|')
      const subeKodu = parts[0]
      const ftirsip = parts[1]
      const belgeNo = parts[2]
      const cariKodu = parts[3]

      // Önce bu koli barkoduna sahip kayıtları ve GTIN bilgilerini al
      const selectQuery = `
        SELECT GTIN, COUNT(*) as COUNT
        FROM AKTBLITSUTS WITH (NOLOCK)
        WHERE CARRIER_LABEL = @carrierLabel
          AND FATIRS_NO = @belgeNo
          AND FTIRSIP = @ftirsip
          AND TURU = 'I'
          AND SUBE_KODU = @subeKodu
          AND CARI_KODU = @cariKodu
        GROUP BY GTIN
      `

      const selectRequest = pool.request()
      selectRequest.input('carrierLabel', carrierLabel)
      selectRequest.input('belgeNo', belgeNo)
      selectRequest.input('ftirsip', ftirsip)
      selectRequest.input('subeKodu', subeKodu)
      selectRequest.input('cariKodu', cariKodu)

      const selectResult = await selectRequest.query(selectQuery)

      if (selectResult.recordset.length === 0) {
        return {
          success: false,
          message: 'Bu koli barkodu ile kayıt bulunamadı',
          deletedCount: 0
        }
      }

      // GTIN bazında silinen miktarları topla
      const gtinCounts = {}
      let totalRecords = 0
      selectResult.recordset.forEach(row => {
        gtinCounts[row.GTIN] = row.COUNT
        totalRecords += row.COUNT
      })

      // Kayıtları sil
      const deleteQuery = `
        DELETE FROM AKTBLITSUTS
        WHERE CARRIER_LABEL = @carrierLabel
          AND FATIRS_NO = @belgeNo
          AND FTIRSIP = @ftirsip
          AND TURU = 'I'
          AND SUBE_KODU = @subeKodu
          AND CARI_KODU = @cariKodu
      `

      const deleteRequest = pool.request()
      deleteRequest.input('carrierLabel', carrierLabel)
      deleteRequest.input('belgeNo', belgeNo)
      deleteRequest.input('ftirsip', ftirsip)
      deleteRequest.input('subeKodu', subeKodu)
      deleteRequest.input('cariKodu', cariKodu)

      await deleteRequest.query(deleteQuery)

      // Etkilenen GTIN'leri döndür (temizlenmiş haliyle)
      const affectedGtins = Object.keys(gtinCounts)

      return {
        success: true,
        deletedCount: totalRecords,
        affectedGtins,
        gtinCounts,
        message: `${totalRecords} ürün koliden silindi`
      }

    } catch (error) {
      console.error('❌ Koli Silme Hatası:', error)
      throw error
    }
  },

  /**
   * Koli içerisindeki ürünleri getir
   */
  async getCarrierProducts(carrierLabel) {
    try {
      return await getCarrierProductsRecursive(carrierLabel)
    } catch (error) {
      console.error('❌ Koli Ürünleri Getirme Hatası:', error)
      throw error
    }
  }
}

export default carrierService


