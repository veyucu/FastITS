import express from 'express'
import * as itsDbService from '../services/itsDbService.js'
import companyMiddleware from '../middleware/companyMiddleware.js'

const router = express.Router()

// Tüm ITS route'larına company middleware uygula
router.use(companyMiddleware)

/**
 * ITS kayıtlarını listele
 * GET /api/its
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      durum: req.query.durum,
      fatirsNo: req.query.fatirsNo,
      gtin: req.query.gtin,
      seriNo: req.query.seriNo,
      cariKodu: req.query.cariKodu
    }

    const result = await itsDbService.listITSRecords(filters)
    res.json(result)
  } catch (error) {
    console.error('ITS listesi hatası:', error)
    res.status(500).json({
      success: false,
      message: 'ITS kayıtları listelenemedi',
      error: error.message
    })
  }
})

// ==================== MESAJ KODLARI (ÖNCELİKLİ) ====================
// Bu route'lar /:id route'undan ÖNCE olmalı!

/**
 * Mesaj kodlarını listele
 * GET /api/its/mesaj-kodlari
 */
router.get('/mesaj-kodlari', async (req, res) => {
  try {
    const itsApiService = await import('../services/itsApiService.js')
    const result = await itsApiService.getAllMesajKodlari()
    res.json(result)
  } catch (error) {
    console.error('Mesaj kodları getirme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'Mesaj kodları getirilemedi',
      error: error.message
    })
  }
})

/**
 * ITS'den mesaj kodlarını çek ve güncelle
 * POST /api/its/mesaj-kodlari/guncelle
 */
router.post('/mesaj-kodlari/guncelle', async (req, res) => {
  try {
    const { settings } = req.body
    const itsApiService = await import('../services/itsApiService.js')
    const result = await itsApiService.getCevapKodlari(settings)
    res.json(result)
  } catch (error) {
    console.error('Mesaj kodları güncelleme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'Mesaj kodları güncellenemedi',
      error: error.message
    })
  }
})

/**
 * ITS kaydı getir
 * GET /api/its/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const recno = parseInt(req.params.id)
    const result = await itsDbService.getITSRecord(recno)

    if (!result.success) {
      return res.status(404).json(result)
    }

    res.json(result)
  } catch (error) {
    console.error('ITS kaydı getirme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'ITS kaydı getirilemedi',
      error: error.message
    })
  }
})

/**
 * Yeni ITS kaydı ekle
 * POST /api/its
 */
router.post('/', async (req, res) => {
  try {
    const result = await itsDbService.addITSRecord(req.body)
    res.json(result)
  } catch (error) {
    console.error('ITS kaydı ekleme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'ITS kaydı eklenemedi',
      error: error.message
    })
  }
})

/**
 * ITS kaydını güncelle
 * PUT /api/its/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const recno = parseInt(req.params.id)
    const result = await itsDbService.updateITSRecord(recno, req.body)
    res.json(result)
  } catch (error) {
    console.error('ITS kaydı güncelleme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'ITS kaydı güncellenemedi',
      error: error.message
    })
  }
})

/**
 * ITS kaydını sil
 * DELETE /api/its/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const recno = parseInt(req.params.id)
    const result = await itsDbService.deleteITSRecord(recno)
    res.json(result)
  } catch (error) {
    console.error('ITS kaydı silme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'ITS kaydı silinemedi',
      error: error.message
    })
  }
})

/**
 * Toplu bildirim durumu güncelle
 * POST /api/its/bulk-update
 */
router.post('/bulk-update', async (req, res) => {
  try {
    const { recnos, bildirimId, bildirimTarihi, durum } = req.body

    if (!recnos || !Array.isArray(recnos) || recnos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Geçerli RECNO listesi gerekli'
      })
    }

    const result = await itsDbService.updateBulkNotificationStatus(
      recnos,
      bildirimId,
      bildirimTarihi,
      durum
    )
    res.json(result)
  } catch (error) {
    console.error('Toplu güncelleme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'Toplu güncelleme yapılamadı',
      error: error.message
    })
  }
})

/**
 * İstatistikler
 * GET /api/its/statistics
 */
router.get('/statistics/summary', async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    }

    const result = await itsDbService.getITSStatistics(filters)
    res.json(result)
  } catch (error) {
    console.error('İstatistik getirme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'İstatistikler getirilemedi',
      error: error.message
    })
  }
})

export default router
