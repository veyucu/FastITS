import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SETTINGS_FILE = path.join(__dirname, '../data/settings.json')

// Default ayarlar
const DEFAULT_SETTINGS = {
  // Ürün Ayarları
  urunBarkodBilgisi: 'STOK_KODU',
  urunItsBilgisi: "TBLSTSABIT.KOD_5='BESERI'",
  urunUtsBilgisi: "TBLSTSABIT.KOD_5='UTS'",
  
  // Cari Ayarları
  cariGlnBilgisi: 'TBLCASABIT.EMAIL',
  cariUtsBilgisi: 'TBLCASABITEK.KULL3S'
}

// Data klasörünü oluştur
async function ensureDataDir() {
  const dataDir = path.dirname(SETTINGS_FILE)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
}

const settingsService = {
  // Ayarları getir
  async getSettings() {
    try {
      await ensureDataDir()
      
      try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf8')
        return JSON.parse(data)
      } catch (error) {
        // Dosya yoksa default ayarları döndür
        return DEFAULT_SETTINGS
      }
    } catch (error) {
      console.error('Ayar okuma hatası:', error)
      return DEFAULT_SETTINGS
    }
  },

  // Ayarları kaydet
  async saveSettings(settings) {
    try {
      await ensureDataDir()
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2))
      return { success: true }
    } catch (error) {
      console.error('Ayar kaydetme hatası:', error)
      throw error
    }
  },

  // Belirli bir ayarı getir
  async getSetting(key) {
    const settings = await this.getSettings()
    return settings[key] || DEFAULT_SETTINGS[key]
  },

  // Cari GLN kolon bilgisini parse et
  parseColumnInfo(columnInfo) {
    // Format: "TBLCASABIT.EMAIL" veya "EMAIL"
    if (!columnInfo) return { table: null, column: null }
    
    const parts = columnInfo.split('.')
    if (parts.length === 2) {
      return { table: parts[0], column: parts[1] }
    } else {
      // Sadece kolon adı verilmişse, varsayılan tablo kullan
      return { table: 'TBLCASABIT', column: parts[0] }
    }
  }
}

export default settingsService

