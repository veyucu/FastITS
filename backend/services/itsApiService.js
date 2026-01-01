/**
 * ITS API Servisi - İlaç Takip Sistemi Web Servisi İşlemleri
 * Bu dosya ITS web servisleriyle iletişim kurar (Satış Bildirimi, İptal, Doğrulama vb.)
 */

import axios from 'axios'
import { getConnection, getPTSConnection } from '../config/database.js'
import * as settingsHelper from '../utils/settingsHelper.js'
import { log } from '../utils/logger.js'
import { toSqlTurkishChars } from '../utils/stringUtils.js'
import { getMessage } from './itsMessageService.js'
import { getCurrentUsername } from '../utils/requestContext.js'

// Not: Türkçe karakter düzeltmesi SQL'de DBO.TRK fonksiyonu ile yapılıyor
// Not: ITS mesajları itsMessageService cache'inden alınıyor

/**
 * Ayarları yükle ve config oluştur
 */
function loadITSConfig(frontendSettings = null) {
    if (frontendSettings) {
        settingsHelper.updateSettings(frontendSettings)
    }

    const creds = settingsHelper.getITSCredentials()

    return {
        username: creds.username,
        password: creds.password,
        glnNo: creds.glnNo,
        baseUrl: creds.baseUrl,
        tokenUrl: settingsHelper.getSetting('itsTokenUrl', '/token/app/token'),
        depoSatisUrl: settingsHelper.getSetting('itsDepoSatisUrl', '/wholesale/app/dispatch'),
        satisIptalUrl: settingsHelper.getSetting('itsSatisIptalUrl', '/wholesale/app/dispatchcancel'),
        malAlimUrl: settingsHelper.getSetting('itsMalAlimUrl', '/common/app/accept'),
        malIadeUrl: settingsHelper.getSetting('itsMalIadeUrl', '/common/app/return'),
        dogrulamaUrl: settingsHelper.getSetting('itsDogrulamaUrl', '/reference/app/verification'),
        checkStatusUrl: settingsHelper.getSetting('itsCheckStatusUrl', '/reference/app/check_status'),
        cevapKodUrl: settingsHelper.getSetting('itsCevapKodUrl', '/reference/app/errorcode')
    }
}

/**
 * GTIN'i 14 karaktere tamamla (başına 0 ekle)
 */
function formatGtin(gtin) {
    if (!gtin) return gtin
    const gtinStr = String(gtin).trim()
    return gtinStr.padStart(14, '0')
}

/**
 * Miad verisini yyyy-MM-dd formatına çevir
 * Gelen format: YYMMDD, YYYYMMDD, DD.MM.YYYY veya Date objesi olabilir
 */
function formatMiad(miad) {
    if (!miad) return miad

    try {
        // Eğer Date objesi ise
        if (miad instanceof Date) {
            return miad.toISOString().split('T')[0]
        }

        const miadStr = String(miad).trim()

        // Eğer zaten yyyy-MM-dd formatında ise
        if (/^\d{4}-\d{2}-\d{2}$/.test(miadStr)) {
            return miadStr
        }

        // DD.MM.YYYY formatı (Türkçe format)
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(miadStr)) {
            const parts = miadStr.split('.')
            return `${parts[2]}-${parts[1]}-${parts[0]}`
        }

        // YYMMDD formatı (6 karakter)
        if (miadStr.length === 6) {
            const yy = miadStr.substring(0, 2)
            const mm = miadStr.substring(2, 4)
            const dd = miadStr.substring(4, 6)
            // 2000'li yıllar varsayılıyor
            const yyyy = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`
            return `${yyyy}-${mm}-${dd}`
        }

        // YYYYMMDD formatı (8 karakter)
        if (miadStr.length === 8 && !miadStr.includes('-')) {
            const yyyy = miadStr.substring(0, 4)
            const mm = miadStr.substring(4, 6)
            const dd = miadStr.substring(6, 8)
            return `${yyyy}-${mm}-${dd}`
        }

        // Diğer durumlarda olduğu gibi döndür
        return miadStr
    } catch (error) {
        console.error('Miad formatlama hatası:', error)
        return miad
    }
}
/**
 * Access Token Al
 */
const getAccessToken = async (config) => {
    try {
        log('🔑 ITS Token alınıyor...')
        log('URL:', `${config.baseUrl}${config.tokenUrl}`)

        const requestBody = `{"username":"${config.username}","password":"${config.password}"}`

        const response = await axios.post(
            `${config.baseUrl}${config.tokenUrl}`,
            requestBody,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        )

        log('✅ ITS Token alındı')

        const token = response.data?.token || null

        if (!token) {
            console.error('❌ Token response\'da bulunamadı:', response.data)
            throw new Error('Token alınamadı')
        }

        return token
    } catch (error) {
        console.error('❌ ITS Token Hatası:', error.message)
        throw error
    }
}

/**
 * Depo Satış Bildirimi
 * Satış yapılan ürünlerin ITS'ye bildirilmesi
 * 
 * @param {string} karsiGlnNo - Alıcı GLN numarası
 * @param {Array} products - Ürün listesi [{gtin, seriNo/sn, miad/xd, lotNo/bn}]
 * @param {Object} frontendSettings - Frontend'den gelen ayarlar (opsiyonel)
 * @returns {Object} - { success, message, data }
 */
export const depoSatisBildirimi = async (karsiGlnNo, products, frontendSettings = null) => {
    try {
        if (!products || products.length === 0) {
            return { success: false, message: 'Bildirilecek ürün bulunamadı', data: [] }
        }

        const config = loadITSConfig(frontendSettings)

        if (!config.username || !config.password) {
            return { success: false, message: 'ITS kullanıcı adı veya şifre tanımlı değil' }
        }

        // Access Token al
        const token = await getAccessToken(config)

        // Ürün listesini hazırla
        const productList = products.map(p => ({
            gtin: formatGtin(p.gtin),
            sn: p.seriNo || p.sn,
            xd: formatMiad(p.miad || p.xd),   // Son kullanma tarihi (yyyy-MM-dd)
            bn: p.lotNo || p.bn   // Lot numarası
        }))

        log('📤 ITS Satış Bildirimi gönderiliyor:', { karsiGlnNo, productCount: productList.length })

        // API isteği
        const response = await axios.post(
            `${config.baseUrl}${config.depoSatisUrl}`,
            {
                togln: karsiGlnNo,
                productList: productList
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 30000
            }
        )

        log('✅ ITS Satış Bildirimi yanıtı:', response.data)

        // Sonuçları işle
        const results = (response.data?.productList || []).map(item => ({
            gtin: item.gtin,
            seriNo: item.sn,
            durum: item.uc  // uc = durum kodu (1 = başarılı vb.)
        }))

        const successCount = results.filter(r => r.durum == 1).length
        const errorCount = results.length - successCount

        return {
            success: true,
            message: `${successCount} ürün başarılı, ${errorCount} ürün hatalı`,
            data: results
        }

    } catch (error) {
        console.error('❌ ITS Satış Bildirimi Hatası:', error.message)
        return {
            success: false,
            message: error.response?.data?.message || error.message || 'Satış bildirimi başarısız',
            data: []
        }
    }
}

/**
 * Depo Satış İptal Bildirimi
 * Hatalı satış bildirimlerinin iptali
 */
export const depoSatisIptalBildirimi = async (karsiGlnNo, products, frontendSettings = null) => {
    try {
        if (!products || products.length === 0) {
            return { success: false, message: 'İptal edilecek ürün bulunamadı', data: [] }
        }

        const config = loadITSConfig(frontendSettings)

        if (!config.username || !config.password) {
            return { success: false, message: 'ITS kullanıcı adı veya şifre tanımlı değil' }
        }

        const token = await getAccessToken(config)

        const productList = products.map(p => ({
            gtin: formatGtin(p.gtin),
            sn: p.seriNo || p.sn,
            xd: formatMiad(p.miad || p.xd),
            bn: p.lotNo || p.bn
        }))

        log('🔴 ITS Satış İptal gönderiliyor:', { karsiGlnNo, productCount: productList.length })

        const response = await axios.post(
            `${config.baseUrl}${config.satisIptalUrl}`,
            {
                togln: karsiGlnNo,
                productList: productList
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 30000
            }
        )

        log('✅ ITS Satış İptal yanıtı:', response.data)

        const results = (response.data?.productList || []).map(item => ({
            gtin: item.gtin,
            seriNo: item.sn,
            durum: item.uc
        }))

        const successCount = results.filter(r => r.durum == 1).length
        const errorCount = results.length - successCount

        return {
            success: true,
            message: `${successCount} ürün başarıyla iptal edildi, ${errorCount} ürün hatalı`,
            data: results
        }

    } catch (error) {
        console.error('❌ ITS Satış İptal Hatası:', error.message)
        return {
            success: false,
            message: error.response?.data?.message || error.message || 'Satış iptal bildirimi başarısız',
            data: []
        }
    }
}

/**
 * Depo Alış Bildirimi (Mal Alım)
 * Alınan ürünlerin ITS'ye bildirilmesi
 * Örnek C# koduna göre sadece productList gönderilir
 * 
 * @param {Array} products - Ürün listesi [{gtin, seriNo/sn, miad/xd, lotNo/bn}]
 * @param {Object} frontendSettings - Frontend'den gelen ayarlar (opsiyonel)
 * @returns {Object} - { success, message, data }
 */
export const depoAlisBildirimi = async (products, frontendSettings = null) => {
    try {
        if (!products || products.length === 0) {
            return { success: false, message: 'Bildirilecek ürün bulunamadı', data: [] }
        }

        const config = loadITSConfig(frontendSettings)

        if (!config.username || !config.password) {
            return { success: false, message: 'ITS kullanıcı adı veya şifre tanımlı değil' }
        }

        // Access Token al
        const token = await getAccessToken(config)

        // Ürün listesini hazırla (C# örneğindeki gibi gtin, sn, xd, bn)
        const productList = products.map(p => ({
            gtin: formatGtin(p.gtin),
            sn: p.seriNo || p.sn,
            xd: formatMiad(p.miad || p.xd),   // Son kullanma tarihi (yyyy-MM-dd)
            bn: p.lotNo || p.bn   // Lot numarası
        }))

        log('📥 ITS Alış Bildirimi gönderiliyor:', { productCount: productList.length })

        // API isteği - /common/app/accept endpoint'i
        // Örnek C# koduna göre sadece productList gönderiliyor
        const response = await axios.post(
            `${config.baseUrl}${config.malAlimUrl}`,
            {
                productList: productList
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 30000
            }
        )

        log('✅ ITS Alış Bildirimi yanıtı:', response.data)

        // Sonuçları işle (mesajlar cache'den alınıyor)
        const results = (response.data?.productList || []).map(item => {
            const normalizedUc = String(item.uc).replace(/^0+/, '') || '0'
            return {
                gtin: item.gtin,
                seriNo: item.sn,
                durum: item.uc,
                durumMesaji: getMessage(normalizedUc, normalizedUc == '0' ? 'Başarılı' : `Hata: ${item.uc}`)
            }
        })

        const successCount = results.filter(r => String(r.durum).replace(/^0+/, '') === '0' || r.durum == 0).length
        const errorCount = results.length - successCount

        return {
            success: true,
            message: `${successCount} ürün başarılı, ${errorCount} ürün hatalı`,
            data: results
        }

    } catch (error) {
        console.error('❌ ITS Alış Bildirimi Hatası:', error.message)
        return {
            success: false,
            message: error.response?.data?.message || error.message || 'Alış bildirimi başarısız',
            data: []
        }
    }
}

/**
 * İade Alış Bildirimi (Mal İade)
 * Alınan ürünlerin tedarikçiye iadesi
 * C# örneğine göre togln ve productList gönderilir
 * 
 * @param {string} karsiGlnNo - Karşı taraf GLN numarası (iade edilecek taraf)
 * @param {Array} products - Ürün listesi [{gtin, seriNo/sn, miad/xd, lotNo/bn}]
 * @param {Object} frontendSettings - Frontend'den gelen ayarlar (opsiyonel)
 */
export const depoIadeAlisBildirimi = async (karsiGlnNo, products, frontendSettings = null) => {
    try {
        if (!products || products.length === 0) {
            return { success: false, message: 'İade edilecek ürün bulunamadı', data: [] }
        }

        const config = loadITSConfig(frontendSettings)

        if (!config.username || !config.password) {
            return { success: false, message: 'ITS kullanıcı adı veya şifre tanımlı değil' }
        }

        const token = await getAccessToken(config)

        const productList = products.map(p => ({
            gtin: formatGtin(p.gtin),
            sn: p.seriNo || p.sn,
            xd: formatMiad(p.miad || p.xd),
            bn: p.lotNo || p.bn
        }))

        log('🔴 ITS İade Alış Bildirimi gönderiliyor:', { karsiGlnNo, productCount: productList.length })

        // API isteği - /common/app/return endpoint'i (Mal İade)
        // C# örneğine göre togln ve productList gönderiliyor
        const response = await axios.post(
            `${config.baseUrl}${config.malIadeUrl}`,
            {
                togln: karsiGlnNo,
                productList: productList
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 30000
            }
        )

        log('✅ ITS İade Alış Bildirimi yanıtı:', response.data)

        // Sonuçları işle (mesajlar cache'den alınıyor)
        const results = (response.data?.productList || []).map(item => {
            const normalizedUc = String(item.uc).replace(/^0+/, '') || '0'
            return {
                gtin: item.gtin,
                seriNo: item.sn,
                durum: item.uc,
                durumMesaji: getMessage(normalizedUc, normalizedUc == '0' ? 'Başarılı' : `Hata: ${item.uc}`)
            }
        })

        const successCount = results.filter(r => String(r.durum).replace(/^0+/, '') === '0' || r.durum == 0).length
        const errorCount = results.length - successCount

        return {
            success: true,
            message: `${successCount} ürün başarıyla iade edildi, ${errorCount} ürün hatalı`,
            data: results
        }

    } catch (error) {
        console.error('❌ ITS İade Alış Bildirimi Hatası:', error.message)
        return {
            success: false,
            message: error.response?.data?.message || error.message || 'İade alış bildirimi başarısız',
            data: []
        }
    }
}

/**
 * Doğrulama İşlemi
 * Ürünlerin ITS'deki durumlarını doğrulama
 */
export const dogrulamaYap = async (products, frontendSettings = null) => {
    try {
        if (!products || products.length === 0) {
            return { success: false, message: 'Doğrulanacak ürün bulunamadı', data: [] }
        }

        const config = loadITSConfig(frontendSettings)

        if (!config.username || !config.password) {
            return { success: false, message: 'ITS kullanıcı adı veya şifre tanımlı değil' }
        }

        if (!config.glnNo) {
            return { success: false, message: 'GLN numarası tanımlı değil' }
        }

        const token = await getAccessToken(config)

        const productList = products.map(p => ({
            gtin: formatGtin(p.gtin),
            sn: p.seriNo || p.sn
        }))

        log('🔍 ITS Doğrulama gönderiliyor:', { glnNo: config.glnNo, productCount: productList.length })

        const response = await axios.post(
            `${config.baseUrl}${config.dogrulamaUrl}`,
            {
                dt: 'V',                    // V = Verification (Doğrulama)
                fr: config.glnNo,           // Gönderen GLN numarası
                productList: productList
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 30000
            }
        )

        log('✅ ITS Doğrulama yanıtı:', response.data)

        // Sonuçları işle (mesajlar cache'den alınıyor)
        const results = (response.data?.productList || []).map(item => {
            const normalizedUc = String(item.uc).replace(/^0+/, '') || '0'
            return {
                gtin: item.gtin,
                seriNo: item.sn,
                durum: item.uc,
                statu: item.status,
                durumMesaji: getMessage(normalizedUc, normalizedUc == '0' ? 'Başarılı' : `Hata: ${item.uc}`)
            }
        })

        return {
            success: true,
            message: `${results.length} ürün doğrulandı`,
            data: results
        }

    } catch (error) {
        console.error('❌ ITS Doğrulama Hatası:', error.message)
        return {
            success: false,
            message: error.response?.data?.message || error.message || 'Doğrulama başarısız',
            data: []
        }
    }
}

/**
 * Durum Sorgula (Check Status)
 * Ürünlerin ITS'deki durumunu sorgular - gln1, gln2 bilgilerini de döner
 */
export const durumSorgula = async (products, frontendSettings = null) => {
    try {
        if (!products || products.length === 0) {
            return { success: false, message: 'Sorgulanacak ürün bulunamadı', data: [] }
        }

        const config = loadITSConfig(frontendSettings)

        if (!config.username || !config.password) {
            return { success: false, message: 'ITS kullanıcı adı veya şifre tanımlı değil' }
        }

        // Bizim GLN numaramız
        const bizimGln = config.glnNo || ''

        const token = await getAccessToken(config)

        const productList = products.map(p => ({
            gtin: formatGtin(p.gtin),
            sn: p.seriNo || p.sn
        }))

        log('🔍 ITS Durum Sorgulama gönderiliyor:', { productCount: productList.length, bizimGln })

        const response = await axios.post(
            `${config.baseUrl}${config.checkStatusUrl}`,
            {
                productList: productList
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 30000
            }
        )

        log('✅ ITS Durum Sorgulama yanıtı:', response.data)

        // responseObjectList'den parse et (C# kodundaki gibi)
        const responseList = response.data?.responseObjectList || response.data?.productList || []

        // Benzersiz GLN'leri topla (bizimGln hariç)
        const uniqueGlns = new Set()
        responseList.forEach(item => {
            if (item.gln1 && item.gln1 !== bizimGln) uniqueGlns.add(item.gln1)
            if (item.gln2 && item.gln2 !== bizimGln) uniqueGlns.add(item.gln2)
        })

        // GLN -> Cari bilgi haritası oluştur (tek sorguda)
        const glnCariMap = {}
        if (uniqueGlns.size > 0) {
            try {
                const pool = await getConnection()
                const glnArray = Array.from(uniqueGlns)

                // Cari GLN kolon adını ayarlardan al (dinamik)
                const cariGlnBilgisi = settingsHelper.getSetting('cariGlnBilgisi', 'TBLCASABIT.EMAIL')
                const glnColumnParts = cariGlnBilgisi.split('.')
                const glnColumn = glnColumnParts.length > 1 ? glnColumnParts[1] : glnColumnParts[0]

                // GLN'leri parametre olarak ekle
                const glnParams = glnArray.map((_, i) => `@gln${i}`).join(', ')
                const query = `
                    SELECT ${glnColumn} AS GLN_NO, DBO.TRK(CARI_ISIM) AS CARI_ISIM 
                    FROM TBLCASABIT WITH (NOLOCK) 
                    WHERE ${glnColumn} IN (${glnParams})
                `

                const request = pool.request()
                glnArray.forEach((gln, i) => {
                    request.input(`gln${i}`, gln)
                })

                const result = await request.query(query)
                result.recordset.forEach(row => {
                    glnCariMap[row.GLN_NO] = row.CARI_ISIM
                })

                log('📋 GLN-Cari eşleşmesi:', Object.keys(glnCariMap).length, 'cari bulundu')
            } catch (e) {
                log('⚠️ Cari bilgileri alınamadı:', e.message)
            }
        }

        // Depo Adı ayarını al (BİZİM yerine kullanılacak)
        const depoAdi = settingsHelper.getSetting('depoAdi', 'BİZİM')

        // GLN'i okunabilir isme çevir
        const formatGlnName = (gln) => {
            if (!gln) return null
            if (gln === bizimGln) return depoAdi
            return glnCariMap[gln] || gln
        }

        // Sonuçları map'le (mesajlar cache'den alınıyor)
        const results = responseList.map(item => {
            const normalizedUc = String(item.uc || '').replace(/^0+/, '') || '0'
            const gln1Adi = formatGlnName(item.gln1)
            const gln2Adi = formatGlnName(item.gln2)

            // Mesajı cache'den al ve GLN1/GLN2 ifadelerini değiştir
            let mesaj = getMessage(normalizedUc, normalizedUc == '0' ? 'Başarılı' : `Kod: ${item.uc}`)
            if (gln1Adi) mesaj = mesaj.replace(/GLN1/gi, gln1Adi)
            if (gln2Adi) mesaj = mesaj.replace(/GLN2/gi, gln2Adi)

            return {
                gtin: item.gtin,
                seriNo: item.sn,
                gln1: item.gln1 || null,
                gln2: item.gln2 || null,
                gln1Adi: gln1Adi,
                gln2Adi: gln2Adi,
                durum: item.uc,
                durumMesaji: mesaj
            }
        })

        const failedCount = results.filter(r => r.durum != 1 && r.durum != '1' && r.durum != '0' && r.durum != 0).length

        return {
            success: true,
            message: `${results.length} ürün sorgulandı${failedCount > 0 ? `, ${failedCount} adet sorunlu` : ''}`,
            data: results
        }

    } catch (error) {
        console.error('❌ Durum Sorgulama Hatası:', error.message)
        return {
            success: false,
            message: error.response?.data?.message || error.message || 'Sorgulama başarısız',
            data: []
        }
    }
}

/**
 * Başarısız Ürünleri Sorgula (Check Status)
 * Daha önce yapılan bildirimlerde başarısız olan ürünleri sorgulama
 */
export const basarisizlariSorgula = async (products, frontendSettings = null) => {
    // durumSorgula ile aynı işlevi kullan
    return await durumSorgula(products, frontendSettings)
}

/**
 * Bildirim Sonuçlarını Veritabanına Kaydet
 * AKTBLITSUTS tablosundaki ilgili kayıtların durumunu güncelle
 * Temp Table + JOIN ile performanslı toplu güncelleme (tüm SQL Server sürümleriyle uyumlu)
 */
export const updateBildirimDurum = async (results) => {
    try {
        const pool = await getConnection()
        const kullanici = getCurrentUsername() // Context'ten al

        // recNo'su olan kayıtları filtrele
        const validResults = results.filter(item => item.recNo)

        if (validResults.length === 0) {
            return { success: true, updatedCount: 0 }
        }

        // SQL Server VALUES limiti: 1000 satır
        const CHUNK_SIZE = 1000

        // INSERT statement'ları oluştur (1000'lik chunk'lar halinde)
        const insertStatements = []
        for (let i = 0; i < validResults.length; i += CHUNK_SIZE) {
            const chunk = validResults.slice(i, i + CHUNK_SIZE)
            const valuesList = chunk.map(item =>
                `(${Number(item.recNo)}, '${String(item.durum || 'B').replace(/'/g, "''")}')`
            ).join(',\n            ')
            insertStatements.push(`INSERT INTO #BildirimUpdate (RECNO, DURUM) VALUES ${valuesList};`)
        }

        // Kullanıcı adını escape et
        const safeKullanici = kullanici ? String(kullanici).replace(/'/g, "''") : ''

        const query = `
            -- Temp table oluştur
            CREATE TABLE #BildirimUpdate (
                RECNO INT PRIMARY KEY,
                DURUM NVARCHAR(10)
            );

            -- Verileri chunk'lar halinde ekle
            ${insertStatements.join('\n            ')}

            -- JOIN ile toplu güncelle
            UPDATE A
            SET A.BILDIRIM = T.DURUM,
                A.BILDIRIM_TARIHI = GETDATE(),
                A.BILDIRIM_KULLANICI = '${safeKullanici}'
            FROM AKTBLITSUTS A
            INNER JOIN #BildirimUpdate T ON A.RECNO = T.RECNO;

            -- Temp table'ı temizle
            DROP TABLE #BildirimUpdate;
        `

        const request = pool.request()
        const result = await request.query(query)

        // UPDATE statement'ın index'i = 1 (CREATE) + INSERT sayısı + 0 (UPDATE kendi)
        const updateIndex = 1 + insertStatements.length
        const updatedCount = result.rowsAffected[updateIndex] || 0

        log('✅ Bildirim durumları toplu güncellendi:', updatedCount)
        return { success: true, updatedCount }
    } catch (error) {
        console.error('❌ Bildirim Durum Güncelleme Hatası:', error.message)
        throw error
    }
}

/**
 * Belgenin ITS Durumunu Güncelle
 * TBLFATUIRS veya TBLSIPAMAS tablosunda ITS_BILDIRIM, ITS_TARIH, ITS_KULLANICI alanlarını günceller
 * 
 * @param {string} subeKodu - Şube kodu
 * @param {string} fatirs_no - Fatura/Sipariş numarası
 * @param {string} ftirsip - Belge tipi (1=Satış Faturası, 2=Alış Faturası, 6=Sipariş)
 * @param {string} cariKodu - Cari kodu
 * @param {boolean} tumBasarili - Tüm satırlar başarılı mı (DURUM = 1)?
 */
export const updateBelgeITSDurum = async (subeKodu, fatirs_no, ftirsip, cariKodu, tumBasarili) => {
    try {
        const pool = await getConnection()
        const kullanici = getCurrentUsername() // Context'ten al

        // Belge tipi: '6' = Sipariş (TBLSIPAMAS), diğerleri = Fatura (TBLFATUIRS)
        const tableName = ftirsip === '6' ? 'TBLSIPAMAS' : 'TBLFATUIRS'
        const itsBildirim = tumBasarili ? 'OK' : 'NOK'

        log(`📋 Belge ITS durumu güncelleniyor: ${tableName}, FATIRS_NO=${fatirs_no}, CARI_KODU=${cariKodu}, ITS_BILDIRIM=${itsBildirim}`)

        const query = `
            UPDATE ${tableName}
            SET ITS_BILDIRIM = @itsBildirim,
                ITS_TARIH = GETDATE(),
                ITS_KULLANICI = @kullanici
            WHERE SUBE_KODU = @subeKodu 
              AND FATIRS_NO = @fatirsNo
              AND FTIRSIP = @ftirsip
              AND CARI_KODU = @cariKodu
        `

        const request = pool.request()
        request.input('itsBildirim', itsBildirim)
        request.input('kullanici', kullanici)
        request.input('subeKodu', subeKodu)
        request.input('fatirsNo', fatirs_no)
        request.input('ftirsip', ftirsip)
        request.input('cariKodu', cariKodu)

        const result = await request.query(query)

        if (result.rowsAffected[0] > 0) {
            log(`✅ Belge ITS durumu güncellendi: ${tableName} -> ${itsBildirim}`)
            return { success: true, itsBildirim }
        } else {
            log(`⚠️ Belge bulunamadı: ${tableName}, FATIRS_NO=${fatirs_no}, CARI_KODU=${cariKodu}`)
            return { success: false, message: 'Belge bulunamadı' }
        }

    } catch (error) {
        console.error('❌ Belge ITS Durum Güncelleme Hatası:', error.message)
        throw error
    }
}

/**
 * PTS Bildirim Durumunu Güncelle
 * AKTBLPTSTRA tablosunda her ürün için BILDIRIM ve BILDIRIM_TARIHI günceller
 * AKTBLPTSMAS tablosunda genel durum (OK/NOK) ve BILDIRIM_TARIHI günceller
 * 
 * @param {string} transferId - Transfer ID (AKTBLPTSMAS.ID)
 * @param {Array} results - Bildirim sonuçları [{id, durum}]
 * @param {boolean} tumBasarili - Tüm satırlar başarılı mı?
 */
export const updatePTSBildirimDurum = async (transferId, results, tumBasarili) => {
    try {
        const kullanici = getCurrentUsername() // Context'ten al
        log(`📋 PTS Bildirim durumu güncelleniyor: TRANSFER_ID=${transferId}, Sonuç sayısı=${results?.length || 0}, tumBasarili=${tumBasarili}, kullanici=${kullanici}`)

        const pool = await getPTSConnection()

        // 1. AKTBLPTSTRA tablosundaki ürünlerin durumunu TOPLU güncelle
        const validItems = (results || []).filter(item => item.id && item.durum !== undefined)

        if (validItems.length > 0) {
            try {
                // SQL Server VALUES limiti: 1000 satır
                const CHUNK_SIZE = 1000

                // INSERT statement'ları oluştur
                const insertStatements = []
                for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
                    const chunk = validItems.slice(i, i + CHUNK_SIZE)
                    const valuesList = chunk.map(item =>
                        `(${Number(item.id)}, '${String(item.durum).replace(/'/g, "''")}')`
                    ).join(',')
                    insertStatements.push(`INSERT INTO #PTSBildirimUpdate (ID, DURUM) VALUES ${valuesList};`)
                }

                const query = `
                    -- Temp table oluştur
                    CREATE TABLE #PTSBildirimUpdate (
                        ID INT PRIMARY KEY,
                        DURUM NVARCHAR(10)
                    );

                    -- Verileri chunk'lar halinde ekle
                    ${insertStatements.join('\n                    ')}

                    -- JOIN ile toplu güncelle
                    UPDATE A
                    SET A.BILDIRIM = T.DURUM,
                        A.BILDIRIM_TARIHI = GETDATE(),
                        A.BILDIRIM_KULLANICI = @kullanici
                    FROM AKTBLPTSTRA A
                    INNER JOIN #PTSBildirimUpdate T ON A.ID = T.ID
                    WHERE A.TRANSFER_ID = @transferId;

                    -- Temp table'ı temizle
                    DROP TABLE #PTSBildirimUpdate;
                `

                const request = pool.request()
                request.input('transferId', transferId)
                request.input('kullanici', kullanici)

                const result = await request.query(query)
                const updateIndex = 1 + insertStatements.length
                const totalUpdated = result.rowsAffected[updateIndex] || 0

                log(`✅ AKTBLPTSTRA: ${totalUpdated}/${validItems.length} kayıt güncellendi`)
            } catch (batchError) {
                log(`❌ AKTBLPTSTRA güncelleme hatası: ${batchError.message}`)
            }
        } else {
            log(`⚠️ AKTBLPTSTRA: Güncellenecek kayıt yok`)
        }

        // 2. AKTBLPTSMAS tablosundaki genel durumu güncelle
        const masDurum = tumBasarili ? 'OK' : 'NOK'
        const masQuery = `
            UPDATE AKTBLPTSMAS
            SET BILDIRIM = @durum,
                BILDIRIM_TARIHI = GETDATE(),
                BILDIRIM_KULLANICI = @kullanici
            WHERE TRANSFER_ID = @transferId
        `
        const masRequest = pool.request()
        masRequest.input('durum', masDurum)
        masRequest.input('transferId', transferId)
        masRequest.input('kullanici', kullanici)
        const masResult = await masRequest.query(masQuery)

        if (masResult.rowsAffected[0] > 0) {
            log(`✅ PTS Bildirim durumu güncellendi: TRANSFER_ID=${transferId} -> ${masDurum}`)
            return { success: true, durum: masDurum }
        } else {
            log(`⚠️ PTS Master kayıt bulunamadı: TRANSFER_ID=${transferId}`)
            return { success: false, message: 'PTS kayıt bulunamadı' }
        }

    } catch (error) {
        console.error('❌ PTS Bildirim Durum Güncelleme Hatası:', error.message)
        throw error
    }
}

/**
 * ITS'den Cevap Kodlarını Çek ve Veritabanına Kaydet
 * AKTBLITSMESAJ tablosuna ID ve MESAJ olarak kaydeder
 */
export const getCevapKodlari = async (frontendSettings = null) => {
    try {
        const config = loadITSConfig(frontendSettings)

        if (!config.username || !config.password) {
            return { success: false, message: 'ITS kullanıcı adı veya şifre tanımlı değil' }
        }

        const token = await getAccessToken(config)

        log('📋 ITS Cevap Kodları çekiliyor...')

        const response = await axios.post(
            `${config.baseUrl}${config.cevapKodUrl}`,
            {},
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 30000
            }
        )

        log('✅ ITS Cevap Kodları yanıtı alındı')

        const errorCodeList = response.data?.errorCodeList || []

        if (errorCodeList.length === 0) {
            return { success: false, message: 'Cevap kodu bulunamadı', data: [] }
        }

        // Veritabanına kaydet (NETSIS DB)
        const pool = await getPTSConnection()
        let insertedCount = 0
        let updatedCount = 0

        for (const item of errorCodeList) {
            const code = parseInt(item.code)
            const message = toSqlTurkishChars(item.message || '')

            // Önce var mı kontrol et
            const checkQuery = `SELECT COUNT(*) as count FROM AKTBLITSMESAJ WHERE ID = @code`
            const checkRequest = pool.request()
            checkRequest.input('code', code)
            const checkResult = await checkRequest.query(checkQuery)

            if (checkResult.recordset[0].count === 0) {
                // Yeni kayıt ekle
                const insertQuery = `INSERT INTO AKTBLITSMESAJ (ID, MESAJ) VALUES (@code, @message)`
                const insertRequest = pool.request()
                insertRequest.input('code', code)
                insertRequest.input('message', message)
                await insertRequest.query(insertQuery)
                insertedCount++
            } else {
                // Güncelle
                const updateQuery = `UPDATE AKTBLITSMESAJ SET MESAJ = @message WHERE ID = @code`
                const updateRequest = pool.request()
                updateRequest.input('code', code)
                updateRequest.input('message', message)
                await updateRequest.query(updateQuery)
                updatedCount++
            }
        }

        log(`✅ Mesaj kodları güncellendi: ${insertedCount} yeni, ${updatedCount} güncellendi`)

        return {
            success: true,
            message: `${insertedCount} yeni mesaj eklendi, ${updatedCount} mesaj güncellendi`,
            data: errorCodeList.map(item => ({
                id: parseInt(item.code),
                mesaj: item.message
            }))
        }

    } catch (error) {
        console.error('❌ Cevap Kodları Hatası:', error.message)
        return {
            success: false,
            message: error.response?.data?.message || error.message || 'Cevap kodları alınamadı',
            data: []
        }
    }
}

/**
 * Tüm Mesaj Kodlarını Getir
 * AKTBLITSMESAJ tablosundan okur
 */
export const getAllMesajKodlari = async () => {
    try {
        const pool = await getPTSConnection()

        const query = `SELECT ID, DBO.TRK(MESAJ) AS MESAJ FROM AKTBLITSMESAJ ORDER BY ID`
        const result = await pool.request().query(query)

        const records = result.recordset.map(row => ({
            id: row.ID,
            mesaj: row.MESAJ // DBO.TRK SQL'de uygulandı
        }))

        return {
            success: true,
            data: records,
            count: records.length
        }
    } catch (error) {
        console.error('❌ Mesaj Kodları Getirme Hatası:', error.message)
        return {
            success: false,
            message: error.message,
            data: []
        }
    }
}

/**
 * Mesaj Kodunu ID'ye Göre Getir
 */
export const getMesajByCode = async (code) => {
    try {
        const pool = await getPTSConnection()

        const query = `SELECT MESAJ FROM AKTBLITSMESAJ WHERE ID = @code`
        const request = pool.request()
        request.input('code', code)
        const result = await request.query(query)

        if (result.recordset.length > 0) {
            return result.recordset[0].MESAJ
        }
        return null
    } catch (error) {
        console.error('❌ Mesaj Kodu Getirme Hatası:', error.message)
        return null
    }
}

export default {
    loadITSConfig,
    depoSatisBildirimi,
    depoSatisIptalBildirimi,
    depoAlisBildirimi,
    depoIadeAlisBildirimi,
    dogrulamaYap,
    basarisizlariSorgula,
    updateBildirimDurum,
    updateBelgeITSDurum,
    getCevapKodlari,
    getAllMesajKodlari,
    getMesajByCode
}


