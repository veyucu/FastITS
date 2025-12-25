import axios from 'axios'
import AdmZip from 'adm-zip'
import xml2js from 'xml2js'
import * as ptsDbService from './ptsDbService.js'
import * as settingsHelper from '../utils/settingsHelper.js'
import { log } from '../utils/logger.js'

// PTS Web Servis Entegrasyonu - Ayarlardan yüklenir
let PTS_CONFIG = null

/**
 * Ayarlardan PTS config'i yükle
 * @param {Object} frontendSettings - Frontend'den gelen ayarlar (opsiyonel)
 */
function loadPTSConfig(frontendSettings = null) {
  if (frontendSettings) {
    settingsHelper.updateSettings(frontendSettings)
  }

  const creds = settingsHelper.getITSCredentials()

  PTS_CONFIG = {
    username: creds.username,
    password: creds.password,
    glnNo: creds.glnNo,
    baseUrl: creds.baseUrl,
    tokenUrl: settingsHelper.getSetting('itsTokenUrl', '/token/app/token'),
    searchUrl: settingsHelper.getSetting('itsPaketSorguUrl', '/pts/app/search'),
    getPackageUrl: settingsHelper.getSetting('itsPaketIndirUrl', '/pts/app/GetPackage'),
    sendPackageUrl: settingsHelper.getSetting('itsPaketGonderUrl', '/pts/app/SendPackage'),
    simulationMode: false
  }

  return PTS_CONFIG
}

// İlk yüklemede default ayarları yükle
loadPTSConfig()


/**
 * PTS Token Alma
 * @param {Object} settings - Frontend ayarları (opsiyonel)
 * @returns {Promise<string|null>}
 */
async function getAccessToken(settings = null) {
  // Ayarlar verildiyse güncelle
  if (settings) {
    loadPTSConfig(settings)
  }

  // Simülasyon modu
  if (PTS_CONFIG.simulationMode) {
    log('🎭 Simülasyon modunda - Mock token dönülüyor')
    return 'MOCK_TOKEN_FOR_SIMULATION'
  }

  try {
    log('🔑 Token alınıyor...')
    log('URL:', `${PTS_CONFIG.baseUrl}${PTS_CONFIG.tokenUrl}`)
    log('Username:', PTS_CONFIG.username)

    // NetProITS formatında JSON string olarak gönder
    const requestBody = `{"username":"${PTS_CONFIG.username}","password":"${PTS_CONFIG.password}"}`

    const response = await axios.post(
      `${PTS_CONFIG.baseUrl}${PTS_CONFIG.tokenUrl}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )

    log('✅ Token alındı:', response.data)

    // Response'dan token'ı al
    const token = response.data?.token || null

    if (!token) {
      console.error('❌ Token response\'da bulunamadı:', response.data)
    }

    return token
  } catch (error) {
    console.error('❌ Token alma hatası:', error.message)
    if (error.response) {
      console.error('Response status:', error.response.status)
      console.error('Response data:', error.response.data)
    }
    return null
  }
}

/**
 * PTS'den paket listesi sorgula (tarih aralığında)
 * @param {Date} startDate - Başlangıç tarihi
 * @param {Date} endDate - Bitiş tarihi
 * @param {Object} settings - Frontend ayarları (opsiyonel)
 * @returns {Promise<Object>}
 */
async function searchPackages(startDate, endDate, settings = null) {
  // Ayarlar verildiyse güncelle
  if (settings) {
    loadPTSConfig(settings)
  }
  // Simülasyon modu
  if (PTS_CONFIG.simulationMode) {
    log('🎭 Simülasyon modunda - Mock paket listesi dönülüyor')
    return {
      success: true,
      data: ['123456789', '987654321', '555555555'], // Mock transfer ID'ler
      message: '3 paket bulundu (Simülasyon)'
    }
  }

  try {
    const token = await getAccessToken()
    if (!token) {
      return {
        success: false,
        message: 'Token alınamadı'
      }
    }

    const formatDate = (date) => {
      const d = new Date(date)
      return d.toISOString().split('T')[0] // YYYY-MM-DD
    }

    const response = await axios.post(
      `${PTS_CONFIG.baseUrl}${PTS_CONFIG.searchUrl}`,
      {
        sourceGln: '',
        destinationGln: PTS_CONFIG.glnNo,
        bringNotReceivedTransferInfo: 0,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      }
    )

    const transferIds = response.data?.transferDetails?.map(t => t.transferId) || []

    return {
      success: true,
      data: transferIds,
      message: `${transferIds.length} paket bulundu`
    }

  } catch (error) {
    console.error('❌ Paket sorgulama hatası:', error.message)
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Paket sorgulanamadı'
    }
  }
}

/**
 * PTS'den paket indir (Transfer ID ile)
 * @param {string} transferId - Transfer ID
 * @param {Object} settings - Frontend ayarları (opsiyonel)
 * @returns {Promise<Object>}
 */
async function downloadPackage(transferId, settings = null) {
  // Ayarlar verildiyse güncelle
  if (settings) {
    loadPTSConfig(settings)
  }
  // Simülasyon modu
  if (PTS_CONFIG.simulationMode) {
    console.log(`🎭 Simülasyon modunda - Mock paket verisi dönülüyor: ${transferId}`)
    return {
      success: true,
      data: {
        transferId,
        documentNumber: `DOC-${transferId}`,
        documentDate: new Date().toISOString().split('T')[0],
        sourceGLN: '8680001000000',
        destinationGLN: PTS_CONFIG.glnNo,
        products: [
          {
            carrierLabel: 'SSCC123456789',
            gtin: '08699544000015',
            expirationDate: '2025-12-31',
            lotNumber: 'LOT123',
            serialNumber: 'SN001'
          },
          {
            carrierLabel: 'SSCC123456789',
            gtin: '08699544000015',
            expirationDate: '2025-12-31',
            lotNumber: 'LOT123',
            serialNumber: 'SN002'
          }
        ]
      },
      message: '2 ürün bulundu (Simülasyon)'
    }
  }

  try {
    console.log(`📥 Paket indiriliyor: ${transferId}`)

    const token = await getAccessToken()
    if (!token) {
      return {
        success: false,
        message: 'Token alınamadı'
      }
    }

    const response = await axios.post(
      `${PTS_CONFIG.baseUrl}${PTS_CONFIG.getPackageUrl}`,
      {
        transferId: transferId
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      }
    )

    log('📦 API Response:', JSON.stringify(response.data).substring(0, 200))

    const base64Data = response.data?.fileStream
    if (!base64Data) {
      log('❌ fileStream bulunamadı. Response keys:', Object.keys(response.data || {}))
      return {
        success: false,
        message: 'Paket verisi alınamadı'
      }
    }

    log('✅ Base64 data alındı, uzunluk:', base64Data.length)

    // Base64'ten ZIP'e çevir
    const zipBuffer = Buffer.from(base64Data, 'base64')

    // ZIP'i aç
    const zip = new AdmZip(zipBuffer)
    const zipEntries = zip.getEntries()

    if (zipEntries.length === 0) {
      return {
        success: false,
        message: 'ZIP dosyası boş'
      }
    }

    // İlk XML dosyasını al
    const xmlContent = zipEntries[0].getData().toString('utf8')

    log('📄 XML İçeriği (ilk 1500 karakter):', xmlContent.substring(0, 1500))
    log('📄 XML Tam Uzunluk:', xmlContent.length)

    // XML'i parse et
    const parser = new xml2js.Parser()
    const xmlData = await parser.parseStringPromise(xmlContent)

    log('🔍 XML Root Keys:', Object.keys(xmlData))

    // XML'den bilgileri çıkar - transfer tag'ini destekle
    const root = xmlData.transfer || xmlData.package || xmlData.shipmentNotification || xmlData
    log('📦 Root Keys:', Object.keys(root))

    const packageInfo = {
      transferId,
      documentNumber: root.documentNumber?.[0] || '',
      documentDate: root.documentDate?.[0] || '',
      sourceGLN: root.sourceGLN?.[0] || '',
      destinationGLN: root.destinationGLN?.[0] || '',
      actionType: root.actionType?.[0] || '',
      shipTo: root.shipTo?.[0] || '',
      note: root.note?.[0] || '',
      version: root.version?.[0] || '',
      products: []
    }

    // Recursive carrier ve productList parse fonksiyonu
    // parentCarrierLabel: Bir üst seviyedeki carrier'ın label'ı
    // level: Carrier hiyerarşi seviyesi (1: Palet, 2: Koli, 3: Alt koli, vb.)
    const parseCarrier = (carrier, parentCarrierLabel = null, level = 1) => {
      const carrierLabel = carrier.$?.carrierLabel || null
      const containerType = carrier.$?.containerType || ''

      // ÖNEMLİ: Carrier'ın kendisi için bir kayıt ekle (SERIAL_NUMBER olmadan)
      // Bu sayede koli/palet barkodu okutulduğunda bulunabilir
      if (carrierLabel) {
        packageInfo.products.push({
          carrierLabel,
          parentCarrierLabel,
          containerType,
          carrierLevel: level,
          gtin: null,
          expirationDate: null,
          productionDate: null,
          lotNumber: null,
          serialNumber: null, // Carrier kaydı - ürün değil
          poNumber: null
        })
      }

      // ProductList'i parse et (Ürünler)
      if (carrier.productList) {
        for (const product of carrier.productList) {
          const gtin = product.$.GTIN || ''
          const expirationDate = product.$.expirationDate || product.$.ExpirationDate || ''
          const productionDate = product.$.productionDate || product.$.ProductionDate || ''
          const lotNumber = product.$.lotNumber || product.$.LotNumber || ''
          const poNumber = product.$.PONumber || ''

          // Serial numbers - productList altındaki serialNumber tag'lerini bul
          if (product.serialNumber) {
            const serialNumbers = Array.isArray(product.serialNumber) ? product.serialNumber : [product.serialNumber]

            for (const sn of serialNumbers) {
              const serialNumberValue = typeof sn === 'string' ? sn : (sn._ || sn)

              // Ürün kaydı - hangi carrier'da olduğu bilgisiyle
              packageInfo.products.push({
                carrierLabel,
                parentCarrierLabel,
                containerType,
                carrierLevel: level,
                gtin,
                expirationDate,
                productionDate,
                lotNumber,
                serialNumber: serialNumberValue,
                poNumber
              })
            }
          }
        }
      }

      // Alt carrier'ları recursive parse et
      if (carrier.carrier) {
        const subCarriers = Array.isArray(carrier.carrier) ? carrier.carrier : [carrier.carrier]
        for (const subCarrier of subCarriers) {
          // Alt carrier'ın parent'ı mevcut carrier, level +1
          parseCarrier(subCarrier, carrierLabel, level + 1)
        }
      }
    }

    // Carrier ve productList'i parse et
    if (root.carrier) {
      const carriers = Array.isArray(root.carrier) ? root.carrier : [root.carrier]
      for (const carrier of carriers) {
        parseCarrier(carrier)
      }
    }

    console.log(`✅ Paket parse edildi:`, {
      transferId,
      documentNumber: packageInfo.documentNumber,
      documentDate: packageInfo.documentDate,
      sourceGLN: packageInfo.sourceGLN,
      destinationGLN: packageInfo.destinationGLN,
      productCount: packageInfo.products.length
    })

    // NOT: Veritabanına kaydetme işlemi route'da yapılıyor (kayitKullanici bilgisiyle birlikte)
    // Bu fonksiyon sadece paketi indirip parse ediyor

    return {
      success: true,
      data: packageInfo,
      message: `${packageInfo.products.length} ürün bulundu`
    }

  } catch (error) {
    console.error('❌ Paket indirme hatası:', error.message)
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Paket indirilemedi'
    }
  }
}

/**
 * Transfer ID ile paket detayı sorgula
 * @param {string} transferId - Transfer ID
 * @param {Object} settings - Frontend ayarları (opsiyonel)
 * @returns {Promise<Object>}
 */
async function queryPackage(transferId, settings = null) {
  try {
    console.log(`🔍 Paket sorgulanıyor: ${transferId}`)

    // Paketi indir ve detaylarını döndür
    return await downloadPackage(transferId, settings)

  } catch (error) {
    console.error('❌ Paket sorgulama hatası:', error)

    return {
      success: false,
      message: 'Paket sorgulanamadı',
      error: error.message
    }
  }
}

/**
 * PTS'ye paket gönder (ITS bildirimi)
 * @param {Object} packageData - Gönderilecek paket bilgileri
 * @param {string} packageData.documentNumber - Belge numarası
 * @param {string} packageData.documentDate - Belge tarihi
 * @param {string} packageData.destinationGLN - Alıcı GLN
 * @param {Array} packageData.products - Ürün listesi
 * @param {Object} settings - Frontend ayarları (opsiyonel)
 * @returns {Promise<Object>}
 */
async function sendPackage(packageData, settings = null) {
  // Ayarlar verildiyse güncelle
  if (settings) {
    loadPTSConfig(settings)
  }

  // Simülasyon modu
  if (PTS_CONFIG.simulationMode) {
    log('🎭 Simülasyon modunda - Mock transfer ID dönülüyor')
    return {
      success: true,
      transferId: `SIM-${Date.now()}`,
      message: 'Bildirim başarılı (Simülasyon)'
    }
  }

  try {
    log('📤 PTS Bildirimi gönderiliyor...')
    log('Belge No:', packageData.documentNumber)
    log('Ürün Sayısı:', packageData.products?.length || 0)
    log('Alıcı GLN:', packageData.destinationGLN)

    const token = await getAccessToken()
    if (!token) {
      return {
        success: false,
        message: 'Token alınamadı'
      }
    }

    // XML oluştur
    const xmlContent = generatePTSNotificationXML(packageData)
    log('📄 XML oluşturuldu, uzunluk:', xmlContent.length)

    // XML dosya adını oluştur: belgeno_YYYYMMDD.xml
    const dateStr = (packageData.documentDate || '').replace(/-/g, '') // 2025-12-17 -> 20251217
    const xmlFileName = `${packageData.documentNumber || 'notification'}_${dateStr}.xml`
    log('📄 XML Dosya Adı:', xmlFileName)

    // XML'i ZIP'e çevir ve base64 yap
    const zip = new AdmZip()
    zip.addFile(xmlFileName, Buffer.from(xmlContent, 'utf-8'))
    const zipBuffer = zip.toBuffer()
    const base64Content = zipBuffer.toString('base64')

    log('📦 ZIP oluşturuldu, base64 uzunluk:', base64Content.length)

    // receiverGLN: Kendi GLN'imize göndermek için override edilebilir
    //const receiverGLN = packageData.receiverGLN || packageData.destinationGLN
    const receiverGLN = packageData.destinationGLN

    const response = await axios.post(
      `${PTS_CONFIG.baseUrl}${PTS_CONFIG.sendPackageUrl}`,
      {
        receiver: receiverGLN,
        file: base64Content
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      }
    )

    log('✅ PTS Bildirimi yanıtı:', response.data)

    // Response'dan transfer ID'yi al
    const transferId = response.data?.transferId || response.data?.TransferId || null

    if (!transferId) {
      return {
        success: false,
        message: response.data?.message || 'Transfer ID alınamadı'
      }
    }

    return {
      success: true,
      transferId,
      message: `Bildirim başarılı. Transfer ID: ${transferId}`
    }

  } catch (error) {
    console.error('❌ PTS Bildirimi hatası:', error.message)
    if (error.response) {
      console.error('Response status:', error.response.status)
      console.error('Response data:', error.response.data)
    }
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'PTS bildirimi gönderilemedi'
    }
  }
}

/**
 * PTS Bildirimi için XML oluştur
 * @param {Object} packageData - Paket bilgileri
 * @returns {string} - XML string
 */
function generatePTSNotificationXML(packageData) {
  const { documentNumber, documentDate, sourceGLN, destinationGLN, products } = packageData

  // Ürünleri carrier'lara göre grupla
  const carrierGroups = {}
  products.forEach(p => {
    const carrier = p.carrierLabel || 'NO_CARRIER'
    if (!carrierGroups[carrier]) {
      carrierGroups[carrier] = []
    }
    carrierGroups[carrier].push(p)
  })

  // XML oluştur
  let carriersXml = ''
  for (const [carrierLabel, prods] of Object.entries(carrierGroups)) {
    let productListXml = ''
    prods.forEach(p => {
      if (p.seriNo) {
        productListXml += `
        <productList GTIN="${p.gtin || ''}" expirationDate="${p.miad || ''}" lotNumber="${p.lot || ''}">
          <serialNumber>${p.seriNo}</serialNumber>
        </productList>`
      }
    })

    if (carrierLabel !== 'NO_CARRIER') {
      carriersXml += `
    <carrier carrierLabel="${carrierLabel}" containerType="CASE">
      ${productListXml}
    </carrier>`
    } else {
      carriersXml += productListXml
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<transfer>
  <documentNumber>${documentNumber || ''}</documentNumber>
  <documentDate>${documentDate || ''}</documentDate>
  <sourceGLN>${sourceGLN || PTS_CONFIG.glnNo}</sourceGLN>
  <destinationGLN>${destinationGLN || ''}</destinationGLN>
  <actionType>SALE</actionType>
  ${carriersXml}
</transfer>`

  return xml
}

export {
  getAccessToken,
  searchPackages,
  downloadPackage,
  queryPackage,
  sendPackage,
  loadPTSConfig,
  PTS_CONFIG
}

