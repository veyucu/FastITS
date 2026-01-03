/**
 * Cari Service - Cari (Müşteri/Tedarikçi) Yönetimi Servisi
 * TBLCASABIT tablosundan cari listesi çekimi
 */

import sql from 'mssql'
import { getConnection } from '../config/database.js'

const cariService = {
    /**
     * Tüm carileri getir
     * Serbest Bildirim sayfasında cari seçimi için kullanılır
     */
    async getAllCariler(searchText = '') {
        try {
            console.log('🔄 cariService.getAllCariler çağrıldı, searchText:', searchText)
            const pool = await getConnection()
            console.log('✅ Veritabanı bağlantısı alındı, database:', pool.config?.database || 'unknown')

            // Basit sorgu - önce sadece TBLCASABIT ile test
            let query = `
                SELECT
                    A.CARI_KOD,
                    DBO.TRK(A.CARI_ISIM) AS CARI_ISIM,
                    DBO.TRK(A.CARI_ILCE) AS CARI_ILCE,
                    DBO.TRK(A.CARI_IL) AS CARI_IL,
                    DBO.TRK(B.CARIALIAS) AS EMAIL,
                    DBO.TRK(A.CARI_TEL) AS CARI_TEL,
                    ISNULL(A.EMAIL, '') AS GLN_NO,
                    ISNULL(B.KULL3S, '') AS UTS_NO
                FROM
                    TBLCASABIT A WITH (NOLOCK)
                LEFT JOIN
                    TBLCASABITEK B WITH (NOLOCK)
                ON (A.CARI_KOD = B.CARI_KOD)
            `

            // Arama filtresi varsa ekle
            if (searchText && searchText.trim()) {
                query += `
                WHERE 
                    DBO.TRK(A.CARI_ISIM) LIKE @search
                `
            }

            query += `
                ORDER BY DBO.TRK(A.CARI_ISIM)
            `

            console.log('📝 Sorgu çalıştırılıyor...')
            const request = pool.request()
            request.timeout = 30000 // 30 saniye timeout

            if (searchText && searchText.trim()) {
                request.input('search', sql.NVarChar, `%${searchText.trim()}%`)
            }

            const result = await request.query(query)
            console.log('✅ Sorgu tamamlandı, kayıt sayısı:', result.recordset?.length || 0)

            const cariler = result.recordset.map(row => ({
                cariKodu: row.CARI_KOD?.trim() || '',
                cariIsim: row.CARI_ISIM?.trim() || '',
                ilce: row.CARI_ILCE?.trim() || '',
                il: row.CARI_IL?.trim() || '',
                email: row.EMAIL?.trim() || '',
                telefon: row.CARI_TEL?.trim() || '',
                glnNo: row.GLN_NO?.trim() || ''
            }))

            return {
                success: true,
                data: cariler,
                count: cariler.length
            }
        } catch (error) {
            console.error('❌ Cari listesi hatası:', error)
            return { success: false, error: error.message, data: [] }
        }
    }
}

export default cariService
