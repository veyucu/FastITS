import express from 'express'
import documentService from '../services/documentService.js'

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

export default router
