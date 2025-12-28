/**
 * Backend için ayar yardımcı fonksiyonları
 * Frontend'den gelen ayarları okur veya varsayılan değerler kullanır
 */

const DEFAULT_SETTINGS = {
  // ITS Ayarları
  itsGlnNo: '8680001084524',
  itsUsername: '86800010845240000',
  itsPassword: '1981aa',
  itsWebServiceUrl: 'https://its2.saglik.gov.tr',
  itsTokenUrl: '/token/app/token',
  itsDepoSatisUrl: '/wholesale/app/dispatch',
  itsCheckStatusUrl: '/reference/app/check_status',
  itsDeaktivasyonUrl: '/common/app/deactivation',
  itsMalAlimUrl: '/common/app/accept',
  itsMalIadeUrl: '/common/app/return',
  itsMalAlimIptalUrl: '/common/app/acceptcancel',
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
  // Genel Ayarlar
  depoAdi: 'DEPO'  // Bizim GLN'in ekrandaki gösterim adı
}

// Ayarları cache'le (her requestte localStorage okumamak için)
let cachedSettings = null

/**
 * Ayarları al (frontend'den veya varsayılan)
 * @param {Object} frontendSettings - Frontend'den gelen ayarlar (opsiyonel)
 * @returns {Object}
 */
export function getSettings(frontendSettings = null) {
  if (frontendSettings) {
    cachedSettings = { ...DEFAULT_SETTINGS, ...frontendSettings }
    return cachedSettings
  }

  if (cachedSettings) {
    return cachedSettings
  }

  return DEFAULT_SETTINGS
}

/**
 * Tek bir ayar değeri al
 * @param {string} key 
 * @param {any} defaultValue 
 * @returns {any}
 */
export function getSetting(key, defaultValue = null) {
  const settings = getSettings()
  return settings[key] !== undefined ? settings[key] : defaultValue
}

/**
 * ITS tam URL oluştur
 * @param {string} endpoint - Endpoint key (örn: 'itsTokenUrl')
 * @returns {string}
 */
export function getITSUrl(endpoint) {
  const settings = getSettings()
  const baseUrl = settings.itsWebServiceUrl || DEFAULT_SETTINGS.itsWebServiceUrl
  const path = settings[endpoint] || DEFAULT_SETTINGS[endpoint]
  return `${baseUrl}${path}`
}

/**
 * ITS credentials
 * @returns {Object}
 */
export function getITSCredentials() {
  const settings = getSettings()
  return {
    glnNo: settings.itsGlnNo || DEFAULT_SETTINGS.itsGlnNo,
    username: settings.itsUsername || DEFAULT_SETTINGS.itsUsername,
    password: settings.itsPassword || DEFAULT_SETTINGS.itsPassword,
    baseUrl: settings.itsWebServiceUrl || DEFAULT_SETTINGS.itsWebServiceUrl
  }
}

/**
 * Ayarları güncelle (frontend'den geldiğinde)
 * @param {Object} newSettings 
 */
export function updateSettings(newSettings) {
  cachedSettings = { ...DEFAULT_SETTINGS, ...newSettings }
}

/**
 * Ayarları temizle (cache sıfırla)
 */
export function clearSettings() {
  cachedSettings = null
}

export default {
  getSettings,
  getSetting,
  getITSUrl,
  getITSCredentials,
  updateSettings,
  clearSettings
}

