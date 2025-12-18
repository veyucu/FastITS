import express from 'express'
import * as ptsService from '../services/ptsService.js'
import * as ptsDbService from '../services/ptsDbService.js'

const router = express.Router()

/**
 * GET /api/pts/transfers
 * Tüm PTS transferlerini getir
 */
router.get('/transfers', async (req, res) => {
  try {
    const transfers = await ptsDbService.getAllTransfers()
    res.json(transfers)
  } catch (error) {
    console.error('❌ PTS transfer listesi getirme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'Transfer listesi alınamadı',
      error: error.message
    })
  }
})

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
router.post('/download-bulk', async (req, res) => {
  try {
    const { startDate, endDate, settings } = req.body

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Başlangıç ve bitiş tarihi gerekli'
      })
    }

    console.log('📥 Toplu paket indirme başlıyor:', { startDate, endDate })

    // 1. Transfer ID listesini al
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
          failed: 0,
          packages: []
        },
        message: 'Belirtilen tarih aralığında paket bulunamadı'
      })
    }

    console.log(`📦 ${transferIds.length} paket bulundu`)

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

      try {
        // Daha önce indirilmiş mi kontrol et
        const existingCheck = await ptsDbService.getPackageData(transferId)
        
        if (existingCheck.success && existingCheck.data) {
          results.skipped++
          results.packages.push({
            transferId,
            status: 'skipped',
            message: 'Daha önce indirilmiş'
          })
          continue
        }

        // Paketi indir
        const downloadResult = await ptsService.downloadPackage(transferId, settings)
        
        if (downloadResult.success) {
          // Veritabanına kaydet
          const saveResult = await ptsDbService.savePackageData(downloadResult.data)
          
          if (saveResult.success) {
            results.downloaded++
            results.packages.push({
              transferId,
              status: 'success',
              productCount: downloadResult.data?.products?.length || 0
            })
            console.log(`✅ ${transferId} veritabanına kaydedildi`)
          } else {
            results.failed++
            results.packages.push({
              transferId,
              status: 'failed',
              message: `Kayıt hatası: ${saveResult.message}`
            })
            console.error(`❌ ${transferId} veritabanına kaydedilemedi:`, saveResult.message)
          }
        } else {
          results.failed++
          results.packages.push({
            transferId,
            status: 'failed',
            message: downloadResult.message
          })
          console.error(`❌ Hata: ${transferId} - ${downloadResult.message}`)
        }

      } catch (error) {
        results.failed++
        results.packages.push({
          transferId,
          status: 'failed',
          message: error.message
        })
        console.error(`❌ ${transferId} indirme hatası:`, error.message)
      }
    }

    console.log('📊 Toplu indirme tamamlandı:', results)

    res.json({
      success: true,
      data: results,
      message: `${results.downloaded} paket indirildi, ${results.skipped} atlandı, ${results.failed} hata`
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
    const { cariGlnColumn, stockBarcodeColumn } = req.query

    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: 'Transfer ID gerekli'
      })
    }

    const result = await ptsDbService.getPackageData(transferId, cariGlnColumn, stockBarcodeColumn)
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

export default router

