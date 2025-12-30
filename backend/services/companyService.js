/**
 * Company Service - Şirket Yönetimi Servisi
 * NETSIS.SIRKETLER30 tablosundan şirket listesi ve kullanıcı yetkilendirmesi
 * Not: SIRKETLER30 tablosunda sadece SIRKET kolonu var ve bu aynı zamanda veritabanı adı
 */

import sql from 'mssql'
import { getPTSConnection } from '../config/database.js'
import companySettingsService from './companySettingsService.js'

const companyService = {
    /**
     * Aktif şirketleri getir
     * Login sayfasındaki dropdown için kullanılır
     * NOT: Hiç aktif şirket yoksa TÜM şirketler gösterilir (ilk kurulum için)
     */
    async getAllCompanies() {
        try {
            const pool = await getPTSConnection()

            // Aktif şirketleri al (AKTBLAYAR'dan)
            const aktifResult = await companySettingsService.getActiveCompanies()
            const aktifSirketler = aktifResult.data || []

            // Aktif şirket varsa sadece onları döndür
            if (aktifSirketler.length > 0) {
                // SIRKETLER30 ile kesişim (aktif listesiyle filtrele)
                const params = aktifSirketler.map((_, i) => `@code${i}`).join(', ')
                const request = pool.request()
                aktifSirketler.forEach((code, i) => {
                    request.input(`code${i}`, code)
                })

                const result = await request.query(`
                    SELECT SIRKET
                    FROM SIRKETLER30 WITH (NOLOCK)
                    WHERE SIRKET IN (${params})
                    ORDER BY SIRKET
                `)

                return {
                    success: true,
                    data: result.recordset.map(row => ({
                        sirket: row.SIRKET?.trim()
                    }))
                }
            }

            // Hiç aktif şirket yoksa TÜM şirketleri getir (fallback)
            console.log('⚠️ Aktif şirket yok - tüm şirketler gösteriliyor')
            const allResult = await pool.request()
                .query(`
                    SELECT SIRKET
                    FROM SIRKETLER30 WITH (NOLOCK)
                    ORDER BY SIRKET
                `)

            return {
                success: true,
                data: allResult.recordset.map(row => ({
                    sirket: row.SIRKET?.trim()
                }))
            }
        } catch (error) {
            console.error('❌ Şirket listesi hatası:', error)
            return { success: false, error: error.message, data: [] }
        }
    },

    /**
     * Kullanıcının yetkili olduğu şirketleri getir
     */
    async getUserCompanies(yetkiSirketler) {
        try {
            const pool = await getPTSConnection()

            if (!yetkiSirketler || yetkiSirketler.trim() === '') {
                return await this.getAllCompanies()
            }

            const codes = yetkiSirketler.split(',').map(c => c.trim()).filter(c => c)

            if (codes.length === 0) {
                return await this.getAllCompanies()
            }

            const params = codes.map((_, i) => `@code${i}`).join(', ')
            const request = pool.request()
            codes.forEach((code, i) => {
                request.input(`code${i}`, code)
            })

            const result = await request.query(`
                SELECT SIRKET
                FROM SIRKETLER30 WITH (NOLOCK)
                WHERE SIRKET IN (${params})
                ORDER BY SIRKET
            `)

            return {
                success: true,
                data: result.recordset.map(row => ({
                    sirket: row.SIRKET?.trim()
                }))
            }
        } catch (error) {
            console.error('❌ Kullanıcı şirketleri hatası:', error)
            return { success: false, error: error.message, data: [] }
        }
    },

    /**
     * Kullanıcının belirli bir şirkete erişim yetkisi var mı kontrol et
     */
    checkCompanyAccess(yetkiSirketler, companyCode) {
        if (!yetkiSirketler || yetkiSirketler.trim() === '') {
            return true
        }
        const codes = yetkiSirketler.split(',').map(c => c.trim().toUpperCase())
        return codes.includes(companyCode.trim().toUpperCase())
    },

    /**
     * Şirket kodundan database adını getir
     */
    async getDatabaseName(companyCode) {
        return companyCode?.trim() || null
    }
}

export default companyService
