/**
 * Company Service - Şirket Yönetimi Servisi
 * NETSIS.SIRKETLER30 tablosundan şirket listesi ve kullanıcı yetkilendirmesi
 * Not: SIRKETLER30 tablosunda sadece SIRKET kolonu var ve bu aynı zamanda veritabanı adı
 * Not: Şirket listesi cache'leniyor, her sorguda DB'ye gidilmiyor
 */

import sql from 'mssql'
import { getPTSConnection } from '../config/database.js'
import companySettingsService from './companySettingsService.js'

// Cache for şirket listesi (sonsuz - sadece ayar değişince invalidate olur)
let companiesCache = null

const companyService = {
    /**
     * Aktif şirketleri getir
     * Login sayfasındaki dropdown için kullanılır
     * Cache bir kez yüklenir ve ayar değişene kadar tutulur
     * NOT: Hiç aktif şirket yoksa TÜM şirketler gösterilir (ilk kurulum için)
     */
    async getAllCompanies(forceRefresh = false) {
        try {
            // Cache varsa kullan
            if (!forceRefresh && companiesCache !== null) {
                return { success: true, data: companiesCache, cached: true }
            }

            const pool = await getPTSConnection()

            // Aktif şirketleri al (AKTBLAYAR'dan - bu da cache'li)
            const aktifResult = await companySettingsService.getActiveCompanies()
            const aktifSirketler = aktifResult.data || []

            let resultData = []

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

                resultData = result.recordset.map(row => ({
                    sirket: row.SIRKET?.trim()
                }))
            } else {
                // Hiç aktif şirket yoksa TÜM şirketleri getir (fallback)
                console.log('⚠️ Aktif şirket yok - tüm şirketler gösteriliyor')
                const allResult = await pool.request()
                    .query(`
                        SELECT SIRKET
                        FROM SIRKETLER30 WITH (NOLOCK)
                        ORDER BY SIRKET
                    `)

                resultData = allResult.recordset.map(row => ({
                    sirket: row.SIRKET?.trim()
                }))
            }

            // Cache'e kaydet
            companiesCache = resultData
            console.log('📋 Şirket listesi cache güncellendi:', resultData.length, 'şirket')

            return { success: true, data: resultData }
        } catch (error) {
            console.error('❌ Şirket listesi hatası:', error)
            return { success: false, error: error.message, data: [] }
        }
    },

    /**
     * Cache'i invalidate et
     */
    invalidateCache() {
        companiesCache = null
        cacheLoadedAt = null
        console.log('🔄 Şirket listesi cache invalidate edildi')
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
