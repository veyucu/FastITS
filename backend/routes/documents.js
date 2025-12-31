import express from 'express'
import documentService from '../services/documentService.js'
import itsService from '../services/itsService.js'
import { parseITSBarcode, formatMiad } from '../utils/itsParser.js'
import { log } from '../utils/logger.js'
import companyMiddleware from '../middleware/companyMiddleware.js'

const router = express.Router()

// Tüm document route'larına company middleware uygula
router.use(companyMiddleware)

// GET /api/documents - Tüm belgeleri getir (tarih zorunlu)
router.get('/', async (req, res) => {
  try {
    // Tarih parametresi zorunlu
    const date = req.query.date

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Tarih parametresi zorunludur (date)'
      })
    }

    const documents = await documentService.getAllDocuments(date)

    res.json({
      success: true,
      documents: documents,
      count: documents.length,
      date: date
    })
  } catch (error) {
    console.error('Belgeler getirme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'Belgeler alınamadı',
      error: error.message
    })
  }
})

// GET /api/documents/:id - Belirli bir belgeyi getir
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    // ID formatı: SUBE_KODU|FTIRSIP|FATIRS_NO|CARI_KODU
    const parts = id.split('|')

    if (parts.length !== 4) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz belge ID formatı'
      })
    }

    const [subeKodu, ftirsip, fatirs_no, cariKodu] = parts

    const document = await documentService.getDocumentById(subeKodu, ftirsip, fatirs_no, cariKodu)

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Belge bulunamadı'
      })
    }

    res.json({
      success: true,
      data: document
    })
  } catch (error) {
    console.error('Belge detay hatası:', error)
    res.status(500).json({
      success: false,
      message: 'Belge detayı alınamadı',
      error: error.message
    })
  }
})

// GET /api/documents/:documentId/its-all-records - Belgedeki Tüm ITS Kayıtlarını Getir
router.get('/:documentId/its-all-records', async (req, res) => {
  try {
    const { documentId } = req.params
    const { cariKodu } = req.query

    // Document ID parse et
    const [subeKodu, ftirsip, fatirs_no, cariKoduFromId] = documentId.split('|')

    if (!cariKodu) {
      return res.status(400).json({
        success: false,
        message: 'cariKodu parametresi zorunludur'
      })
    }

    const records = await documentService.getAllITSRecordsForDocument(
      subeKodu,
      fatirs_no,
      ftirsip,
      cariKodu
    )

    res.json({
      success: true,
      data: records,
      count: records.length
    })

  } catch (error) {
    console.error('❌ Tüm ITS Kayıtları Getirme Hatası:', error)
    res.status(500).json({
      success: false,
      message: 'ITS kayıtları alınamadı',
      error: error.message
    })
  }
})

// GET /api/documents/:documentId/uts-all-records - Belgedeki Tüm UTS Kayıtlarını Getir
router.get('/:documentId/uts-all-records', async (req, res) => {
  try {
    const { documentId } = req.params
    const { cariKodu } = req.query

    // Document ID parse et
    const [subeKodu, ftirsip, fatirs_no, cariKoduFromId] = documentId.split('|')

    if (!cariKodu) {
      return res.status(400).json({
        success: false,
        message: 'cariKodu parametresi zorunludur'
      })
    }

    const records = await documentService.getAllUTSRecordsForDocument(
      subeKodu,
      fatirs_no,
      ftirsip,
      cariKodu
    )

    res.json({
      success: true,
      data: records,
      count: records.length
    })

  } catch (error) {
    console.error('❌ Tüm UTS Kayıtları Getirme Hatası:', error)
    res.status(500).json({
      success: false,
      message: 'UTS kayıtları alınamadı',
      error: error.message
    })
  }
})

// GET /api/documents/:documentId/item/:itemId/its-records - ITS Kayıtlarını Getir
router.get('/:documentId/item/:itemId/its-records', async (req, res) => {
  try {
    const { documentId, itemId } = req.params

    // Document ID parse et (format: SUBE_KODU|FTIRSIP|FATIRS_NO|CARI_KODU)
    const [subeKodu, ftirsip, fatirs_no, cariKodu] = documentId.split('|')

    const records = await documentService.getITSBarcodeRecords(
      subeKodu,
      fatirs_no,
      itemId,
      ftirsip,
      cariKodu
    )

    res.json({
      success: true,
      data: records,
      count: records.length
    })

  } catch (error) {
    console.error('❌ ITS Kayıtları Getirme Hatası:', error)
    res.status(500).json({
      success: false,
      message: 'ITS kayıtları alınamadı',
      error: error.message
    })
  }
})

// GET /api/documents/:documentId/item/:itemId/uts-records - UTS Kayıtlarını Getir
router.get('/:documentId/item/:itemId/uts-records', async (req, res) => {
  try {
    const { documentId, itemId } = req.params

    // Document ID parse et (format: SUBE_KODU|FTIRSIP|FATIRS_NO|CARI_KODU)
    const [subeKodu, ftirsip, fatirs_no, cariKodu] = documentId.split('|')

    // Kayıt tipi belirle
    const kayitTipi = ftirsip === '6' ? 'M' : 'A'

    const records = await documentService.getUTSBarcodeRecords(
      subeKodu,
      fatirs_no,
      itemId,
      kayitTipi,
      ftirsip,
      cariKodu
    )

    res.json({
      success: true,
      data: records,
      count: records.length
    })

  } catch (error) {
    console.error('❌ UTS Kayıtları Getirme Hatası:', error)
    res.status(500).json({
      success: false,
      message: 'UTS kayıtları alınamadı',
      error: error.message
    })
  }
})

// DELETE /api/documents/:documentId/item/:itemId/its-records - ITS/DGR/UTS Kayıtlarını Sil
router.delete('/:documentId/item/:itemId/its-records', async (req, res) => {
  try {
    const { documentId, itemId } = req.params
    const { seriNos, turu = 'ITS' } = req.body // Array of seri numbers to delete, turu (ITS/DGR/UTS)

    log('🗑️ Kayıt Silme İsteği:', { documentId, itemId, seriNos, turu })

    if (!seriNos || !Array.isArray(seriNos) || seriNos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Silinecek seri numaraları belirtilmeli'
      })
    }

    // Document ID parse et (format: SUBE_KODU|FTIRSIP|FATIRS_NO|CARI_KODU)
    const [subeKodu, ftirsip, fatirs_no, cariKodu] = documentId.split('|')

    // TURU değerini mapping yap (ITS -> I, UTS -> U, DGR -> D)
    let turuMapped = turu
    if (turu === 'ITS') turuMapped = 'I'
    else if (turu === 'UTS') turuMapped = 'U'
    else if (turu === 'DGR') turuMapped = 'D'

    log('📋 Parse edilmiş değerler:', { subeKodu, ftirsip, fatirs_no, cariKodu, harRecno: itemId, turu, turuMapped })

    const result = await documentService.deleteITSBarcodeRecords(
      seriNos,
      subeKodu,
      fatirs_no,
      itemId,
      turuMapped,
      ftirsip,
      cariKodu
    )

    log('✅ Silme sonucu:', result)

    res.json({
      success: true,
      message: `${result.deletedCount} kayıt silindi`,
      deletedCount: result.deletedCount
    })

  } catch (error) {
    console.error('❌ ITS Kayıt Silme Hatası:', error)
    res.status(500).json({
      success: false,
      message: 'ITS kayıtları silinemedi',
      error: error.message
    })
  }
})

// DELETE /api/documents/:documentId/item/:itemId/uts-records - UTS Kayıtlarını Sil
router.delete('/:documentId/item/:itemId/uts-records', async (req, res) => {
  try {
    const { documentId, itemId } = req.params
    const { records } = req.body // Array of records {seriNo, lot} to delete

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Silinecek kayıtlar belirtilmeli'
      })
    }

    // Document ID parse et (format: SUBE_KODU|FTIRSIP|FATIRS_NO|CARI_KODU)
    const [subeKodu, ftirsip, fatirs_no, cariKodu] = documentId.split('|')

    const result = await documentService.deleteUTSBarcodeRecords(
      records,
      subeKodu,
      fatirs_no,
      itemId,
      ftirsip,
      cariKodu
    )

    res.json({
      success: true,
      message: `${result.deletedCount} kayıt silindi`,
      deletedCount: result.deletedCount
    })

  } catch (error) {
    console.error('❌ UTS Kayıt Silme Hatası:', error)
    res.status(500).json({
      success: false,
      message: 'UTS kayıtları silinemedi',
      error: error.message
    })
  }
})

// POST /api/documents/its-barcode-bulk - Toplu ITS Karekod Kaydet (Batch INSERT)
router.post('/its-barcode-bulk', async (req, res) => {
  try {
    const {
      barcodes,     // Array of pre-parsed barcodes: [{seriNo, gtin, miad, lot, stokKodu, line}, ...]
      documentInfo  // {belgeNo, ftirsip, cariKodu, subeKodu, harRecno, stokKodu}
    } = req.body

    log('📦 Toplu ITS Karekod İsteği:', { count: barcodes?.length, belgeNo: documentInfo?.belgeNo, kullanici: req.username })

    if (!barcodes || !Array.isArray(barcodes) || barcodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Barkod listesi boş veya geçersiz'
      })
    }

    if (!documentInfo?.belgeNo || !documentInfo?.ftirsip || !documentInfo?.cariKodu || !documentInfo?.subeKodu) {
      console.log('❌ Eksik field:', { belgeNo: documentInfo?.belgeNo, ftirsip: documentInfo?.ftirsip, cariKodu: documentInfo?.cariKodu, subeKodu: documentInfo?.subeKodu })
      return res.status(400).json({
        success: false,
        message: `Belge bilgileri eksik: ${!documentInfo?.belgeNo ? 'belgeNo ' : ''}${!documentInfo?.ftirsip ? 'ftirsip ' : ''}${!documentInfo?.cariKodu ? 'cariKodu ' : ''}${!documentInfo?.subeKodu ? 'subeKodu' : ''}`
      })
    }

    // itsService.bulkSave çağır - kullanıcı req.username'den alınır
    const result = await itsService.bulkSave(barcodes, documentInfo, req.username)

    log('✅ Toplu ITS Kayıt Sonucu:', result)
    res.json({
      success: true,
      ...result
    })

  } catch (error) {
    console.error('❌ Toplu ITS Kayıt Hatası:', error)
    res.status(500).json({
      success: false,
      message: 'Toplu kayıt başarısız',
      error: error.message
    })
  }
})

router.post('/its-barcode', async (req, res) => {
  try {
    const {
      barcode,      // ITS 2D Karekod (opsiyonel - frontend parse ettiyse)
      documentId,   // Belge ID (SUBE_KODU-FTIRSIP-FATIRS_NO)
      itemId,       // INCKEYNO (opsiyonel - eski format)
      harRecno,     // HAR_RECNO (yeni format)
      stokKodu,
      belgeTip,     // STHAR_HTUR (opsiyonel)
      gckod,        // STHAR_GCKOD (opsiyonel)
      belgeNo,
      belgeTarihi,  // (opsiyonel)
      docType,      // '6' = Sipariş, '1'/'2' = Fatura (opsiyonel)
      expectedQuantity,  // Beklenen miktar
      // Frontend'den pre-parsed gelebilir:
      seriNo,
      miad,
      lotNo,
      ilcGtin,
      subeKodu: subeKoduFromBody,
      ftirsip: ftirsipFromBody,
      cariKodu: cariKoduFromBody
    } = req.body

    let parsedData
    let subeKodu, ftirsip, cariKodu

    // Frontend parse etmiş mi?
    if (seriNo && miad && lotNo && ilcGtin) {
      // Pre-parsed data geldi
      log('📱 ITS Karekod İsteği (pre-parsed):', { seriNo, ilcGtin, harRecno: (harRecno || itemId) })
      parsedData = {
        seriNo,
        miad,
        lot: lotNo,
        barkod: ilcGtin
      }
      subeKodu = subeKoduFromBody
      ftirsip = ftirsipFromBody
      cariKodu = cariKoduFromBody
    } else if (barcode && documentId) {
      // Eski format: raw barcode parse et
      log('📱 ITS Karekod İsteği (raw):', { barcode, documentId, itemId, expectedQuantity })

      const parseResult = parseITSBarcode(barcode)
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Karekod parse edilemedi: ' + parseResult.error
        })
      }
      parsedData = parseResult.data

      // Belge ID'sini parse et
      const parts = documentId.split('|')
      subeKodu = parts[0]
      ftirsip = parts[1]
      cariKodu = parts[3]
    } else {
      return res.status(400).json({
        success: false,
        message: 'Eksik parametre: barcode+documentId veya seriNo+miad+lotNo+ilcGtin gerekli'
      })
    }

    // AKTBLITSUTS'a kaydet
    const saveResult = await documentService.saveITSBarcode({
      seriNo: parsedData.seriNo,
      stokKodu,
      harRecno: harRecno || itemId,
      miad: parsedData.miad,
      lotNo: parsedData.lot,
      belgeNo,
      subeKodu,
      ilcGtin: parsedData.barkod,
      expectedQuantity,
      ftirsip,
      cariKodu,
      kullanici: req.body.kullanici
    })

    // Duplicate kontrolü
    if (!saveResult.success) {
      log('⚠️ ITS Karekod kaydedilemedi:', saveResult.error, saveResult.message)
      return res.status(400).json(saveResult)
    }

    log('✅ ITS Karekod başarıyla kaydedildi!')
    res.json({
      success: true,
      message: 'ITS karekod başarıyla kaydedildi',
      data: {
        barkod: parsedData.barkod,
        seriNo: parsedData.seriNo,
        miad: formatMiad(parsedData.miad),
        lot: parsedData.lot
      }
    })

  } catch (error) {
    console.error('❌ ITS Karekod Kaydetme Hatası:', error)
    res.status(500).json({
      success: false,
      message: 'ITS karekod kaydedilemedi',
      error: error.message
    })
  }
})

// POST /api/documents/uts-barcode - UTS Barkod Okut ve Kaydet
router.post('/uts-barcode', async (req, res) => {
  try {
    const {
      barcode,          // Normal Barkod
      documentId,       // Belge ID (SUBE_KODU-FTIRSIP-FATIRS_NO)
      itemId,           // INCKEYNO
      stokKodu,         // Stok Kodu
      belgeTip,         // STHAR_HTUR
      gckod,            // STHAR_GCKOD
      belgeNo,          // Belge No
      belgeTarihi,      // Belge Tarihi
      docType,          // '6' = Sipariş, '1'/'2' = Fatura
      expectedQuantity, // Beklenen miktar (kalem miktarı)
      seriNo,           // Seri No (opsiyonel)
      lotNo,            // Lot No (opsiyonel)
      uretimTarihi,     // Üretim Tarihi
      miktar            // Miktar
    } = req.body

    log('🔴 UTS Barkod İsteği:', { barcode, documentId, itemId, stokKodu, seriNo, lotNo, miktar })

    // Belge ID'sini parse et
    const [subeKodu, ftirsip, fatirs_no, cariKodu] = documentId.split('|')

    // KAYIT_TIPI belirle (Sipariş = M, Fatura = A)
    const kayitTipi = docType === '6' ? 'M' : 'A'

    // TBLSERITRA'ya kaydet veya güncelle
    const saveResult = await documentService.saveUTSBarcode({
      kayitTipi,
      seriNo,
      lotNo,
      stokKodu,
      harRecno: itemId,
      tarih: belgeTarihi,
      uretimTarihi,
      gckod,
      miktar,
      belgeNo,
      belgeTip,
      subeKodu,
      ilcGtin: barcode,
      expectedQuantity,
      ftirsip,                     // Belge tipi: '6'=Sipariş, '2'=Alış, '1'=Satış
      cariKodu: req.body.cariKodu,         // Belgedeki CARI_KODU (ZORUNLU)
      kullanici: req.body.kullanici        // Sisteme giriş yapan kullanıcı (ZORUNLU)
    })

    if (!saveResult.success) {
      log('⚠️ UTS Barkod kaydedilemedi:', saveResult.message)
      return res.status(400).json(saveResult)
    }

    log('✅ UTS Barkod başarıyla kaydedildi!')
    res.json({
      success: true,
      message: saveResult.data.isUpdate
        ? `UTS barkod güncellendi (${saveResult.data.miktar} adet)`
        : 'UTS barkod başarıyla kaydedildi',
      data: saveResult.data
    })

  } catch (error) {
    console.error('❌ UTS Barkod Kaydetme Hatası:', error)
    res.status(500).json({
      success: false,
      message: 'UTS barkod kaydedilemedi',
      error: error.message
    })
  }
})

// POST /api/documents/uts-records/bulk-save - UTS Kayıtlarını Toplu Kaydet/Güncelle/Sil
router.post('/uts-records/bulk-save', async (req, res) => {
  try {
    const {
      records,          // Grid'den gelen kayıtlar
      originalRecords,  // DB'den gelen orijinal kayıtlar
      documentId,       // Belge ID
      itemId,           // INCKEYNO
      stokKodu,
      belgeTip,
      gckod,
      belgeNo,
      belgeTarihi,
      docType,
      expectedQuantity,
      barcode
    } = req.body

    log('💾 UTS Toplu Kayıt İsteği:', { documentId, itemId, recordCount: records.length })

    // Belge ID'sini parse et
    const [subeKodu, ftirsip, fatirs_no, cariKodu] = documentId.split('|')

    // KAYIT_TIPI belirle (Sipariş = M, Fatura = A)
    const kayitTipi = docType === '6' ? 'M' : 'A'

    // Toplu kaydet
    const saveResult = await documentService.saveUTSRecords({
      records,
      originalRecords,
      kayitTipi,
      stokKodu,
      harRecno: itemId,
      tarih: belgeTarihi,
      belgeNo,
      belgeTip,
      subeKodu,
      gckod,
      ilcGtin: barcode,
      expectedQuantity,
      ftirsip,                              // Belge tipi: '6'=Sipariş, '2'=Alış, '1'=Satış
      cariKodu: req.body.cariKodu,          // Belgedeki CARI_KODU
      kullanici: req.body.kullanici         // Sisteme giriş yapan kullanıcı
    })

    res.json({
      success: true,
      message: `${saveResult.insertCount} eklendi, ${saveResult.updateCount} güncellendi, ${saveResult.deleteCount} silindi`,
      data: saveResult
    })

  } catch (error) {
    console.error('❌ UTS Toplu Kayıt Hatası:', error)
    res.status(500).json({
      success: false,
      message: 'UTS kayıtları kaydedilemedi',
      error: error.message
    })
  }
})

// POST /api/documents/carrier-barcode - Koli Barkodu Okut ve Kaydet (ITS için)
router.post('/carrier-barcode', async (req, res) => {
  try {
    const {
      carrierLabel,  // Koli barkodu
      docId,         // Belge ID (KAYITNO)
      ftirsip,       // Belge tipi
      cariKodu,      // Cari kodu
      kullanici      // Kullanıcı adı
    } = req.body

    log('📦 Koli Barkodu İsteği:', { carrierLabel, docId, ftirsip, cariKodu, kullanici })

    if (!carrierLabel) {
      return res.status(400).json({
        success: false,
        message: 'Koli barkodu zorunludur'
      })
    }

    if (!docId) {
      return res.status(400).json({
        success: false,
        message: 'Belge ID zorunludur'
      })
    }

    if (!kullanici) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı bilgisi zorunludur'
      })
    }

    // Koli barkodundan ürünleri kaydet
    const result = await documentService.saveCarrierBarcode({
      carrierLabel,
      docId,
      ftirsip,
      cariKodu,
      kullanici
    })

    res.json(result)
  } catch (error) {
    console.error('❌ Koli Barkodu Kayıt Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Koli barkodu işlenirken hata oluştu'
    })
  }
})

// DELETE /api/documents/carrier-barcode - Koli Barkoduna Göre ITS Kayıtlarını Sil
router.delete('/carrier-barcode', async (req, res) => {
  try {
    const {
      carrierLabel,  // Koli barkodu
      docId          // Belge ID (SUBE_KODU-FTIRSIP-FATIRS_NO)
    } = req.body

    log('🗑️ Koli Barkodu Silme İsteği:', { carrierLabel, docId })

    if (!carrierLabel) {
      return res.status(400).json({
        success: false,
        message: 'Koli barkodu zorunludur'
      })
    }

    if (!docId) {
      return res.status(400).json({
        success: false,
        message: 'Belge ID zorunludur'
      })
    }

    // Koli barkoduna göre ITS kayıtlarını sil
    const result = await documentService.deleteCarrierBarcodeRecords(carrierLabel, docId)

    res.json(result)
  } catch (error) {
    console.error('❌ Koli Barkodu Silme Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Koli barkodu silinirken hata oluştu'
    })
  }
})

// POST /api/documents/dgr-barcode - DGR Barkod Okut ve Kaydet (ITS olmayan normal ürünler)
router.post('/dgr-barcode', async (req, res) => {
  try {
    const {
      barcode,      // Normal Barkod
      documentId,   // Belge ID (SUBE_KODU-FTIRSIP-FATIRS_NO)
      itemId,       // INCKEYNO
      stokKodu,     // Stok Kodu
      belgeTip,     // STHAR_HTUR
      gckod,        // STHAR_GCKOD
      belgeNo,      // Belge No
      belgeTarihi,  // Belge Tarihi
      docType,      // '6' = Sipariş, '1'/'2' = Fatura
      expectedQuantity  // Beklenen miktar (kalem miktarı)
    } = req.body

    log('📦 DGR Barkod İsteği:', { barcode, documentId, itemId, stokKodu, expectedQuantity })

    // Belge ID'sini parse et
    const [subeKodu, ftirsip, fatirs_no, cariKodu] = documentId.split('|')

    // KAYIT_TIPI belirle (Sipariş = M, Fatura = A)
    const kayitTipi = docType === '6' ? 'M' : 'A'

    // TBLSERITRA'ya kaydet veya güncelle
    const saveResult = await documentService.saveDGRBarcode({
      kayitTipi,
      stokKodu,     // SERI_NO = Stok Kodu
      harRecno: itemId,
      tarih: belgeTarihi,
      gckod,
      belgeNo,
      belgeTip,
      subeKodu,
      ilcGtin: barcode,  // Okutulan Barkod
      expectedQuantity,   // Miktar kontrolü için
      ftirsip,            // Belge tipi: '6'=Sipariş, '2'=Alış, '1'=Satış
      cariKodu: req.body.cariKodu || '',  // Belgedeki CARI_KODU
      kullanici: req.body.kullanici || ''  // Sisteme giriş yapan kullanıcı
    })

    if (!saveResult.success) {
      log('⚠️ DGR Barkod kaydedilemedi:', saveResult.message)
      return res.status(400).json(saveResult)
    }

    log('✅ DGR Barkod başarıyla kaydedildi!')
    res.json({
      success: true,
      message: saveResult.data.isUpdate
        ? `Barkod güncellendi (${saveResult.data.miktar} adet)`
        : 'Barkod başarıyla kaydedildi',
      data: {
        stokKodu: saveResult.data.stokKodu,
        miktar: saveResult.data.miktar,
        isUpdate: saveResult.data.isUpdate
      }
    })

  } catch (error) {
    console.error('❌ DGR Barkod Kaydetme Hatası:', error)
    res.status(500).json({
      success: false,
      message: 'DGR barkod kaydedilemedi',
      error: error.message
    })
  }
})

// POST /api/documents/:id/pts-preview - PTS XML Önizleme (göndermeden)
router.post('/:id/pts-preview', async (req, res) => {
  try {
    const { id } = req.params
    const { kullanici, note, settings } = req.body

    log('📝 PTS XML Önizleme İsteği:', { documentId: id, kullanici, note })

    // Document ID parse et
    const [subeKodu, ftirsip, fatirs_no] = id.split('-')

    // Belge bilgilerini al
    const document = await documentService.getDocumentById(subeKodu, ftirsip, fatirs_no)
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Belge bulunamadı'
      })
    }

    // Belgedeki tüm ITS kayıtlarını al
    const itsRecords = await documentService.getAllITSRecordsForDocument(subeKodu, fatirs_no, ftirsip)

    if (!itsRecords || itsRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bu belgede ITS kaydı bulunamadı'
      })
    }

    log('📋 ITS Kayıt Sayısı:', itsRecords.length)

    // ptsService'den XML generator'ı import et
    const { loadPTSConfig, PTS_CONFIG } = await import('../services/ptsService.js')

    // Ayarları yükle
    if (settings) {
      loadPTSConfig(settings)
    }

    // XML oluştur
    const packageData = {
      documentNumber: document.documentNo,
      documentDate: document.documentDate ? new Date(document.documentDate).toISOString().split('T')[0] : '',
      sourceGLN: PTS_CONFIG?.glnNo || '',
      destinationGLN: document.glnNo,
      note: note || '',
      products: itsRecords.map(r => ({
        seriNo: r.seriNo,
        gtin: r.barkod,
        miad: r.miad ? new Date(r.miad).toISOString().split('T')[0] : '',
        lot: r.lot,
        carrierLabel: r.carrierLabel || null,
        containerType: r.containerType || null
      }))
    }

    // XML oluştur (ptsService'deki fonksiyonu kullan)
    const xmlContent = generatePTSNotificationXMLForPreview(packageData)

    log('✅ PTS XML oluşturuldu, uzunluk:', xmlContent.length)

    res.json({
      success: true,
      xmlContent,
      recordCount: itsRecords.length,
      message: `${itsRecords.length} kayıt için XML oluşturuldu`
    })

  } catch (error) {
    console.error('❌ PTS XML Önizleme Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'XML oluşturulamadı'
    })
  }
})

// XML Oluşturma Fonksiyonu (Önizleme için)
function generatePTSNotificationXMLForPreview(packageData) {
  const { documentNumber, documentDate, sourceGLN, destinationGLN, note, products } = packageData

  // Ürünleri carrier'lara göre grupla (containerType bilgisi de sakla)
  const carrierGroups = {}
  products.forEach(p => {
    const carrier = p.carrierLabel || 'NO_CARRIER'
    if (!carrierGroups[carrier]) {
      carrierGroups[carrier] = {
        containerType: p.containerType || 'C',
        items: []
      }
    }
    carrierGroups[carrier].items.push(p)
  })

  // Her carrier için productList oluştur
  let carriersXml = ''
  for (const [carrierLabel, carrierData] of Object.entries(carrierGroups)) {
    const prods = carrierData.items
    const containerType = carrierData.containerType || 'C'

    // Aynı GTIN + lot + miad kombinasyonunu grupla
    const productGroups = {}
    prods.forEach(p => {
      if (p.seriNo) {
        const key = `${p.gtin || ''}|${p.lot || ''}|${p.miad || ''}`
        if (!productGroups[key]) {
          productGroups[key] = {
            gtin: p.gtin || '',
            lot: p.lot || '',
            miad: p.miad || '',
            serialNumbers: []
          }
        }
        productGroups[key].serialNumbers.push(p.seriNo)
      }
    })

    // ProductList XML'leri oluştur - her grup için bir productList
    let productListXml = ''
    for (const group of Object.values(productGroups)) {
      const serialsXml = group.serialNumbers.map(sn => `<serialNumber>${sn}</serialNumber>`).join('')
      // GTIN'i 14 karaktere tamamla (başına sıfır ekle)
      const paddedGtin = group.gtin.padStart(14, '0')
      productListXml += `<productList GTIN="${paddedGtin}" lotNumber="${group.lot}" expirationDate="${group.miad}">${serialsXml}</productList>`
    }

    if (carrierLabel !== 'NO_CARRIER') {
      carriersXml += `<carrier carrierLabel="${carrierLabel}" containerType="${containerType}">${productListXml}</carrier>`
    } else {
      carriersXml += productListXml
    }
  }

  // Örnek formata uygun XML (header yok, tek satır)
  const xml = `<transfer><sourceGLN>${sourceGLN || ''}</sourceGLN><destinationGLN>${destinationGLN || ''}</destinationGLN><actionType>S</actionType><shipTo>${destinationGLN || ''}</shipTo><documentNumber>${documentNumber || ''}</documentNumber><documentDate>${documentDate || ''}</documentDate><version>1.4</version><note>${note || ''}</note>${carriersXml}</transfer>`

  return xml
}

// POST /api/documents/:id/pts-notification - PTS Bildirimi Gönder
router.post('/:id/pts-notification', async (req, res) => {
  try {
    const { id } = req.params
    const { kullanici, settings } = req.body

    log('📤 PTS Bildirimi İsteği:', { documentId: id, kullanici })

    // Document ID parse et (format: SUBE_KODU|FTIRSIP|FATIRS_NO|CARI_KODU)
    const [subeKodu, ftirsip, fatirs_no, cariKodu] = id.split('|')

    // Belge bilgilerini al
    const document = await documentService.getDocumentById(subeKodu, ftirsip, fatirs_no, cariKodu)
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Belge bulunamadı'
      })
    }

    // Belgedeki tüm ITS kayıtlarını al
    const itsRecords = await documentService.getAllITSRecordsForDocument(subeKodu, fatirs_no, ftirsip, cariKodu)

    if (!itsRecords || itsRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bu belgede ITS kaydı bulunamadı'
      })
    }

    log('📋 ITS Kayıt Sayısı:', itsRecords.length)

    // PTS paketi oluştur ve gönder
    const { sendPackage, loadPTSConfig, PTS_CONFIG } = await import('../services/ptsService.js')

    // Ayarları yükle
    if (settings) {
      loadPTSConfig(settings)
    }

    const packageData = {
      documentNumber: document.documentNo,
      documentDate: document.documentDate ? new Date(document.documentDate).toISOString().split('T')[0] : '',
      sourceGLN: PTS_CONFIG?.glnNo || '', // Kendi GLN'imiz - ayarlardan alınır
      destinationGLN: document.glnNo || document.email || '', // Alıcı GLN (XML içinde kullanılır)
      receiverGLN: PTS_CONFIG?.glnNo || '', // Şu an için kendi GLN'imize gönder (test için)
      note: '', // Not
      products: itsRecords.map(r => ({
        seriNo: r.seriNo,
        gtin: r.barkod,
        miad: r.miad ? new Date(r.miad).toISOString().split('T')[0] : '',
        lot: r.lot,
        carrierLabel: r.carrierLabel || null,
        containerType: r.containerType || null
      }))
    }

    const result = await sendPackage(packageData, settings)

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      })
    }

    // Başarılı ise TBLFATUIRS'a PTS bilgilerini kaydet
    await documentService.updateDocumentPTSStatus(
      subeKodu,
      fatirs_no,
      ftirsip,
      cariKodu,
      result.transferId,
      kullanici
    )

    log('✅ PTS Bildirimi başarılı:', result.transferId)

    res.json({
      success: true,
      transferId: result.transferId,
      recordCount: itsRecords.length,
      message: `${itsRecords.length} kayıt PTS'ye bildirildi. Transfer ID: ${result.transferId}`
    })

  } catch (error) {
    console.error('❌ PTS Bildirimi Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'PTS bildirimi gönderilemedi'
    })
  }
})

// ==================== ITS BİLDİRİM İŞLEMLERİ ====================

// POST /api/documents/:id/its-satis-bildirimi - ITS Satış Bildirimi
router.post('/:id/its-satis-bildirimi', async (req, res) => {
  try {
    const { id } = req.params
    const { karsiGlnNo, products, settings, belgeInfo } = req.body

    log('📤 ITS Satış Bildirimi İsteği:', { documentId: id, productCount: products?.length })

    if (!karsiGlnNo) {
      return res.status(400).json({
        success: false,
        message: 'Alıcı GLN numarası zorunludur'
      })
    }

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bildirilecek ürün listesi boş'
      })
    }

    // ITS API servisini import et
    const itsApiService = await import('../services/itsApiService.js')

    // Satış bildirimi yap
    const result = await itsApiService.depoSatisBildirimi(karsiGlnNo, products, settings)

    if (result.success) {
      // Başarılı sonuçları veritabanına kaydet
      const recordsToUpdate = result.data.map((item, index) => ({
        recNo: products[index]?.recNo,
        durum: item.durum
      })).filter(r => r.recNo)

      if (recordsToUpdate.length > 0) {
        await itsApiService.updateBildirimDurum(recordsToUpdate, req.username)
      }

      // Belge ITS durumunu güncelle (tüm satırlar başarılı ise OK, değilse NOK)
      if (belgeInfo?.subeKodu && belgeInfo?.fatirsNo) {
        const tumBasarili = result.data.every(item => String(item.durum).replace(/^0+/, '') === '0' || item.durum == 0)
        await itsApiService.updateBelgeITSDurum(
          belgeInfo.subeKodu,
          belgeInfo.fatirsNo,
          belgeInfo.ftirsip,
          belgeInfo.cariKodu,
          tumBasarili,
          belgeInfo.kullanici
        )
      }
    }

    res.json(result)

  } catch (error) {
    console.error('❌ ITS Satış Bildirimi Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Satış bildirimi gönderilemedi'
    })
  }
})

// POST /api/documents/:id/its-satis-iptal - ITS Satış İptal Bildirimi
router.post('/:id/its-satis-iptal', async (req, res) => {
  try {
    const { id } = req.params
    const { karsiGlnNo, products, settings, belgeInfo } = req.body

    log('🔴 ITS Satış İptal İsteği:', { documentId: id, productCount: products?.length })

    if (!karsiGlnNo) {
      return res.status(400).json({
        success: false,
        message: 'Alıcı GLN numarası zorunludur'
      })
    }

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'İptal edilecek ürün listesi boş'
      })
    }

    const itsApiService = await import('../services/itsApiService.js')
    const result = await itsApiService.depoSatisIptalBildirimi(karsiGlnNo, products, settings)

    if (result.success) {
      const recordsToUpdate = result.data.map((item, index) => ({
        recNo: products[index]?.recNo,
        durum: 'I'  // İptal
      })).filter(r => r.recNo)

      if (recordsToUpdate.length > 0) {
        await itsApiService.updateBildirimDurum(recordsToUpdate, req.username)
      }

      // Belge ITS durumunu güncelle
      if (belgeInfo?.subeKodu && belgeInfo?.fatirsNo) {
        const tumBasarili = result.data.every(item => String(item.durum).replace(/^0+/, '') === '0' || item.durum == 0)
        await itsApiService.updateBelgeITSDurum(
          belgeInfo.subeKodu,
          belgeInfo.fatirsNo,
          belgeInfo.ftirsip,
          belgeInfo.cariKodu,
          tumBasarili,
          belgeInfo.kullanici
        )
      }
    }

    res.json(result)

  } catch (error) {
    console.error('❌ ITS Satış İptal Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Satış iptal bildirimi gönderilemedi'
    })
  }
})

// POST /api/documents/:id/its-alis-bildirimi - ITS Alış Bildirimi (Mal Alım)
router.post('/:id/its-alis-bildirimi', async (req, res) => {
  try {
    const { id } = req.params
    const { products, settings, belgeInfo } = req.body

    log('📥 ITS Alış Bildirimi (Mal Alım) İsteği:', { documentId: id, productCount: products?.length })

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bildirilecek ürün listesi boş'
      })
    }

    // ITS API servisini import et
    const itsApiService = await import('../services/itsApiService.js')

    // Alış bildirimi yap (sadece productList gönderilir)
    const result = await itsApiService.depoAlisBildirimi(products, settings)

    if (result.success) {
      // Başarılı sonuçları veritabanına kaydet
      const recordsToUpdate = result.data.map((item, index) => ({
        recNo: products[index]?.recNo,
        durum: item.durum
      })).filter(r => r.recNo)

      if (recordsToUpdate.length > 0) {
        await itsApiService.updateBildirimDurum(recordsToUpdate, req.username)
      }

      // Belge ITS durumunu güncelle
      if (belgeInfo?.subeKodu && belgeInfo?.fatirsNo) {
        const tumBasarili = result.data.every(item => String(item.durum).replace(/^0+/, '') === '0' || item.durum == 0)
        await itsApiService.updateBelgeITSDurum(
          belgeInfo.subeKodu,
          belgeInfo.fatirsNo,
          belgeInfo.ftirsip,
          belgeInfo.cariKodu,
          tumBasarili,
          belgeInfo.kullanici
        )
      }
    }

    res.json(result)

  } catch (error) {
    console.error('❌ ITS Alış Bildirimi Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Alış bildirimi gönderilemedi'
    })
  }
})

// POST /api/documents/:id/its-iade-alis - ITS İade Alış Bildirimi (Mal İade)
router.post('/:id/its-iade-alis', async (req, res) => {
  try {
    const { id } = req.params
    const { karsiGlnNo, products, settings, belgeInfo } = req.body

    log('🔴 ITS İade Alış Bildirimi İsteği:', { documentId: id, productCount: products?.length })

    if (!karsiGlnNo) {
      return res.status(400).json({
        success: false,
        message: 'Karşı taraf GLN numarası zorunludur'
      })
    }

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'İade edilecek ürün listesi boş'
      })
    }

    const itsApiService = await import('../services/itsApiService.js')
    const result = await itsApiService.depoIadeAlisBildirimi(karsiGlnNo, products, settings)

    if (result.success) {
      const recordsToUpdate = result.data.map((item, index) => ({
        recNo: products[index]?.recNo,
        durum: item.durum
      })).filter(r => r.recNo)

      if (recordsToUpdate.length > 0) {
        await itsApiService.updateBildirimDurum(recordsToUpdate, req.username)
      }

      // Belge ITS durumunu güncelle
      if (belgeInfo?.subeKodu && belgeInfo?.fatirsNo) {
        const tumBasarili = result.data.every(item => String(item.durum).replace(/^0+/, '') === '0' || item.durum == 0)
        await itsApiService.updateBelgeITSDurum(
          belgeInfo.subeKodu,
          belgeInfo.fatirsNo,
          belgeInfo.ftirsip,
          belgeInfo.cariKodu,
          tumBasarili,
          belgeInfo.kullanici
        )
      }
    }

    res.json(result)

  } catch (error) {
    console.error('❌ ITS İade Alış Bildirimi Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'İade alış bildirimi gönderilemedi'
    })
  }
})

// POST /api/documents/:id/its-dogrulama - ITS Doğrulama
router.post('/:id/its-dogrulama', async (req, res) => {
  try {
    const { id } = req.params
    const { products, settings } = req.body

    log('🔍 ITS Doğrulama İsteği:', { documentId: id, productCount: products?.length })

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Doğrulanacak ürün listesi boş'
      })
    }

    const itsApiService = await import('../services/itsApiService.js')
    const result = await itsApiService.dogrulamaYap(products, settings)

    res.json(result)

  } catch (error) {
    console.error('❌ ITS Doğrulama Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Doğrulama başarısız'
    })
  }
})

// POST /api/documents/:id/its-sorgula - Durum Sorgula (check_status)
router.post('/:id/its-sorgula', async (req, res) => {
  try {
    const { id } = req.params
    const { products, settings } = req.body

    log('🔍 ITS Durum Sorgulama İsteği:', { documentId: id, productCount: products?.length })

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sorgulanacak ürün listesi boş'
      })
    }

    const itsApiService = await import('../services/itsApiService.js')
    const result = await itsApiService.durumSorgula(products, settings)

    res.json(result)

  } catch (error) {
    console.error('❌ ITS Durum Sorgulama Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Sorgulama başarısız'
    })
  }
})

// POST /api/documents/:id/its-basarisiz-sorgula - Başarısız Ürünleri Sorgula
router.post('/:id/its-basarisiz-sorgula', async (req, res) => {
  try {
    const { id } = req.params
    const { products, settings } = req.body

    log('❓ ITS Başarısız Ürün Sorgulama İsteği:', { documentId: id, productCount: products?.length })

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sorgulanacak ürün listesi boş'
      })
    }

    const itsApiService = await import('../services/itsApiService.js')
    const result = await itsApiService.basarisizlariSorgula(products, settings)

    res.json(result)

  } catch (error) {
    console.error('❌ ITS Başarısız Sorgulama Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Sorgulama başarısız'
    })
  }
})

// POST /api/documents/:id/fast-durum - Belge FAST durumunu güncelle
router.post('/:id/fast-durum', async (req, res) => {
  try {
    const { id } = req.params
    const { status, kullanici } = req.body

    log('📋 FAST Durum Güncelleme İsteği:', { documentId: id, status, kullanici })

    if (!status || !['OK', 'NOK'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz durum değeri. OK veya NOK olmalı.'
      })
    }

    if (!kullanici) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı bilgisi zorunludur'
      })
    }

    // Document ID parse et (format: SUBE_KODU|FTIRSIP|FATIRS_NO|CARI_KODU)
    const [subeKodu, ftirsip, fatirs_no, cariKodu] = id.split('|')

    // FAST durumunu güncelle
    const result = await documentService.updateDocumentFastStatus(
      subeKodu,
      fatirs_no,
      ftirsip,
      cariKodu,
      status,
      kullanici
    )

    res.json({
      success: true,
      message: `Belge durumu ${status} olarak güncellendi`,
      data: result
    })

  } catch (error) {
    console.error('❌ FAST Durum Güncelleme Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Durum güncellenemedi'
    })
  }
})

export default router
