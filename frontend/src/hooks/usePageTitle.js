import { useEffect } from 'react'

/**
 * Sayfa başlığını dinamik olarak değiştiren hook
 * Seçili şirket bilgisini de ekler
 * @param {string} title - Sayfa başlığı
 */
const usePageTitle = (title) => {
    useEffect(() => {
        const prevTitle = document.title

        // SessionStorage'dan şirket bilgisini al
        let companyName = ''
        try {
            const storedCompany = sessionStorage.getItem('selectedCompany')
            if (storedCompany) {
                const company = JSON.parse(storedCompany)
                companyName = company.sirket || ''
            }
        } catch (error) {
            // ignore
        }

        // Title formatı: "Sayfa Adı - Şirket - FastITS"
        if (title && companyName) {
            document.title = `${title} - ${companyName} - FastITS`
        } else if (title) {
            document.title = `${title} - FastITS`
        } else {
            document.title = 'FastITS'
        }

        // Cleanup: Component unmount olunca önceki başlığa dön
        return () => {
            document.title = prevTitle
        }
    }, [title])
}

export default usePageTitle
