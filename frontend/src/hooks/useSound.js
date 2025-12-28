import { useCallback } from 'react'

/**
 * Ses efektleri için custom hook
 * @returns {Object} - Ses çalma fonksiyonları
 */
export const useSound = () => {
  // Başarı sesi
  const playSuccessSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.value = 0.3
      
      oscillator.start()
      setTimeout(() => {
        oscillator.frequency.value = 1000
      }, 100)
      setTimeout(() => {
        oscillator.stop()
        audioContext.close()
      }, 200)
    } catch (e) {
      // Ses çalınamadı - sessizce devam et
    }
  }, [])

  // Hata sesi
  const playErrorSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 300
      oscillator.type = 'square'
      gainNode.gain.value = 0.3
      
      oscillator.start()
      setTimeout(() => {
        oscillator.frequency.value = 200
      }, 100)
      setTimeout(() => {
        oscillator.stop()
        audioContext.close()
      }, 300)
    } catch (e) {
      // Ses çalınamadı - sessizce devam et
    }
  }, [])

  // Uyarı sesi
  const playWarningSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 500
      oscillator.type = 'triangle'
      gainNode.gain.value = 0.3
      
      oscillator.start()
      setTimeout(() => {
        oscillator.stop()
        audioContext.close()
      }, 150)
    } catch (e) {
      // Ses çalınamadı - sessizce devam et
    }
  }, [])

  return {
    playSuccessSound,
    playErrorSound,
    playWarningSound
  }
}

export default useSound

