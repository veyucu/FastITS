import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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
      console.log('🔍 API İsteği - Belge ID:', id)
      console.log('🌐 API URL:', `${API_BASE_URL}/documents/${id}`)
      const response = await apiClient.get(`/documents/${id}`)
      console.log('✅ API Yanıtı:', response.data)
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
      console.log('📱 ITS Karekod gönderiliyor:', data)
      const response = await apiClient.post('/documents/its-barcode', data)
      console.log('✅ ITS Karekod yanıtı:', response.data)
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
  deleteITSBarcodeRecords: async (documentId, itemId, seriNos) => {
    try {
      const response = await apiClient.delete(`/documents/${documentId}/item/${itemId}/its-records`, {
        data: { seriNos }
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
      console.log('📦 DGR Barkod gönderiliyor:', data)
      const response = await apiClient.post('/documents/dgr-barcode', data)
      console.log('✅ DGR Barkod yanıtı:', response.data)
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
      console.log('📦 Koli Barkodu gönderiliyor:', data)
      const response = await apiClient.post('/documents/carrier-barcode', data)
      console.log('✅ Koli Barkodu yanıtı:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ Koli Barkodu hatası:', error)
      throw error
    }
  },

  // Koli Barkodu Sil (ITS için)
  deleteCarrierBarcode: async (data) => {
    try {
      console.log('🗑️ Koli Barkodu siliniyor:', data)
      const response = await apiClient.delete('/documents/carrier-barcode', { data })
      console.log('✅ Koli Barkodu silindi:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ Koli Barkodu silme hatası:', error)
      throw error
    }
  },

  // UTS Barkod Okut ve Kaydet
  saveUTSBarcode: async (data) => {
    try {
      console.log('🔴 UTS Barkod gönderiliyor:', data)
      const response = await apiClient.post('/documents/uts-barcode', data)
      console.log('✅ UTS Barkod yanıtı:', response.data)
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
      console.log('💾 UTS Toplu Kayıt gönderiliyor:', data)
      const response = await apiClient.post('/documents/uts-records/bulk-save', data)
      console.log('✅ UTS Toplu Kayıt yanıtı:', response.data)
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
      console.log('🔍 PTS\'den paket listesi sorgulanıyor:', startDate, endDate)
      const response = await apiClient.post('/pts/search', { startDate, endDate, settings })
      console.log('✅ PTS yanıtı:', response.data)
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
  downloadBulkPackagesStream: async (startDate, endDate, onProgress, settings = null) => {
    return new Promise((resolve, reject) => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
        const url = `${API_URL}/pts/download-bulk-stream`
        
        console.log('📥 SSE Toplu paket indirme başlıyor:', startDate, endDate)

        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ startDate, endDate, settings })
        }).then(response => {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          const readStream = () => {
            reader.read().then(({ done, value }) => {
              if (done) {
                console.log('✅ SSE stream tamamlandı')
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
                    console.log('📊 SSE Progress:', data)
                    onProgress(data)
                    
                    if (data.status === 'completed') {
                      console.log('✅ İndirme tamamlandı:', data)
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

  downloadBulkPackages: async (startDate, endDate, settings = null) => {
    try {
      console.log('📥 Toplu paket indirme başlıyor:', startDate, endDate)
      const response = await apiClient.post('/pts/download-bulk-old', { startDate, endDate, settings })
      console.log('✅ Toplu indirme tamamlandı:', response.data)
      return response.data
    } catch (error) {
      console.error('❌ Toplu indirme hatası:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Paketler indirilemedi'
      }
    }
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
      console.log('📥 Toplu paket indirme başlıyor:', startDate, endDate)
      const response = await apiClient.post('/pts/download-bulk', { startDate, endDate, settings })
      console.log('✅ Toplu indirme tamamlandı:', response.data)
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
      console.log('📥 Paket indiriliyor:', transferId)
      const response = await apiClient.post('/pts/download', { transferId })
      console.log('✅ Paket indirildi:', response.data)
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
      
      console.log('📋 API isteği:', { startDate, endDate, dateFilterType, cariGlnColumn: settings?.itsSettings?.cariGlnColumn })
      
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
      console.log('📦 Carrier ürünleri getiriliyor:', carrierLabel)
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
      console.log('📋 PTS paketleri listeleniyor:', { startDate, endDate, dateFilterType })
      const response = await apiClient.post('/pts/list', { 
        startDate, 
        endDate, 
        dateFilterType 
      })
      console.log('✅ PTS listesi alındı:', response.data)
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
  }
}

export default apiService



