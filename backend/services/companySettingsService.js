/**
 * Company Settings Service - Şirket Ayarları Servisi
 * AKTBLAYAR tablosundaki 'aktifSirketler' ayarı üzerinden aktif şirket yönetimi
 * Aktif şirketler virgülle ayrılmış liste olarak saklanır
 * Not: Aktif şirketler cache'leniyor, her sorguda DB'ye gidilmiyor
 */

import { getPTSConnection } from '../config/database.js'

const AYAR_ADI = 'aktifSirketler'

// Cache for aktif şirketler (sonsuz - sadece ayar değişince invalidate olur)
let activeCompaniesCache = null

const companySettingsService = {
    /**
     * Aktif şirketleri getir (cache'den veya DB'den)
     * Cache bir kez yüklenir ve ayar değişene kadar tutulur
     * @param {boolean} forceRefresh - Cache'i yoksay ve DB'den oku
     */
    async getActiveCompanies(forceRefresh = false) {
        try {
            // Cache varsa kullan
            if (!forceRefresh && activeCompaniesCache !== null) {
                return { success: true, data: activeCompaniesCache, cached: true }
            }

            const pool = await getPTSConnection()
            const result = await pool.request()
                .input('ayarAdi', AYAR_ADI)
                .query(`
                    SELECT AYAR_DEGERI 
                    FROM AKTBLAYAR WITH (NOLOCK)
                    WHERE AYAR_ADI = @ayarAdi
                `)

            if (result.recordset.length === 0 || !result.recordset[0].AYAR_DEGERI) {
                activeCompaniesCache = []
                return { success: true, data: [] }
            }

            // Virgülle ayrılmış listeyi array'e çevir ve boşlukları temizle
            const sirketler = result.recordset[0].AYAR_DEGERI
                .split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0)

            // Cache'e kaydet
            activeCompaniesCache = sirketler
            console.log('📋 Aktif şirketler cache güncellendi:', sirketler.length, 'şirket')

            return { success: true, data: sirketler }
        } catch (error) {
            console.error('❌ Aktif şirketler hatası:', error)
            return { success: false, error: error.message, data: [] }
        }
    },

    /**
     * Cache'i invalidate et (güncelleme sonrası çağrılır)
     */
    invalidateCache() {
        activeCompaniesCache = null
        cacheLoadedAt = null
        console.log('🔄 Aktif şirketler cache invalidate edildi')
    },

    /**
     * Tüm şirketleri aktiflik durumu ile getir
     */
    async getAllWithStatus() {
        try {
            const pool = await getPTSConnection()

            // Önce SIRKETLER30'dan tüm şirketleri al
            const sirketlerResult = await pool.request().query(`
                SELECT SIRKET FROM SIRKETLER30 WITH (NOLOCK) ORDER BY SIRKET
            `)

            // Aktif şirketleri al
            const aktifResult = await this.getActiveCompanies()
            const aktifSirketler = new Set(aktifResult.data || [])

            return {
                success: true,
                data: sirketlerResult.recordset.map(row => ({
                    sirket: row.SIRKET?.trim(),
                    aktif: aktifSirketler.has(row.SIRKET?.trim())
                }))
            }
        } catch (error) {
            console.error('❌ Şirket durumları hatası:', error)
            return { success: false, error: error.message, data: [] }
        }
    },

    /**
     * Şirket aktiflik durumunu güncelle
     */
    async setCompanyStatus(sirket, aktif) {
        try {
            const pool = await getPTSConnection()

            // Mevcut aktif şirketleri al (forceRefresh ile güncel veri al)
            const mevcutResult = await this.getActiveCompanies(true)
            let sirketler = mevcutResult.data || []

            if (aktif) {
                // Şirketi ekle (eğer yoksa)
                if (!sirketler.includes(sirket)) {
                    sirketler.push(sirket)
                }
            } else {
                // Şirketi çıkar
                sirketler = sirketler.filter(s => s !== sirket)
            }

            // Listeyi virgülle birleştir
            const yeniDeger = sirketler.join(',')

            // Upsert - varsa güncelle, yoksa ekle
            await pool.request()
                .input('ayarAdi', AYAR_ADI)
                .input('ayarDegeri', yeniDeger)
                .query(`
                    MERGE AKTBLAYAR AS target
                    USING (SELECT @ayarAdi AS AYAR_ADI) AS source
                    ON target.AYAR_ADI = source.AYAR_ADI
                    WHEN MATCHED THEN
                        UPDATE SET AYAR_DEGERI = @ayarDegeri
                    WHEN NOT MATCHED THEN
                        INSERT (AYAR_ADI, AYAR_DEGERI, ACIKLAMA) 
                        VALUES (@ayarAdi, @ayarDegeri, 'Aktif Şirketler (virgülle ayrılmış)');
                `)

            // Cache'i invalidate et
            this.invalidateCache()

            // companyService cache'ini de invalidate et (circular dependency nedeniyle dynamic import)
            try {
                const companyService = await import('./companyService.js')
                companyService.default.invalidateCache()
            } catch (e) {
                console.log('⚠️ companyService cache invalidate edilemedi')
            }

            return { success: true }
        } catch (error) {
            console.error('❌ Şirket durumu güncelleme hatası:', error)
            return { success: false, error: error.message }
        }
    }
}

export default companySettingsService
