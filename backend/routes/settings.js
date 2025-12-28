import express from 'express'
import settingsService from '../services/settingsService.js'

const router = express.Router()

// GET /api/settings - Ayarları getir
router.get('/', async (req, res) => {
  try {
    const settings = settingsService.getSettings()
    res.json({
      success: true,
      data: settings
    })
  } catch (error) {
    console.error('Ayarlar getirme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'Ayarlar alınamadı',
      error: error.message
    })
  }
})

// POST /api/settings - Ayarları kaydet
router.post('/', async (req, res) => {
  try {
    const settings = req.body
    await settingsService.saveSettings(settings)
    res.json({
      success: true,
      message: 'Ayarlar kaydedildi'
    })
  } catch (error) {
    console.error('Ayarlar kaydetme hatası:', error)
    res.status(500).json({
      success: false,
      message: 'Ayarlar kaydedilemedi',
      error: error.message
    })
  }
})

export default router



