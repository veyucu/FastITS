import { useState, useCallback } from 'react'
import apiService from '../services/apiService'

/**
 * Belge yönetimi için custom hook
 * @param {string} documentId - Belge ID
 * @returns {Object} - Belge state ve fonksiyonları
 */
export const useDocument = (documentId) => {
  const [document, setDocument] = useState(null)
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({ total: 0, prepared: 0, remaining: 0 })
  const [loading, setLoading] = useState(true)

  // İstatistikleri güncelle
  const updateStats = useCallback((currentItems) => {
    const total = currentItems.length
    const prepared = currentItems.filter(item => item.isPrepared).length
    const remaining = total - prepared
    setStats({ total, prepared, remaining })
  }, [])

  // Belgeyi yükle
  const fetchDocument = useCallback(async () => {
    try {
      setLoading(true)
      const response = await apiService.getDocumentById(documentId)
      
      if (response.success && response.data) {
        const doc = response.data
        setDocument(doc)
        setItems(doc.items || [])
        updateStats(doc.items || [])
        return { success: true, data: doc }
      } else {
        return { success: false, message: 'Belge yüklenemedi' }
      }
    } catch (error) {
      console.error('Belge yükleme hatası:', error)
      return { success: false, message: error.message }
    } finally {
      setLoading(false)
    }
  }, [documentId, updateStats])

  // Belgeyi yenile (grid güncellemesi için)
  const refreshDocument = useCallback(async () => {
    try {
      const response = await apiService.getDocumentById(documentId)
      if (response.success && response.data) {
        setItems(response.data.items || [])
        updateStats(response.data.items || [])
        return { success: true, data: response.data }
      }
      return { success: false }
    } catch (error) {
      console.error('Belge yenileme hatası:', error)
      return { success: false, message: error.message }
    }
  }, [documentId, updateStats])

  // Items'ı manuel güncelle (local update için)
  const updateItems = useCallback((newItems) => {
    setItems(newItems)
    updateStats(newItems)
  }, [updateStats])

  // Belge tipini belirle
  const getDocumentTypeName = useCallback((docType, tipi) => {
    if (docType === '6') {
      return 'Sipariş'
    } else if (docType === '1' || docType === '2') {
      const tipiStr = tipi ? String(tipi).toLowerCase() : ''
      if (tipiStr.includes('aliş') || tipiStr.includes('alis')) {
        return 'Alış Faturası'
      } else if (tipiStr.includes('satiş') || tipiStr.includes('satis')) {
        return 'Satış Faturası'
      }
      return docType === '1' ? 'Satış Faturası' : 'Alış Faturası'
    }
    return 'Belge'
  }, [])

  return {
    // State
    document,
    items,
    stats,
    loading,
    
    // Setters
    setDocument,
    setItems: updateItems,
    
    // Functions
    fetchDocument,
    refreshDocument,
    updateStats,
    getDocumentTypeName
  }
}

export default useDocument



