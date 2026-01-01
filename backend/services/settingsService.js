import { getPTSConnection } from '../config/database.js'

// Default ayarlar (DB boşsa kullanılır)
const DEFAULT_SETTINGS = {
  urunBarkodBilgisi: 'STOK_KODU',
  urunItsBilgisi: "TBLSTSABIT.KOD_5='BESERI'",
  urunUtsBilgisi: "TBLSTSABIT.KOD_5='UTS'",
  cariGlnBilgisi: 'TBLCASABIT.EMAIL',
  cariUtsBilgisi: 'TBLCASABITEK.KULL3S'
}

// Ayarları hafızada tut (cache)
let cachedSettings = null
let settingsLoaded = false

const settingsService = {
  // Backend başlatıldığında ayarları yükle (bir seferlik)
  async loadSettings() {
    try {
      const pool = await getPTSConnection()

      const result = await pool.request()
        .query('SELECT AYAR_ADI, AYAR_DEGERI FROM AKTBLAYAR')

      // DB'den gelen ayarları object'e çevir
      cachedSettings = { ...DEFAULT_SETTINGS }

      for (const row of result.recordset) {
        cachedSettings[row.AYAR_ADI] = row.AYAR_DEGERI
      }

      settingsLoaded = true
      return cachedSettings
    } catch (error) {
      console.error('❌ Ayar yükleme hatası:', error)
      cachedSettings = { ...DEFAULT_SETTINGS }
      settingsLoaded = true
      return cachedSettings
    }
  },

  // Tüm ayarları getir (cache'den)
  getSettings() {
    if (!settingsLoaded) {
      console.warn('⚠️ Ayarlar henüz yüklenmedi, default kullanılıyor')
      return DEFAULT_SETTINGS
    }
    return cachedSettings || DEFAULT_SETTINGS
  },

  // Belirli bir ayarı getir (cache'den - senkron)
  getSetting(key) {
    if (!settingsLoaded) {
      console.warn('⚠️ Ayarlar henüz yüklenmedi, default kullanılıyor:', key)
      return DEFAULT_SETTINGS[key] || null
    }
    return cachedSettings?.[key] || DEFAULT_SETTINGS[key] || null
  },

  // Ayarları kaydet ve cache'i güncelle
  async saveSettings(settings) {
    try {
      const pool = await getPTSConnection()

      for (const [key, value] of Object.entries(settings)) {
        // Önce var mı kontrol et
        const exists = await pool.request()
          .input('ayarAdi', key)
          .query('SELECT ID FROM AKTBLAYAR WHERE AYAR_ADI = @ayarAdi')

        if (exists.recordset.length > 0) {
          // Güncelle
          await pool.request()
            .input('ayarAdi', key)
            .input('ayarDegeri', value || '')
            .query(`
              UPDATE AKTBLAYAR 
              SET AYAR_DEGERI = @ayarDegeri, 
                  GUNCELLEME_TARIHI = GETDATE() 
              WHERE AYAR_ADI = @ayarAdi
            `)
        } else {
          // Yeni ekle
          await pool.request()
            .input('ayarAdi', key)
            .input('ayarDegeri', value || '')
            .query(`
              INSERT INTO AKTBLAYAR (AYAR_ADI, AYAR_DEGERI) 
              VALUES (@ayarAdi, @ayarDegeri)
            `)
        }

        // Cache'i güncelle
        if (cachedSettings) {
          cachedSettings[key] = value
        }
      }

      console.log('✅ Ayarlar kaydedildi ve cache güncellendi')
      return { success: true }
    } catch (error) {
      console.error('❌ Ayar kaydetme hatası:', error)
      throw error
    }
  },

  // Cache'i yenile (manuel refresh)
  async refreshCache() {
    settingsLoaded = false
    return await this.loadSettings()
  },

  // Cache durumunu kontrol et
  isLoaded() {
    return settingsLoaded
  },

  // Cari GLN kolon bilgisini parse et
  parseColumnInfo(columnInfo) {
    if (!columnInfo) return { table: null, column: null }

    const parts = columnInfo.split('.')
    if (parts.length === 2) {
      return { table: parts[0], column: parts[1] }
    } else {
      return { table: 'TBLCASABIT', column: parts[0] }
    }
  }
}

export default settingsService
