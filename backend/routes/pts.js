import express from 'express'
import * as ptsService from '../services/ptsService.js'
import * as ptsDbService from '../services/ptsDbService.js'
import { log } from '../utils/logger.js'
import companyMiddleware from '../middleware/companyMiddleware.js'

const router = express.Router()

// Tüm PTS route'larına company middleware uygula
router.use(companyMiddleware)

/**
 * POST /api/pts/search
 * Tarih aralığında paket listesi sorgula
 */
router.post('/search', async (req, res) => {
  try {
    const { startDate, endDate, settings } = req.body

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Başlangıç ve bitiş tarihi gerekli'
      })
    }

    const result = await ptsService.searchPackages(startDate, endDate, settings)
    res.json(result)

  } catch (error) {
    console.error('PTS search route error:', error)
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: error.message
    })
  }
})

/**
 * POST /api/pts/download-bulk
 * Tarih aralığındaki paketleri toplu indir ve veritabanına kaydet
 */
// SSE ile real-time progress güncellemesi
router.post('/download-bulk-stream', async (req, res) => {
  try {
    const { startDate, endDate, settings, kullanici } = req.body

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Başlangıç ve bitiş tarihi gerekli'
      })
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Nginx buffering'i kapat

    log('📥 Toplu paket indirme başlıyor (SSE):', { startDate, endDate })

    // Helper function to send SSE message
    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    // 1. Transfer ID listesini al
    sendProgress({ status: 'searching', message: 'Paketler aranıyor...' })

    const searchResult = await ptsService.searchPackages(startDate, endDate, settings)

    if (!searchResult.success) {
      sendProgress({ status: 'error', message: searchResult.message })
      res.end()
      return
    }

    const transferIds = searchResult.data || []

    if (transferIds.length === 0) {
      sendProgress({
        status: 'completed',
        total: 0,
        downloaded: 0,
        skipped: 0,
        failed: 0,
        message: 'Belirtilen tarih aralığında paket bulunamadı'
      })
      res.end()
      return
    }

    console.log(`📦 ${transferIds.length} paket bulundu`)
    sendProgress({
      status: 'downloading',
      total: transferIds.length,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      message: `${transferIds.length} paket bulundu, indirme başlıyor...`
    })

    // 2. Her paketi indir ve kaydet
    const results = {
      total: transferIds.length,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      packages: []
    }

    for (let i = 0; i < transferIds.length; i++) {
      const transferId = transferIds[i]
      const transferIdStr = String(transferId)

      try {
        // Daha önce indirilmiş mi kontrol et (hızlı kontrol)
        const existingCheck = await ptsDbService.checkPackageExists(transferIdStr)

        if (existingCheck.exists) {
          results.skipped++
          results.packages.push({
            transferId: transferIdStr,
            status: 'skipped',
            message: 'Daha önce indirilmiş'
          })
          console.log(`⏭️ ${transferIdStr} zaten veritabanında, atlanıyor`)

          // Progress güncelle
          sendProgress({
            status: 'downloading',
            total: results.total,
            downloaded: results.downloaded,
            skipped: results.skipped,
            failed: results.failed,
            current: i + 1,
            message: `${transferIdStr} atlandı (${i + 1}/${transferIds.length})`
          })
          continue
        }

        // Paketi indir
        console.log(`📥 İndiriliyor: ${transferIdStr}`)
        sendProgress({
          status: 'downloading',
          total: results.total,
          downloaded: results.downloaded,
          skipped: results.skipped,
          failed: results.failed,
          current: i + 1,
          message: `${transferIdStr} indiriliyor... (${i + 1}/${transferIds.length})`
        })

        const downloadResult = await ptsService.downloadPackage(transferIdStr, settings)

        if (downloadResult.success) {
          // Kullanıcı bilgisini ekle
          downloadResult.data.kayitKullanici = kullanici || null
          const saveResult = await ptsDbService.savePackageData(downloadResult.data)

          if (saveResult.success) {
            results.downloaded++
            results.packages.push({
              transferId: transferIdStr,
              status: 'success',
              productCount: downloadResult.data?.products?.length || 0
            })
            console.log(`✅ ${transferIdStr} veritabanına kaydedildi (${downloadResult.data?.products?.length || 0} ürün)`)

            // Progress güncelle
            sendProgress({
              status: 'downloading',
              total: results.total,
              downloaded: results.downloaded,
              skipped: results.skipped,
              failed: results.failed,
              current: i + 1,
              message: `${transferIdStr} kaydedildi (${i + 1}/${transferIds.length})`
            })
          } else {
            results.failed++
            results.packages.push({
              transferId: transferIdStr,
              status: 'failed',
              message: `Kayıt hatası: ${saveResult.message}`
            })
            console.error(`❌ ${transferIdStr} veritabanına kaydedilemedi:`, saveResult.message)

            sendProgress({
              status: 'downloading',
              total: results.total,
              downloaded: results.downloaded,
              skipped: results.skipped,
              failed: results.failed,
              current: i + 1,
              message: `${transferIdStr} başarısız (${i + 1}/${transferIds.length})`,
              failedPackage: { transferId: transferIdStr, message: `Kayıt hatası: ${saveResult.message}` }
            })
          }
        } else {
          results.failed++
          results.packages.push({
            transferId: transferIdStr,
            status: 'failed',
            message: downloadResult.message
          })
          console.error(`❌ Hata: ${transferIdStr} - ${downloadResult.message}`)

          sendProgress({
            status: 'downloading',
            total: results.total,
            downloaded: results.downloaded,
            skipped: results.skipped,
            failed: results.failed,
            current: i + 1,
            message: `${transferIdStr} başarısız (${i + 1}/${transferIds.length})`,
            failedPackage: { transferId: transferIdStr, message: downloadResult.message }
          })
        }

      } catch (error) {
        results.failed++
        results.packages.push({
          transferId: String(transferId),
          status: 'failed',
          message: error.message
        })
        console.error(`❌ ${transferId} indirme hatası:`, error.message)

        sendProgress({
          status: 'downloading',
          total: results.total,
          downloaded: results.downloaded,
          skipped: results.skipped,
          failed: results.failed,
          current: i + 1,
          message: `${String(transferId)} hata (${i + 1}/${transferIds.length})`,
          failedPackage: { transferId: String(transferId), message: error.message }
        })
      }
    }

    log('📊 Toplu indirme tamamlandı:', results)

    // Son durum
    sendProgress({
      status: 'completed',
      total: results.total,
      downloaded: results.downloaded,
      skipped: results.skipped,
      failed: results.failed,
      message: `Tamamlandı! ${results.downloaded} indirildi, ${results.skipped} atlandı, ${results.failed} hata`
    })

    res.end()

  } catch (error) {
    console.error('❌ SSE toplu indirme hatası:', error)
    res.write(`data: ${JSON.stringify({
      status: 'error',
      message: error.message
    })}\n\n`)
    res.end()
  }
})

// Eski endpoint (yedek - non-streaming) - Artık kullanılmıyor
router.post('/download-bulk-old', async (req, res) => {
  try {
    const { startDate, endDate, settings, kullanici } = req.body

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Başlangıç ve bitiş tarihi gerekli'
      })
    }

    log('📥 Toplu paket indirme başlıyor (OLD):', { startDate, endDate })

    const searchResult = await ptsService.searchPackages(startDate, endDate, settings)

    if (!searchResult.success) {
      return res.json(searchResult)
    }

    const transferIds = searchResult.data || []

    if (transferIds.length === 0) {
      return res.json({
        success: true,
        data: {
          total: 0,
          downloaded: 0,
          skipped: 0,
          failed: 0
        }
      })
    }

    const results = {
      total: transferIds.length,
      downloaded: 0,
      skipped: 0,
      failed: 0
    }

    for (const transferId of transferIds) {
      const transferIdStr = String(transferId)

      try {
        const existingCheck = await ptsDbService.checkPackageExists(transferIdStr)

        if (existingCheck.exists) {
          results.skipped++
          continue
        }

        const downloadResult = await ptsService.downloadPackage(transferIdStr, settings)

        if (downloadResult.success) {
          // Kullanıcı bilgisini ekle
          downloadResult.data.kayitKullanici = kullanici || null
          const saveResult = await ptsDbService.savePackageData(downloadResult.data)
          if (saveResult.success) results.downloaded++
          else results.failed++
        } else {
          results.failed++
        }
      } catch (error) {
        results.failed++
      }
    }

    res.json({
      success: true,
      data: results
    })

  } catch (error) {
    console.error('PTS bulk download route error:', error)
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: error.message
    })
  }
})

/**
 * POST /api/pts/list
 * Veritabanındaki paketleri listele (tarih filtresi ile)
 */
router.post('/list', async (req, res) => {
  try {
    const { startDate, endDate, dateFilterType = 'created' } = req.body

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Başlangıç ve bitiş tarihi gerekli'
      })
    }

    log('📋 PTS paketleri listeleniyor:', { startDate, endDate, dateFilterType })

    const result = await ptsDbService.listPackages(startDate, endDate, dateFilterType)

    res.json(result)

  } catch (error) {
    console.error('❌ PTS liste hatası:', error)
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: error.message
    })
  }
})

/**
 * POST /api/pts/query/:transferId
 * Transfer ID ile paket detayı sorgula
 */
router.post('/query/:transferId', async (req, res) => {
  try {
    const { transferId } = req.params
    const { settings } = req.body

    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: 'Transfer ID gerekli'
      })
    }

    const result = await ptsService.queryPackage(transferId, settings)
    res.json(result)

  } catch (error) {
    console.error('PTS query route error:', error)
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: error.message
    })
  }
})

/**
 * POST /api/pts/download
 * Transfer ID ile paket indir ve parse et
 */
router.post('/download', async (req, res) => {
  try {
    const { transferId } = req.body

    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: 'Transfer ID gerekli'
      })
    }

    const result = await ptsService.downloadPackage(transferId)
    res.json(result)

  } catch (error) {
    console.error('PTS download route error:', error)
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: error.message
    })
  }
})

/**
 * GET /api/pts/config
 * PTS konfigürasyon bilgileri (güvenlik için password hariç)
 */
router.get('/config', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        glnNo: ptsService.PTS_CONFIG.glnNo,
        username: ptsService.PTS_CONFIG.username,
        baseUrl: ptsService.PTS_CONFIG.baseUrl
      }
    })
  } catch (error) {
    console.error('PTS config route error:', error)
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    })
  }
})

/**
 * GET /api/pts/database/list
 * Veritabanından paket listesi getir (tarih filtreli)
 * NOT: Bu route /database/:transferId'den ÖNCE olmali (daha spesifik)
 */
router.get('/database/list', async (req, res) => {
  try {
    const { startDate, endDate, dateFilterType, cariGlnColumn, stockBarcodeColumn } = req.query

    const result = await ptsDbService.listPackages(startDate, endDate, dateFilterType, cariGlnColumn, stockBarcodeColumn)
    res.json(result)

  } catch (error) {
    console.error('PTS database list route error:', error)
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: error.message
    })
  }
})

/**
 * GET /api/pts/database/:transferId
 * Veritabanından transfer ID ile paket getir
 */
router.get('/database/:transferId', async (req, res) => {
  try {
    const { transferId } = req.params

    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: 'Transfer ID gerekli'
      })
    }

    const result = await ptsDbService.getPackageDetails(transferId)
    res.json(result)

  } catch (error) {
    console.error('PTS database get route error:', error)
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: error.message
    })
  }
})

/**
 * GET /api/pts/carrier/:carrierLabel
 * Carrier label (koli barkodu) ile o carrier ve altındaki tüm ürünleri getir
 */
router.get('/carrier/:carrierLabel', async (req, res) => {
  try {
    const { carrierLabel } = req.params

    if (!carrierLabel) {
      return res.status(400).json({
        success: false,
        message: 'Carrier label gerekli'
      })
    }

    const result = await ptsDbService.getProductsByCarrierLabel(carrierLabel)
    res.json(result)

  } catch (error) {
    console.error('PTS carrier route error:', error)
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: error.message
    })
  }
})

/**
 * GET /api/pts/carrier-details/:transferId/:carrierLabel
 * Transfer ID ve carrier label ile detaylı bilgi getir
 */
router.get('/carrier-details/:transferId/:carrierLabel', async (req, res) => {
  try {
    const { transferId, carrierLabel } = req.params

    if (!transferId || !carrierLabel) {
      return res.status(400).json({
        success: false,
        message: 'Transfer ID ve Carrier label gerekli'
      })
    }

    const result = await ptsDbService.getCarrierDetails(transferId, carrierLabel)
    res.json(result)

  } catch (error) {
    console.error('PTS carrier details route error:', error)
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: error.message
    })
  }
})

/**
 * POST /api/pts/:transferId/alim-bildirimi
 * PTS Alım Bildirimi - /common/app/accept
 */
router.post('/:transferId/alim-bildirimi', async (req, res) => {
  try {
    const { transferId } = req.params
    const { products, settings, kullanici } = req.body

    log('📥 PTS Alım Bildirimi İsteği:', { transferId, productCount: products?.length })

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

    log('📋 PTS Alım Bildirimi Sonucu:', JSON.stringify({
      success: result.success,
      message: result.message,
      dataCount: result.data?.length,
      productsCount: products.length,
      firstProduct: products[0] ? { id: products[0].id, gtin: products[0].gtin } : null,
      firstResult: result.data?.[0] || null
    }, null, 2))

    // Sonuç başarılı veya başarısız - her durumda kayıtları güncelle
    if (result.data && result.data.length > 0) {
      // Her ürün için sonucu hazırla - ID ile (daha hızlı update için)
      // products dizisindeki ID'leri result.data ile eşleştir
      const recordsToUpdate = result.data.map((item, index) => ({
        id: products[index]?.id, // Frontend'den gelen ID
        gtin: item.gtin,
        sn: item.seriNo,
        durum: item.durum
      }))

      log(`📝 Güncellenecek kayıt: ${recordsToUpdate.length}/${result.data.length}`)

      // Tüm satırlar başarılı mı kontrol et
      const tumBasarili = result.data.every(item => String(item.durum).replace(/^0+/, '') === '0' || item.durum == 0)

      // PTS tablolarını güncelle (AKTBLPTSMAS her zaman, AKTBLPTSTRA eşleşenler için)
      try {
        await itsApiService.updatePTSBildirimDurum(transferId, recordsToUpdate, tumBasarili, kullanici)
        log('✅ PTS tabloları güncellendi')
      } catch (updateError) {
        log('❌ PTS tablo güncelleme hatası:', updateError.message)
      }
    }

    res.json(result)

  } catch (error) {
    console.error('❌ PTS Alım Bildirimi Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Alım bildirimi gönderilemedi'
    })
  }
})

/**
 * POST /api/pts/:transferId/alim-iade-bildirimi
 * PTS Alım İade Bildirimi - /common/app/return
 */
router.post('/:transferId/alim-iade-bildirimi', async (req, res) => {
  try {
    const { transferId } = req.params
    const { karsiGlnNo, products, settings, kullanici } = req.body

    log('🔴 PTS Alım İade Bildirimi İsteği:', { transferId, karsiGlnNo, productCount: products?.length })

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

    // ITS API servisini import et
    const itsApiService = await import('../services/itsApiService.js')

    // İade alış bildirimi yap
    const result = await itsApiService.depoIadeAlisBildirimi(karsiGlnNo, products, settings)

    log('📋 PTS Alım İade Bildirimi Sonucu:', {
      success: result.success,
      dataCount: result.data?.length,
      productsCount: products.length
    })

    // Sonuç başarılı veya başarısız - her durumda kayıtları güncelle
    if (result.data && result.data.length > 0) {
      // Her ürün için sonucu hazırla - ID ile (daha hızlı update için)
      const recordsToUpdate = result.data.map((item, index) => ({
        id: products[index]?.id, // Frontend'den gelen ID
        gtin: item.gtin,
        sn: item.seriNo,
        durum: item.durum
      }))

      log(`📝 Güncellenecek kayıt: ${recordsToUpdate.length}/${result.data.length}`)

      // Tüm satırlar başarılı mı kontrol et
      const tumBasarili = result.data.every(item => String(item.durum).replace(/^0+/, '') === '0' || item.durum == 0)

      // PTS tablolarını güncelle (AKTBLPTSMAS her zaman, AKTBLPTSTRA eşleşenler için)
      try {
        await itsApiService.updatePTSBildirimDurum(transferId, recordsToUpdate, tumBasarili, kullanici)
        log('✅ PTS tabloları güncellendi')
      } catch (updateError) {
        log('❌ PTS tablo güncelleme hatası:', updateError.message)
      }
    }

    res.json(result)

  } catch (error) {
    console.error('❌ PTS Alım İade Bildirimi Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Alım iade bildirimi gönderilemedi'
    })
  }
})

/**
 * POST /api/pts/:transferId/dogrulama
 * PTS Doğrulama - ITS'den sorgular ama VERİTABANINA YAZMAZ
 * Sadece sonuçları client'a döner
 */
router.post('/:transferId/dogrulama', async (req, res) => {
  try {
    const { transferId } = req.params
    const { products, settings } = req.body

    log('🔍 PTS Doğrulama İsteği:', { transferId, productCount: products?.length })

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Doğrulanacak ürün listesi boş'
      })
    }

    // ITS API servisini import et
    const itsApiService = await import('../services/itsApiService.js')

    // Doğrulama yap
    const result = await itsApiService.dogrulamaYap(products, settings)

    log('📋 PTS Doğrulama Sonucu:', {
      success: result.success,
      dataCount: result.data?.length
    })

    // NOT: Veritabanına YAZMIYORUZ - sadece sonuçları client'a dönüyoruz

    res.json(result)

  } catch (error) {
    console.error('❌ PTS Doğrulama Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Doğrulama yapılamadı'
    })
  }
})

/**
 * POST /api/pts/:transferId/sorgula
 * Transfer ID ile ürün durumlarını sorgula (verify endpoint)
 */
router.post('/:transferId/sorgula', async (req, res) => {
  try {
    const { transferId } = req.params
    const { products, settings } = req.body

    log('🔍 PTS Durum Sorgulama İsteği:', { transferId, productCount: products?.length })

    if (!products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sorgulanacak ürün listesi boş'
      })
    }

    const result = await ptsService.durumSorgula(transferId, products, settings)
    res.json(result)

  } catch (error) {
    console.error('❌ PTS Durum Sorgulama Hatası:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Sorgulama yapılamadı'
    })
  }
})

export default router

