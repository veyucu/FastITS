import { useState, useCallback, useRef } from 'react'

/**
 * Mesaj gösterimi için custom hook
 * @param {number} defaultDuration - Varsayılan mesaj süresi (ms)
 * @returns {Object} - Mesaj state ve fonksiyonları
 */
export const useMessage = (defaultDuration = 3000) => {
  const [message, setMessage] = useState(null)
  const timeoutRef = useRef(null)

  // Mesaj göster
  const showMessage = useCallback((text, type = 'info', duration = defaultDuration) => {
    // Önceki timeout'u temizle
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    setMessage({ text, type })
    
    // Otomatik gizle
    if (duration > 0) {
      timeoutRef.current = setTimeout(() => {
        setMessage(null)
      }, duration)
    }
  }, [defaultDuration])

  // Mesajı gizle
  const hideMessage = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setMessage(null)
  }, [])

  // Başarı mesajı
  const showSuccess = useCallback((text, duration) => {
    showMessage(text, 'success', duration)
  }, [showMessage])

  // Hata mesajı
  const showError = useCallback((text, duration) => {
    showMessage(text, 'error', duration)
  }, [showMessage])

  // Uyarı mesajı
  const showWarning = useCallback((text, duration) => {
    showMessage(text, 'warning', duration)
  }, [showMessage])

  // Bilgi mesajı
  const showInfo = useCallback((text, duration) => {
    showMessage(text, 'info', duration)
  }, [showMessage])

  return {
    message,
    showMessage,
    hideMessage,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }
}

export default useMessage


