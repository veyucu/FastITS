import { useEffect } from 'react'

/**
 * Sayfa başlığını dinamik olarak değiştiren hook
 * @param {string} title - Sayfa başlığı
 */
const usePageTitle = (title) => {
    useEffect(() => {
        const prevTitle = document.title
        document.title = title ? `${title} - AtakodITS` : 'AtakodITS'

        // Cleanup: Component unmount olunca önceki başlığa dön
        return () => {
            document.title = prevTitle
        }
    }, [title])
}

export default usePageTitle
