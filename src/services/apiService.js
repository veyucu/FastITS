import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Axios instance oluştur
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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
  }
}

export default apiService



