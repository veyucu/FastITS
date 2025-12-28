import axios from 'axios'
import { log } from '../utils/debug'

// Dinamik API URL - Frontend hangi IP/hostname'den açılırsa ona bağlanır
const getApiBaseUrl = () => {
  // Önce environment variable'ı kontrol et
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // Yoksa mevcut hostname'i kullan (aynı sunucuda backend varsayımı)
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  return `${protocol}//${hostname}:5000/api`
}

const API_BASE_URL = getApiBaseUrl()

// Axios instance oluştur
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 saniye - büyük veri setleri için artırıldı
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - Token ekleme vb.
apiClient.interceptors.request.use(
  (config) => {
    const user = localStorage.getItem('user')
    if (user) {
      try {
        const userData = JSON.parse(user)
        if (userData.token) {
          config.headers.Authorization = `Bearer ${userData.token}`
        }
      } catch (error) {
        console.error('Token parse error:', error)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - Hata yönetimi
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - Logout
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// API Service
const apiService = {
  // Health check
  healthCheck: async () => {
    try {
      const response = await apiClient.get('/health')
      return { success: true, data: response.data }
    } catch (error) {
      throw new Error(error.message || 'Sunucu sağlık kontrolü başarısız')
    }
  },

  // Login - Kullanıcı girişi
  login: async (username, password) => {
    try {
      const response = await apiClient.post('/auth/login', { username, password })
      return response.data
    } catch (error) {
      console.error('Login error:', error)
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Giriş başarısız'
      }
    }
  },

  // Kullanıcı Listesi
  getUsers: async () => {
    try {
      const response = await apiClient.get('/auth/users')
      return response.data
    } catch (error) {
      console.error('Get users error:', error)
      return { success: false, error: error.message }
    }
  },

  // Kullanıcı Ekle
  createUser: async (userData) => {
    try {
      const response = await apiClient.post('/auth/users', userData)
      return response.data
    } catch (error) {
      console.error('Create user error:', error)
      return { success: false, error: error.response?.data?.error || error.message }
    }
  },

  // Kullanıcı Güncelle
  updateUser: async (id, userData) => {
    try {
      const response = await apiClient.put(`/auth/users/${id}`, userData)
      return response.data
    } catch (error) {
      console.error('Update user error:', error)
      return { success: false, error: error.response?.data?.error || error.message }
    }
  },

  // Kullanıcı Sil
  deleteUser: async (id) => {
    try {
      const response = await apiClient.delete(`/auth/users/${id}`)
      return response.data
    } catch (error) {
      console.error('Delete user error:', error)
      return { success: false, error: error.response?.data?.error || error.message }
    }
  },

  // Şifre Değiştir
  changeUserPassword: async (id, password) => {
    try {
      const response = await apiClient.put(`/auth/users/${id}/password`, { password })
      return response.data
    } catch (error) {
      console.error('Change password error:', error)
      return { success: false, error: error.response?.data?.error || error.message }
    }
  },

  // Get all documents (tarih zorunlu)
  getDocuments: async (date) => {
    try {
      if (!date) {
        throw new Error('Tarih parametresi zorunludur')
      }

      const response = await apiClient.get(`/documents?date=${date}`)
      // Backend { success: true, documents: [...] } formatında dönüyor
      return {
        success: true,
        data: response.data.documents || []
      }
    } catch (error) {
      console.error('Get documents error:', error)
      return {
        success: false,
        message: error.message || 'Dökümanlar alınamadı',
        data: []
      }
    }
  },

  // Get document by ID
  getDocumentById: async (id) => {
    try {
      log('🔍 API İsteği - Belge ID:', id)
      log('🌐 API URL:', `${API_BASE_URL}/documents/${id}`)
      const response = await apiClient.get(`/documents/${id}`)
      log('✅ API Yanıtı:', response.data)
      // Backend zaten { success: true, data: document } formatında dönüyor
      // Tekrar wrap etmeye gerek yok
      return response.data
    } catch (error) {
      console.error('❌ Get document error:', error)
      console.error('❌ Error response:', error.response?.data)
      return {
        success: false,
        message: error.message || 'Döküman alınamadı'
      }
    }
  },

  // Update document status
  updateDocumentStatus: async (id, status) => {
    try {
      const response = await apiClient.patch(`/documents/${id}/status`, { status })
      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      console.error('Update status error:', error)
      return {
        success: false,
        message: error.message || 'Durum güncellenemedi'
      }
    }
  },

  // Update item prepared status
  updateItemPreparedStatus: async (documentId, itemId, isPrepared) => {
    try {
      const response = await apiClient.patch(
        `/documents/${documentId}/items/${itemId}`,
        { isPrepared }
      )
      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      console.error('Update item error:', error)
      return {
        success: false,
        message: error.message || 'Ürün durumu güncellenemedi'
      }
    }
  },

  // Search products by barcode
  searchProductByBarcode: async (barcode) => {
    try {
      const response = await apiClient.get(`/products/search?barcode=${barcode}`)
      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      console.error('Search product error:', error)
      return {
        success: false,
        message: error.message || 'Ürün bulunamadı'
      }
    }
  },

  // ITS Karekod Okut ve Kaydet
  saveITSBarcode: async (data) => {
    try {
      log('📱 ITS Karekod gönderiliyor:', data)
      const response = await apiClient.post('/documents/its-barcode', data)
      log('✅ ITS Karekod yanıtı:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ ITS Karekod hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'ITS karekod kaydedilemedi'
      }
    }
  },

  // ITS Kayıtlarını Getir
  getITSBarcodeRecords: async (documentId, itemId) => {
    try {
      const response = await apiClient.get(`/documents/${documentId}/item/${itemId}/its-records`)
      return response.data
    } catch (error) {
      console.error('❌ ITS Kayıtları hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'ITS kayıtları alınamadı',
        data: []
      }
    }
  },

  // ITS Kayıtlarını Sil
  deleteITSBarcodeRecords: async (documentId, itemId, seriNos, turu = 'ITS') => {
    try {
      const response = await apiClient.delete(`/documents/${documentId}/item/${itemId}/its-records`, {
        data: { seriNos, turu }
      })
      return response.data
    } catch (error) {
      console.error('❌ ITS Kayıt Silme hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'ITS kayıtları silinemedi'
      }
    }
  },

  // DGR Barkod Okut ve Kaydet (ITS olmayan normal ürünler)
  saveDGRBarcode: async (data) => {
    try {
      log('📦 DGR Barkod gönderiliyor:', data)
      const response = await apiClient.post('/documents/dgr-barcode', data)
      log('✅ DGR Barkod yanıtı:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ DGR Barkod hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'DGR barkod kaydedilemedi'
      }
    }
  },

  // Koli Barkodu Kaydet (ITS için)
  saveCarrierBarcode: async (data) => {
    try {
      log('📦 Koli Barkodu gönderiliyor:', data)
      const response = await apiClient.post('/documents/carrier-barcode', data)
      log('✅ Koli Barkodu yanıtı:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ Koli Barkodu hatası:', error)
      throw error
    }
  },

  // Koli Barkodu Sil (ITS için)
  deleteCarrierBarcode: async (data) => {
    try {
      log('🗑️ Koli Barkodu siliniyor:', data)
      const response = await apiClient.delete('/documents/carrier-barcode', { data })
      log('✅ Koli Barkodu silindi:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ Koli Barkodu silme hatası:', error)
      throw error
    }
  },

  // UTS Barkod Okut ve Kaydet
  saveUTSBarcode: async (data) => {
    try {
      log('🔴 UTS Barkod gönderiliyor:', data)
      const response = await apiClient.post('/documents/uts-barcode', data)
      log('✅ UTS Barkod yanıtı:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ UTS Barkod hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'UTS barkod kaydedilemedi'
      }
    }
  },

  // UTS Kayıtlarını Getir
  getUTSBarcodeRecords: async (documentId, itemId) => {
    try {
      const response = await apiClient.get(`/documents/${documentId}/item/${itemId}/uts-records`)
      return response.data
    } catch (error) {
      console.error('❌ UTS Kayıtları hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'UTS kayıtları alınamadı',
        data: []
      }
    }
  },

  // UTS Kayıtlarını Sil
  deleteUTSBarcodeRecords: async (documentId, itemId, records) => {
    try {
      const response = await apiClient.delete(`/documents/${documentId}/item/${itemId}/uts-records`, {
        data: { records }
      })
      return response.data
    } catch (error) {
      console.error('❌ UTS Kayıt Silme hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'UTS kayıtları silinemedi'
      }
    }
  },

  // UTS Kayıtlarını Toplu Kaydet/Güncelle/Sil
  saveUTSRecords: async (data) => {
    try {
      log('💾 UTS Toplu Kayıt gönderiliyor:', data)
      const response = await apiClient.post('/documents/uts-records/bulk-save', data)
      log('✅ UTS Toplu Kayıt yanıtı:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ UTS Toplu Kayıt hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'UTS kayıtları kaydedilemedi'
      }
    }
  },

  // ==================== PTS İşlemleri ====================

  // Tarih aralığında paket listesi sorgula
  searchPackages: async (startDate, endDate, settings = null) => {
    try {
      log('🔍 PTS\'den paket listesi sorgulanıyor:', startDate, endDate)
      const response = await apiClient.post('/pts/search', { startDate, endDate, settings })
      log('✅ PTS yanıtı:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ PTS arama hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Paket listesi alınamadı'
      }
    }
  },

  // Tarih aralığındaki paketleri toplu indir ve veritabanına kaydet
  // SSE ile real-time progress
  downloadBulkPackagesStream: async (startDate, endDate, onProgress, settings = null, kullanici = null) => {
    return new Promise((resolve, reject) => {
      try {
        const url = `${API_BASE_URL}/pts/download-bulk-stream`

        log('📥 SSE Toplu paket indirme başlıyor:', startDate, endDate)

        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ startDate, endDate, settings, kullanici })
        }).then(response => {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          const readStream = () => {
            reader.read().then(({ done, value }) => {
              if (done) {
                log('✅ SSE stream tamamlandı')
                resolve({ success: true })
                return
              }

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6))
                    log('📊 SSE Progress:', data)
                    onProgress(data)

                    if (data.status === 'completed') {
                      log('✅ İndirme tamamlandı:', data)
                      resolve({ success: true, data })
                      return
                    } else if (data.status === 'error') {
                      console.error('❌ İndirme hatası:', data)
                      reject(new Error(data.message))
                      return
                    }
                  } catch (e) {
                    console.error('SSE parse error:', e, line)
                  }
                }
              }

              readStream()
            }).catch(error => {
              console.error('Stream read error:', error)
              reject(error)
            })
          }

          readStream()
        }).catch(error => {
          console.error('Fetch error:', error)
          reject(error)
        })

      } catch (error) {
        console.error('Download stream error:', error)
        reject(error)
      }
    })
  },

  // Transfer ID ile paket sorgula
  queryPackage: async (transferId, settings = null) => {
    try {
      const body = settings ? { settings } : {}
      const response = await apiClient.post(`/pts/query/${transferId}`, body)
      return response.data
    } catch (error) {
      console.error('❌ PTS sorgulama hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Paket sorgulanamadı'
      }
    }
  },

  // Toplu paket indirme (tarih aralığı)
  downloadBulkPackages: async (startDate, endDate, settings = null) => {
    try {
      log('📥 Toplu paket indirme başlıyor:', startDate, endDate)
      const response = await apiClient.post('/pts/download-bulk', { startDate, endDate, settings })
      log('✅ Toplu indirme tamamlandı:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ Toplu indirme hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Toplu indirme başarısız'
      }
    }
  },

  // Transfer ID ile paket indir
  downloadPackage: async (transferId) => {
    try {
      log('📥 Paket indiriliyor:', transferId)
      const response = await apiClient.post('/pts/download', { transferId })
      log('✅ Paket indirildi:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ Paket indirme hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Paket indirilemedi'
      }
    }
  },

  // PTS Konfigürasyon
  getPTSConfig: async () => {
    try {
      const response = await apiClient.get('/pts/config')
      return response.data
    } catch (error) {
      console.error('❌ PTS config hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'PTS konfigürasyonu alınamadı'
      }
    }
  },

  // Veritabanından Transfer ID ile paket getir
  getPackageFromDB: async (transferId) => {
    try {
      const response = await apiClient.get(`/pts/database/${transferId}`)
      return response.data
    } catch (error) {
      console.error('❌ DB paket getirme hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Paket getirilemedi'
      }
    }
  },

  // PTS Durum Sorgula (verify endpoint)
  ptsSorgula: async (transferId, products, settings = null) => {
    try {
      log('🔍 PTS Durum Sorgulama gönderiliyor:', { transferId, productCount: products?.length })
      const response = await apiClient.post(`/pts/${transferId}/sorgula`, {
        products,
        settings
      })
      return response.data
    } catch (error) {
      console.error('❌ PTS Durum Sorgulama hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Sorgulama başarısız'
      }
    }
  },

  // Veritabanından paket listesi getir (tarih filtreli)
  getPackagesFromDB: async (startDate, endDate, dateFilterType = 'created', settings = null) => {
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (dateFilterType) params.append('dateFilterType', dateFilterType)

      // Ayarlardan kolon adlarını ekle
      if (settings?.itsSettings?.cariGlnColumn) {
        params.append('cariGlnColumn', settings.itsSettings.cariGlnColumn)
      }
      if (settings?.itsSettings?.stockBarcodeColumn) {
        params.append('stockBarcodeColumn', settings.itsSettings.stockBarcodeColumn)
      }

      log('📋 API isteği:', { startDate, endDate, dateFilterType, cariGlnColumn: settings?.itsSettings?.cariGlnColumn })

      const response = await apiClient.get(`/pts/database/list?${params.toString()}`)
      return response.data
    } catch (error) {
      console.error('❌ DB paket listesi hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Paket listesi alınamadı',
        data: []
      }
    }
  },

  // Carrier label (koli barkodu) ile ürünleri getir
  getProductsByCarrier: async (carrierLabel) => {
    try {
      log('📦 Carrier ürünleri getiriliyor:', carrierLabel)
      const response = await apiClient.get(`/pts/carrier/${carrierLabel}`)
      return response.data
    } catch (error) {
      console.error('❌ Carrier ürün getirme hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Carrier ürünleri alınamadı'
      }
    }
  },

  // Transfer ID ve carrier label ile detaylı bilgi getir
  getCarrierDetails: async (transferId, carrierLabel) => {
    try {
      const response = await apiClient.get(`/pts/carrier-details/${transferId}/${carrierLabel}`)
      return response.data
    } catch (error) {
      console.error('❌ Carrier detay getirme hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Carrier detayları alınamadı'
      }
    }
  },

  // Tüm PTS transferlerini getir
  getPTSTransfers: async () => {
    try {
      const response = await apiClient.get('/pts/transfers')
      return response.data
    } catch (error) {
      console.error('❌ PTS transfer listesi getirme hatası:', error)
      throw error
    }
  },

  // PTS paketlerini listele (tarih aralığı ve filtre tipi ile)
  listPTSPackages: async (startDate, endDate, dateFilterType = 'created') => {
    try {
      log('📋 PTS paketleri listeleniyor:', { startDate, endDate, dateFilterType })
      const response = await apiClient.post('/pts/list', {
        startDate,
        endDate,
        dateFilterType
      })
      log('✅ PTS listesi alındı:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ PTS liste hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Liste alınamadı'
      }
    }
  },

  // Settings API
  getSettings: async () => {
    try {
      const response = await apiClient.get('/settings')
      return response.data
    } catch (error) {
      console.error('Get settings error:', error)
      return {
        success: false,
        message: error.message || 'Ayarlar alınamadı'
      }
    }
  },

  saveSettings: async (settings) => {
    try {
      const response = await apiClient.post('/settings', settings)
      return response.data
    } catch (error) {
      console.error('Save settings error:', error)
      throw error
    }
  },

  // PTS Bildirimi Gönder
  sendPTSNotification: async (documentId, kullanici, settings = null) => {
    try {
      log('📤 PTS Bildirimi gönderiliyor:', { documentId, kullanici })
      const response = await apiClient.post(`/documents/${documentId}/pts-notification`, {
        kullanici,
        settings
      })
      log('✅ PTS Bildirimi yanıtı:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ PTS Bildirimi hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'PTS bildirimi gönderilemedi'
      }
    }
  },

  // PTS XML Önizleme (web servise göndermeden)
  previewPTSNotification: async (documentId, kullanici, note = '', settings = null) => {
    try {
      log('📝 PTS XML Önizleme isteniyor:', { documentId, kullanici, note })
      const response = await apiClient.post(`/documents/${documentId}/pts-preview`, {
        kullanici,
        note,
        settings
      })
      log('✅ PTS XML Önizleme yanıtı:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ PTS XML Önizleme hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'XML oluşturulamadı'
      }
    }
  },

  // Belgedeki Tüm ITS Kayıtlarını Getir
  getAllITSRecordsForDocument: async (documentId, cariKodu) => {
    try {
      log('📋 Belgedeki tüm ITS kayıtları getiriliyor:', documentId, cariKodu)
      const response = await apiClient.get(`/documents/${documentId}/its-all-records?cariKodu=${encodeURIComponent(cariKodu)}`)
      return response.data
    } catch (error) {
      console.error('❌ ITS kayıtları getirme hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'ITS kayıtları alınamadı',
        data: []
      }
    }
  },

  // ==================== ITS BİLDİRİM İŞLEMLERİ ====================

  // ITS Satış Bildirimi
  itsSatisBildirimi: async (documentId, karsiGlnNo, products, settings = null, belgeInfo = null) => {
    try {
      log('📤 ITS Satış Bildirimi gönderiliyor:', { documentId, productCount: products?.length })
      const response = await apiClient.post(`/documents/${documentId}/its-satis-bildirimi`, {
        karsiGlnNo,
        products,
        settings,
        belgeInfo
      })
      return response.data
    } catch (error) {
      console.error('❌ ITS Satış Bildirimi hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Satış bildirimi gönderilemedi'
      }
    }
  },

  // ITS Satış İptal Bildirimi
  itsSatisIptalBildirimi: async (documentId, karsiGlnNo, products, settings = null, belgeInfo = null) => {
    try {
      log('🔴 ITS Satış İptal gönderiliyor:', { documentId, productCount: products?.length })
      const response = await apiClient.post(`/documents/${documentId}/its-satis-iptal`, {
        karsiGlnNo,
        products,
        settings,
        belgeInfo
      })
      return response.data
    } catch (error) {
      console.error('❌ ITS Satış İptal hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Satış iptal bildirimi gönderilemedi'
      }
    }
  },

  // ITS Doğrulama
  itsDogrulama: async (documentId, products, settings = null) => {
    try {
      log('🔍 ITS Doğrulama gönderiliyor:', { documentId, productCount: products?.length })
      const response = await apiClient.post(`/documents/${documentId}/its-dogrulama`, {
        products,
        settings
      })
      return response.data
    } catch (error) {
      console.error('❌ ITS Doğrulama hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Doğrulama başarısız'
      }
    }
  },

  // ITS Başarısız Ürünleri Sorgula
  itsBasarisizSorgula: async (documentId, products, settings = null) => {
    try {
      log('❓ ITS Başarısız Sorgulama gönderiliyor:', { documentId, productCount: products?.length })
      const response = await apiClient.post(`/documents/${documentId}/its-basarisiz-sorgula`, {
        products,
        settings
      })
      return response.data
    } catch (error) {
      console.error('❌ ITS Başarısız Sorgulama hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Sorgulama başarısız'
      }
    }
  },

  // ITS Durum Sorgula (check_status endpoint)
  itsSorgula: async (documentId, products, settings = null) => {
    try {
      log('🔍 ITS Durum Sorgulama gönderiliyor:', { documentId, productCount: products?.length })
      const response = await apiClient.post(`/documents/${documentId}/its-sorgula`, {
        products,
        settings
      })
      return response.data
    } catch (error) {
      console.error('❌ ITS Durum Sorgulama hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Sorgulama başarısız'
      }
    }
  },

  // ITS Alış Bildirimi (Mal Alım) - sadece productList gönderilir
  itsAlisBildirimi: async (documentId, products, settings = null, belgeInfo = null) => {
    try {
      log('📥 ITS Alış Bildirimi gönderiliyor:', { documentId, productCount: products?.length })
      const response = await apiClient.post(`/documents/${documentId}/its-alis-bildirimi`, {
        products,
        settings,
        belgeInfo
      })
      return response.data
    } catch (error) {
      console.error('❌ ITS Alış Bildirimi hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Alış bildirimi gönderilemedi'
      }
    }
  },

  // ITS İade Alış Bildirimi (Mal İade) - karsiGlnNo gerekli (togln)
  itsIadeAlisBildirimi: async (documentId, karsiGlnNo, products, settings = null, belgeInfo = null) => {
    try {
      log('🔴 ITS İade Alış Bildirimi gönderiliyor:', { documentId, karsiGlnNo, productCount: products?.length })
      const response = await apiClient.post(`/documents/${documentId}/its-iade-alis`, {
        karsiGlnNo,
        products,
        settings,
        belgeInfo
      })
      return response.data
    } catch (error) {
      console.error('❌ ITS İade Alış Bildirimi hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'İade alış bildirimi gönderilemedi'
      }
    }
  },

  // ==================== UTS BİLDİRİM İŞLEMLERİ ====================

  // Belgedeki Tüm UTS Kayıtlarını Getir
  getAllUTSRecordsForDocument: async (documentId, cariKodu) => {
    try {
      log('📋 Belgedeki tüm UTS kayıtları getiriliyor:', documentId, cariKodu)
      const response = await apiClient.get(`/documents/${documentId}/uts-all-records?cariKodu=${encodeURIComponent(cariKodu)}`)
      return response.data
    } catch (error) {
      console.error('❌ UTS kayıtları getirme hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'UTS kayıtları alınamadı',
        data: []
      }
    }
  },

  // UTS Verme Bildirimi
  utsVermeBildirimi: async (documentId, products, settings = null) => {
    try {
      log('📤 UTS Verme Bildirimi gönderiliyor:', { documentId, productCount: products?.length })
      const response = await apiClient.post(`/documents/${documentId}/uts-verme-bildirimi`, {
        products,
        settings
      })
      return response.data
    } catch (error) {
      console.error('❌ UTS Verme Bildirimi hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'UTS verme bildirimi gönderilemedi'
      }
    }
  },

  // UTS Verme İptal Bildirimi
  utsVermeIptalBildirimi: async (documentId, products, settings = null) => {
    try {
      log('🔴 UTS Verme İptal gönderiliyor:', { documentId, productCount: products?.length })
      const response = await apiClient.post(`/documents/${documentId}/uts-verme-iptal`, {
        products,
        settings
      })
      return response.data
    } catch (error) {
      console.error('❌ UTS Verme İptal hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'UTS verme iptal bildirimi gönderilemedi'
      }
    }
  },

  // ==================== MESAJ KODLARI ====================

  // Tüm mesaj kodlarını getir
  getMesajKodlari: async () => {
    try {
      log('📋 Mesaj kodları getiriliyor...')
      const response = await apiClient.get('/its/mesaj-kodlari')
      return response.data
    } catch (error) {
      console.error('❌ Mesaj kodları getirme hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Mesaj kodları alınamadı',
        data: []
      }
    }
  },

  // ITS'den mesaj kodlarını güncelle
  guncellemMesajKodlari: async (settings = null) => {
    try {
      log('🔄 Mesaj kodları güncelleniyor...')
      const response = await apiClient.post('/its/mesaj-kodlari/guncelle', { settings })
      return response.data
    } catch (error) {
      console.error('❌ Mesaj kodları güncelleme hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Mesaj kodları güncellenemedi'
      }
    }
  },

  // ==================== PTS BİLDİRİM İŞLEMLERİ ====================

  // PTS Alım Bildirimi (Mal Alım) - /common/app/accept
  ptsAlimBildirimi: async (transferId, products, settings = null, kullanici = null) => {
    try {
      log('📥 PTS Alım Bildirimi gönderiliyor:', { transferId, productCount: products?.length })
      const response = await apiClient.post(`/pts/${transferId}/alim-bildirimi`, {
        products,
        settings,
        kullanici
      })
      return response.data
    } catch (error) {
      console.error('❌ PTS Alım Bildirimi hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Alım bildirimi gönderilemedi'
      }
    }
  },

  // PTS Alım İade Bildirimi (Mal İade) - /common/app/return
  ptsAlimIadeBildirimi: async (transferId, karsiGlnNo, products, settings = null, kullanici = null) => {
    try {
      log('🔴 PTS Alım İade Bildirimi gönderiliyor:', { transferId, karsiGlnNo, productCount: products?.length })
      const response = await apiClient.post(`/pts/${transferId}/alim-iade-bildirimi`, {
        karsiGlnNo,
        products,
        settings,
        kullanici
      })
      return response.data
    } catch (error) {
      console.error('❌ PTS Alım İade Bildirimi hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Alım iade bildirimi gönderilemedi'
      }
    }
  },

  // PTS Doğrulama - Sadece sorgulama yapar, veritabanına yazmaz
  ptsDogrulama: async (transferId, products, settings = null) => {
    try {
      log('🔍 PTS Doğrulama gönderiliyor:', { transferId, productCount: products?.length })
      const response = await apiClient.post(`/pts/${transferId}/dogrulama`, {
        products,
        settings
      })
      return response.data
    } catch (error) {
      console.error('❌ PTS Doğrulama hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Doğrulama yapılamadı'
      }
    }
  }
}

export default apiService
