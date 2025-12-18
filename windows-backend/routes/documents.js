import express from 'express'
import documentService from '../services/documentService.js'
import { parseITSBarcode, formatMiad } from '../utils/itsParser.js'

const router = express.Router()

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
    
    // ID formatı: SUBE_KODU-FTIRSIP-FATIRS_NO
    const parts = id.split('-')
    
    if (parts.length !== 3) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz belge ID formatı'
      })
    }
    
    const [subeKodu, ftirsip, fatirs_no] = parts
    
    const document = await documentService.getDocumentById(subeKodu, ftirsip, fatirs_no)
    
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

// GET /api/documents/:documentId/item/:itemId/its-records - ITS Kayıtlarını Getir
router.get('/:documentId/item/:itemId/its-records', async (req, res) => {
  try {
    const { documentId, itemId } = req.params
    
    // Document ID parse et
    const [subeKodu, ftirsip, fatirs_no] = documentId.split('-')
    
    // Kayıt tipi belirle
    const kayitTipi = ftirsip === '6' ? 'M' : 'A'
    
    const records = await documentService.getITSBarcodeRecords(
      subeKodu,
      fatirs_no,
      itemId,
      kayitTipi
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
    
    // Document ID parse et
    const [subeKodu, ftirsip, fatirs_no] = documentId.split('-')
    
    // Kayıt tipi belirle
    const kayitTipi = ftirsip === '6' ? 'M' : 'A'
    
    const records = await documentService.getUTSBarcodeRecords(
      subeKodu,
      fatirs_no,
      itemId,
      kayitTipi
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

// DELETE /api/documents/:documentId/item/:itemId/its-records - ITS Kayıtlarını Sil
router.delete('/:documentId/item/:itemId/its-records', async (req, res) => {
  try {
    const { documentId, itemId } = req.params
    const { seriNos } = req.body // Array of seri numbers to delete
    
    console.log('🗑️ ITS Kayıt Silme İsteği:', { documentId, itemId, seriNos })
    
    if (!seriNos || !Array.isArray(seriNos) || seriNos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Silinecek seri numaraları belirtilmeli'
      })
    }
    
    // Document ID parse et
    const [subeKodu, ftirsip, fatirs_no] = documentId.split('-')
    
    console.log('📋 Parse edilmiş değerler:', { subeKodu, ftirsip, fatirs_no, straInc: itemId })
    
    const result = await documentService.deleteITSBarcodeRecords(
      seriNos,
      subeKodu,
      fatirs_no,
      itemId
    )
    
    console.log('✅ Silme sonucu:', result)
    
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
    
    // Document ID parse et
    const [subeKodu, ftirsip, fatirs_no] = documentId.split('-')
    
    const result = await documentService.deleteUTSBarcodeRecords(
      records,
      subeKodu,
      fatirs_no,
      itemId
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

// POST /api/documents/its-barcode - ITS Karekod Okut ve Kaydet
router.post('/its-barcode', async (req, res) => {
  try {
    const { 
      barcode,      // ITS 2D Karekod
      documentId,   // Belge ID (SUBE_KODU-FTIRSIP-FATIRS_NO)
      itemId,       // INCKEYNO
      stokKodu,
      belgeTip,     // STHAR_HTUR
      gckod,        // STHAR_GCKOD
      belgeNo,
      belgeTarihi,
      docType,      // '6' = Sipariş, '1'/'2' = Fatura
      expectedQuantity  // Beklenen miktar (kalem miktarı)
    } = req.body
    
    console.log('📱 ITS Karekod İsteği:', { barcode, documentId, itemId, expectedQuantity })
    
    // 1. Karekodu parse et
    const parseResult = parseITSBarcode(barcode)
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Karekod parse edilemedi: ' + parseResult.error
      })
    }
    
    const parsedData = parseResult.data
    
    // 2. Belge ID'sini parse et
    const [subeKodu, ftirsip, fatirs_no] = documentId.split('-')
    
    // 3. KAYIT_TIPI belirle
    const kayitTipi = docType === '6' ? 'M' : 'A' // Sipariş = M, Fatura = A
    
    // 4. AKTBLITSUTS'a kaydet
    const saveResult = await documentService.saveITSBarcode({
      kayitTipi,
      seriNo: parsedData.seriNo,
      stokKodu,
      straInc: itemId,
      tarih: belgeTarihi,
      acik1: parsedData.miad,      // Miad
      acik2: parsedData.lot,        // Lot
      gckod,
      miktar: 1,
      belgeNo,
      belgeTip,
      subeKodu,
      depoKod: '0',
      ilcGtin: parsedData.barkod,  // Okutulan Barkod
      expectedQuantity,            // Miktar kontrolü için
      ftirsip,                     // Belge tipi: '6'=Sipariş, '2'=Alış, '1'=Satış
      cariKodu: req.body.cariKodu,         // Belgedeki CARI_KODU (ZORUNLU)
      kullanici: req.body.kullanici        // Sisteme giriş yapan kullanıcı (ZORUNLU)
    })
    
    // Duplicate kontrolü
    if (!saveResult.success) {
      console.log('⚠️ ITS Karekod kaydedilemedi:', saveResult.error, saveResult.message)
      return res.status(400).json(saveResult) // error ve message'ı frontend'e gönder
    }
    
    console.log('✅ ITS Karekod başarıyla kaydedildi!')
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
    
    console.log('🔴 UTS Barkod İsteği:', { barcode, documentId, itemId, stokKodu, seriNo, lotNo, miktar })
    
    // Belge ID'sini parse et
    const [subeKodu, ftirsip, fatirs_no] = documentId.split('-')
    
    // KAYIT_TIPI belirle (Sipariş = M, Fatura = A)
    const kayitTipi = docType === '6' ? 'M' : 'A'
    
    // TBLSERITRA'ya kaydet veya güncelle
    const saveResult = await documentService.saveUTSBarcode({
      kayitTipi,
      seriNo,
      lotNo,
      stokKodu,
      straInc: itemId,
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
      console.log('⚠️ UTS Barkod kaydedilemedi:', saveResult.message)
      return res.status(400).json(saveResult)
    }
    
    console.log('✅ UTS Barkod başarıyla kaydedildi!')
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
    
    console.log('💾 UTS Toplu Kayıt İsteği:', { documentId, itemId, recordCount: records.length })
    
    // Belge ID'sini parse et
    const [subeKodu, ftirsip, fatirs_no] = documentId.split('-')
    
    // KAYIT_TIPI belirle (Sipariş = M, Fatura = A)
    const kayitTipi = docType === '6' ? 'M' : 'A'
    
    // Toplu kaydet
    const saveResult = await documentService.saveUTSRecords({
      records,
      originalRecords,
      kayitTipi,
      stokKodu,
      straInc: itemId,
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
    
    console.log('📦 Koli Barkodu İsteği:', { carrierLabel, docId, ftirsip, cariKodu, kullanici })
    
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
    
    console.log('🗑️ Koli Barkodu Silme İsteği:', { carrierLabel, docId })
    
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
    
    console.log('📦 DGR Barkod İsteği:', { barcode, documentId, itemId, stokKodu, expectedQuantity })
    
    // Belge ID'sini parse et
    const [subeKodu, ftirsip, fatirs_no] = documentId.split('-')
    
    // KAYIT_TIPI belirle (Sipariş = M, Fatura = A)
    const kayitTipi = docType === '6' ? 'M' : 'A'
    
    // TBLSERITRA'ya kaydet veya güncelle
    const saveResult = await documentService.saveDGRBarcode({
      kayitTipi,
      stokKodu,     // SERI_NO = Stok Kodu
      straInc: itemId,
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
      console.log('⚠️ DGR Barkod kaydedilemedi:', saveResult.message)
      return res.status(400).json(saveResult)
    }
    
    console.log('✅ DGR Barkod başarıyla kaydedildi!')
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

export default router
