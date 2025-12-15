import axios from 'axios'
import AdmZip from 'adm-zip'
import xml2js from 'xml2js'

// PTS Web Servis Entegrasyonu - Gerçek API aktif
// PTS Web Servis Bilgileri
const PTS_CONFIG = {
  username: '86800010845240000',
  password: '1981aa',
  glnNo: '8680001084524',
  // ITS REST API Base URL (NetProITS BildirimHelper.ItsHost)
  // Üretim: https://its2.saglik.gov.tr
  baseUrl: process.env.PTS_BASE_URL || 'https://its2.saglik.gov.tr',
  tokenUrl: '/token/app/token',
  searchUrl: '/pts/app/search',
  getPackageUrl: '/pts/app/GetPackage',
  // Simülasyon modu (geliştirme için)
  simulationMode: false // Gerçek API'yi kullan
}


/**
 * PTS Token Alma
 * @returns {Promise<string|null>}
 */
async function getAccessToken() {
  // Simülasyon modu
  if (PTS_CONFIG.simulationMode) {
    console.log('🎭 Simülasyon modunda - Mock token dönülüyor')
    return 'MOCK_TOKEN_FOR_SIMULATION'
  }

  try {
    console.log('🔑 Token alınıyor...')
    console.log('URL:', `${PTS_CONFIG.baseUrl}${PTS_CONFIG.tokenUrl}`)
    console.log('Username:', PTS_CONFIG.username)
    
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

    console.log('✅ Token alındı:', response.data)
    
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
 * @returns {Promise<Object>}
 */
async function searchPackages(startDate, endDate) {
  // Simülasyon modu
  if (PTS_CONFIG.simulationMode) {
    console.log('🎭 Simülasyon modunda - Mock paket listesi dönülüyor')
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
 * @returns {Promise<Object>}
 */
async function downloadPackage(transferId) {
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

    console.log('📦 API Response:', JSON.stringify(response.data).substring(0, 200))
    
    const base64Data = response.data?.fileStream
    if (!base64Data) {
      console.log('❌ fileStream bulunamadı. Response keys:', Object.keys(response.data || {}))
      return {
        success: false,
        message: 'Paket verisi alınamadı'
      }
    }
    
    console.log('✅ Base64 data alındı, uzunluk:', base64Data.length)

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
    
    console.log('📄 XML İçeriği (ilk 1500 karakter):', xmlContent.substring(0, 1500))
    console.log('📄 XML Tam Uzunluk:', xmlContent.length)
    
    // XML'i parse et
    const parser = new xml2js.Parser()
    const xmlData = await parser.parseStringPromise(xmlContent)

    console.log('🔍 XML Root Keys:', Object.keys(xmlData))

    // XML'den bilgileri çıkar  
    const root = xmlData.package || xmlData.shipmentNotification || xmlData
    console.log('📦 Root Keys:', Object.keys(root))
    const packageInfo = {
      transferId,
      documentNumber: root.documentNumber?.[0] || '',
      documentDate: root.documentDate?.[0] || '',
      sourceGLN: root.sourceGLN?.[0] || '',
      destinationGLN: root.destinationGLN?.[0] || '',
      products: []
    }

    // Carrier ve productList'i parse et
    if (root.carrier) {
      for (const carrier of root.carrier) {
        const carrierLabel = carrier.$.carrierLabel || ''
        
        if (carrier.productList) {
          for (const product of carrier.productList) {
            const gtin = product.$.GTIN || ''
            const expirationDate = product.$.expirationDate || product.$.ExpirationDate || ''
            const lotNumber = product.$.lotNumber || product.$.LotNumber || ''
            
            // Her serial number için ürün ekle
            const serialNumbers = product._ ? [product._] : (Array.isArray(product) ? product : [])
            
            for (const sn of serialNumbers) {
              packageInfo.products.push({
                carrierLabel,
                gtin,
                expirationDate,
                lotNumber,
                serialNumber: sn
              })
            }
          }
        }
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

    return {
      success: true,
      data: {
        ...packageInfo,
        _rawXML: xmlContent // XML içeriğini de gönder
      },
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
 * @returns {Promise<Object>}
 */
async function queryPackage(transferId) {
  try {
    console.log(`🔍 Paket sorgulanıyor: ${transferId}`)
    
    // Paketi indir ve detaylarını döndür
    return await downloadPackage(transferId)

  } catch (error) {
    console.error('❌ Paket sorgulama hatası:', error)
    
    return {
      success: false,
      message: 'Paket sorgulanamadı',
      error: error.message
    }
  }
}

export {
  getAccessToken,
  searchPackages,
  downloadPackage,
  queryPackage,
  PTS_CONFIG
}

