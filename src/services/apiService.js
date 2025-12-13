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
      return { 
        success: true, 
        data: response.data.documents || response.data 
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
      const response = await apiClient.get(`/documents/${id}`)
      return { 
        success: true, 
        data: response.data 
      }
    } catch (error) {
      console.error('Get document error:', error)
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
  }
}

export default apiService



