/**
 * Company Routes - Şirket Ayarları API
 */

import express from 'express'
import companySettingsService from '../services/companySettingsService.js'

const router = express.Router()

/**
 * GET /api/companies/settings
 * Tüm şirketleri aktiflik durumu ile getir
 */
router.get('/settings', async (req, res) => {
    try {
        const result = await companySettingsService.getAllWithStatus()
        res.json(result)
    } catch (error) {
        console.error('Şirket ayarları hatası:', error)
        res.status(500).json({ success: false, error: 'Sunucu hatası' })
    }
})

/**
 * PUT /api/companies/settings/:sirket
 * Şirket aktiflik durumunu güncelle
 */
router.put('/settings/:sirket', async (req, res) => {
    try {
        const { sirket } = req.params
        const { aktif } = req.body

        if (typeof aktif !== 'boolean') {
            return res.status(400).json({ success: false, error: 'aktif alanı boolean olmalı' })
        }

        const result = await companySettingsService.setCompanyStatus(sirket, aktif)
        res.json(result)
    } catch (error) {
        console.error('Şirket durumu güncelleme hatası:', error)
        res.status(500).json({ success: false, error: 'Sunucu hatası' })
    }
})

export default router
