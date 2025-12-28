/**
 * Ayarlar yardımcı fonksiyonları
 * localStorage'dan ayarları okur ve varsayılan değerlerle birleştirir
 */

const DEFAULT_SETTINGS = {
  // ITS Ayarları
  itsGlnNo: '',
  itsUsername: '',
  itsPassword: '',
  itsWebServiceUrl: 'https://its2.saglik.gov.tr',
  itsTokenUrl: '/token/app/token',
  itsDepoSatisUrl: '/wholesale/app/dispatch',
  itsCheckStatusUrl: '/reference/app/check_status',
  itsDeaktivasyonUrl: '/common/app/deactivation',
  itsMalAlimUrl: '/common/app/accept',
  itsMalIadeUrl: '/common/app/return',
  itsSatisIptalUrl: '/wholesale/app/dispatchcancel',
  itsEczaneSatisUrl: '/prescription/app/pharmacysale',
  itsEczaneSatisIptalUrl: '/prescription/app/pharmacysalecancel',
  itsTakasDevirUrl: '/common/app/transfer',
  itsTakasIptalUrl: '/common/app/transfercancel',
  itsCevapKodUrl: '/reference/app/errorcode',
  itsPaketSorguUrl: '/pts/app/search',
  itsPaketIndirUrl: '/pts/app/GetPackage',
  itsPaketGonderUrl: '/pts/app/SendPackage',
  itsDogrulamaUrl: '/reference/app/verification',
  
  // ERP Ayarları
  erpWebServiceUrl: 'http://localhost:5000',
  
  // Ürün Ayarları
  urunBarkodBilgisi: 'STOK_KODU',
  urunItsBilgisi: "TBLSTSABIT.KOD_5='BESERI'",
  urunUtsBilgisi: "TBLSTSABIT.KOD_5='UTS'",
  
  // Cari Ayarları
  cariGlnBilgisi: 'TBLCASABIT.EMAIL',
  cariUtsBilgisi: 'TBLCASABITEK.KULL3S'
}

/**
 * Tüm ayarları getirir
 * @returns {Object} Ayarlar objesi
 */
export const getSettings = () => {
  try {
    const savedSettings = localStorage.getItem('appSettings')
    if (savedSettings) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }
    }
  } catch (error) {
    console.error('Ayarlar okunurken hata:', error)
  }
  return DEFAULT_SETTINGS
}

/**
 * Belirli bir ayarı getirir
 * @param {string} key - Ayar anahtarı
 * @param {any} defaultValue - Varsayılan değer
 * @returns {any} Ayar değeri
 */
export const getSetting = (key, defaultValue = null) => {
  const settings = getSettings()
  return settings[key] !== undefined ? settings[key] : defaultValue
}

/**
 * Ayarları kaydeder
 * @param {Object} settings - Ayarlar objesi
 */
export const saveSettings = (settings) => {
  try {
    localStorage.setItem('appSettings', JSON.stringify(settings))
    return { success: true }
  } catch (error) {
    console.error('Ayarlar kaydedilirken hata:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Tam ITS URL'ini oluşturur
 * @param {string} endpoint - Endpoint path (örn: 'itsTokenUrl')
 * @returns {string} Tam URL
 */
export const getITSUrl = (endpoint) => {
  const settings = getSettings()
  const baseUrl = settings.itsWebServiceUrl
  const path = settings[endpoint]
  return `${baseUrl}${path}`
}

/**
 * ITS API için gerekli bilgileri döner
 * @returns {Object} ITS credentials
 */
export const getITSCredentials = () => {
  const settings = getSettings()
  return {
    glnNo: settings.itsGlnNo,
    username: settings.itsUsername,
    password: settings.itsPassword,
    baseUrl: settings.itsWebServiceUrl
  }
}

/**
 * ERP API base URL'ini döner
 * @returns {string} ERP base URL
 */
export const getERPBaseUrl = () => {
  return getSetting('erpWebServiceUrl', 'http://localhost:5000')
}

/**
 * Ayarların eksiksiz olup olmadığını kontrol eder
 * @returns {Object} Validasyon sonucu
 */
export const validateSettings = () => {
  const settings = getSettings()
  const errors = []
  
  // ITS zorunlu alanlar
  if (!settings.itsGlnNo) errors.push('ITS GLN No boş olamaz')
  if (!settings.itsUsername) errors.push('ITS Kullanıcı Adı boş olamaz')
  if (!settings.itsPassword) errors.push('ITS Şifre boş olamaz')
  if (!settings.itsWebServiceUrl) errors.push('ITS Web Servis Adresi boş olamaz')
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export default {
  getSettings,
  getSetting,
  saveSettings,
  getITSUrl,
  getITSCredentials,
  getERPBaseUrl,
  validateSettings
}



