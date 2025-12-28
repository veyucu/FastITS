import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Save, Eye, EyeOff, Home, RefreshCw } from 'lucide-react'
import apiService from '../services/apiService'
import usePageTitle from '../hooks/usePageTitle'

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

  // Genel ITS Ayarları
  depoAdi: 'DEPO',  // Bizim GLN'in ekrandaki gösterim adı

  // UTS Ayarları
  utsNo: '',
  utsId: '',
  utsWebServiceUrl: 'https://utsuygulama.saglik.gov.tr',
  utsVermeBildirimiUrl: '/UTS/uh/rest/bildirim/verme/ekle',
  utsVermeIptalBildirimiUrl: '/UTS/uh/rest/bildirim/verme/iptal',
  utsAlmaBildirimiUrl: '/UTS/uh/rest/bildirim/alma/ekle',
  utsFirmaSorgulaUrl: '/UTS/rest/kurum/firmaSorgula',
  utsUrunSorgulaUrl: '/UTS/rest/tibbiCihaz/urunSorgula',
  utsBekleyenleriSorgulaUrl: '/UTS/uh/rest/bildirim/alma/bekleyenler/sorgula',
  utsBildirimSorgulaUrl: '/UTS/uh/rest/bildirim/sorgula/offset',
  utsStokYapilabilirTekilUrunSorgulaUrl: '/UTS/uh/rest/stokYapilabilirTekilUrun/sorgula',

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

const SettingsPage = () => {
  usePageTitle('Ayarlar')
  const navigate = useNavigate()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState(null)
  const [activeTab, setActiveTab] = useState('its')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Veritabanından ayarları yükle
    const loadSettings = async () => {
      try {
        const result = await apiService.getSettings()
        if (result.success) {
          setSettings({ ...DEFAULT_SETTINGS, ...result.data })
        } else {
          // Fallback: localStorage'dan yükle
          const savedSettings = localStorage.getItem('appSettings')
          if (savedSettings) {
            setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) })
          }
        }
      } catch (error) {
        console.error('Ayarlar yüklenirken hata:', error)
        // Fallback: localStorage
        const savedSettings = localStorage.getItem('appSettings')
        if (savedSettings) {
          try {
            setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) })
          } catch (e) { }
        }
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    try {
      // LocalStorage'a kaydet
      localStorage.setItem('appSettings', JSON.stringify(settings))

      // Backend'e de kaydet
      await apiService.saveSettings(settings)

      setMessage({ type: 'success', text: '✅ Ayarlar başarıyla kaydedildi!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Ayarlar kaydedilirken hata oluştu!' })
      console.error('Ayar kaydetme hatası:', error)
    }
  }

  const handleReset = () => {
    if (confirm('Tüm ayarları varsayılan değerlere sıfırlamak istediğinize emin misiniz?')) {
      setSettings(DEFAULT_SETTINGS)
      localStorage.removeItem('appSettings')
      setMessage({ type: 'info', text: '🔄 Ayarlar varsayılan değerlere sıfırlandı!' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const InputField = ({ label, field, placeholder, type = 'text', required = false }) => (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-slate-300 mb-2">
        {label}
        {required && <span className="text-rose-400 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={settings[field]}
        onChange={(e) => handleChange(field, e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <div className="bg-dark-900/80 backdrop-blur-sm border-b border-dark-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-10 h-10 bg-dark-700 rounded-lg flex items-center justify-center hover:bg-dark-600 transition-colors border border-dark-600"
              >
                <Home className="w-6 h-6 text-slate-300" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                  <Settings className="w-7 h-7 text-primary-400" />
                  Sistem Ayarları
                </h1>
                <p className="text-slate-500 mt-1">ITS ve ERP entegrasyon ayarları</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors flex items-center gap-2 text-slate-300 border border-dark-600"
              >
                <RefreshCw className="w-4 h-4" />
                Sıfırla
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-500 transition-colors flex items-center gap-2 shadow-lg shadow-primary-600/30"
              >
                <Save className="w-5 h-5" />
                Kaydet
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="container mx-auto px-6 mt-4">
          <div className={`p-4 rounded-lg border ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
            message.type === 'error' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
              'bg-primary-500/20 text-primary-400 border-primary-500/30'
            }`}>
            {message.text}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="container mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="bg-dark-800/60 rounded-lg border border-dark-700 mb-6">
          <div className="flex border-b border-dark-700">
            <button
              onClick={() => setActiveTab('its')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'its'
                ? 'text-primary-400 border-b-2 border-primary-500 bg-dark-700/50'
                : 'text-slate-400 hover:bg-dark-700/30'
                }`}
            >
              🔐 ITS Ayarları
            </button>
            <button
              onClick={() => setActiveTab('uts')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'uts'
                ? 'text-rose-400 border-b-2 border-rose-500 bg-dark-700/50'
                : 'text-slate-400 hover:bg-dark-700/30'
                }`}
            >
              🔴 UTS Ayarları
            </button>
            <button
              onClick={() => setActiveTab('erp')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'erp'
                ? 'text-primary-400 border-b-2 border-primary-500 bg-dark-700/50'
                : 'text-slate-400 hover:bg-dark-700/30'
                }`}
            >
              🖥️ ERP Ayarları
            </button>
            <button
              onClick={() => setActiveTab('mapping')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'mapping'
                ? 'text-primary-400 border-b-2 border-primary-500 bg-dark-700/50'
                : 'text-slate-400 hover:bg-dark-700/30'
                }`}
            >
              🔗 Alan Eşleştirmeleri
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-dark-800/60 rounded-lg border border-dark-700 p-6">
          {/* ITS Ayarları */}
          {activeTab === 'its' && (
            <div>
              <h2 className="text-xl font-bold text-slate-100 mb-6">ITS Web Servis Ayarları</h2>

              {/* Temel Bilgiler */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <InputField
                  label="ITS GLN No"
                  field="itsGlnNo"
                  placeholder="8680001084524"
                  required
                />
                <InputField
                  label="ITS Kullanıcı Adı"
                  field="itsUsername"
                  placeholder="86800010845240000"
                  required
                />
                <InputField
                  label="Depo Adı (Sorgulama Ekranında Gösterilecek)"
                  field="depoAdi"
                  placeholder="DEPO"
                />
              </div>

              {/* Şifre */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  ITS Şifre <span className="text-rose-400 ml-1">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={settings.itsPassword}
                    onChange={(e) => handleChange('itsPassword', e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 pr-12 bg-dark-800 border border-dark-600 rounded-lg text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Web Servis Adresi */}
              <div className="mb-8">
                <InputField
                  label="ITS Web Servis Adresi"
                  field="itsWebServiceUrl"
                  placeholder="https://its2.saglik.gov.tr"
                  required
                />
              </div>

              {/* URL'ler */}
              <h3 className="text-lg font-bold text-slate-200 mb-4 mt-8">Endpoint URL'leri</h3>
              <div className="grid grid-cols-2 gap-6">
                <InputField label="Token URL" field="itsTokenUrl" placeholder="/token/app/token" />
                <InputField label="Depo Satış URL" field="itsDepoSatisUrl" placeholder="/wholesale/app/dispatch" />
                <InputField label="Durum Kontrol URL" field="itsCheckStatusUrl" placeholder="/reference/app/check_status" />
                <InputField label="Deaktivasyon URL" field="itsDeaktivasyonUrl" placeholder="/common/app/deactivation" />
                <InputField label="Mal Alım URL" field="itsMalAlimUrl" placeholder="/common/app/accept" />
                <InputField label="Mal İade URL" field="itsMalIadeUrl" placeholder="/common/app/return" />
                <InputField label="Satış İptal URL" field="itsSatisIptalUrl" placeholder="/wholesale/app/dispatchcancel" />
                <InputField label="Eczane Satış URL" field="itsEczaneSatisUrl" placeholder="/prescription/app/pharmacysale" />
                <InputField label="Eczane Satış İptal URL" field="itsEczaneSatisIptalUrl" placeholder="/prescription/app/pharmacysalecancel" />
                <InputField label="Takas Devir URL" field="itsTakasDevirUrl" placeholder="/common/app/transfer" />
                <InputField label="Takas İptal URL" field="itsTakasIptalUrl" placeholder="/common/app/transfercancel" />
                <InputField label="Cevap Kod URL" field="itsCevapKodUrl" placeholder="/reference/app/errorcode" />
                <InputField label="Paket Sorgu URL" field="itsPaketSorguUrl" placeholder="/pts/app/search" />
                <InputField label="Paket İndir URL" field="itsPaketIndirUrl" placeholder="/pts/app/GetPackage" />
                <InputField label="Paket Gönder URL" field="itsPaketGonderUrl" placeholder="/pts/app/SendPackage" />
                <InputField label="Doğrulama URL" field="itsDogrulamaUrl" placeholder="/reference/app/verification" />
              </div>
            </div>
          )}

          {/* UTS Ayarları */}
          {activeTab === 'uts' && (
            <div>
              <h2 className="text-xl font-bold text-slate-100 mb-6">UTS Web Servis Ayarları</h2>

              {/* UTS No */}
              <div className="mb-8">
                <InputField
                  label="UTS No"
                  field="utsNo"
                  placeholder="8680001084524"
                  required
                />
                <p className="text-sm text-slate-500 mt-1">
                  Firmanın Sağlık Bakanlığı'ndan aldığı UTS numarası
                </p>
              </div>

              {/* UTS ID */}
              <div className="mb-8">
                <InputField
                  label="UTS ID"
                  field="utsId"
                  placeholder="Systemfed20222-7305-4225-bb27-89a7d28b68aa"
                  required
                />
                <p className="text-sm text-slate-500 mt-1">
                  Sağlık Bakanlığı tarafından verilen UTS kimlik numarası (System ile başlar)
                </p>
              </div>

              {/* Web Servis Adresi */}
              <div className="mb-8">
                <InputField
                  label="UTS Web Servis Adresi"
                  field="utsWebServiceUrl"
                  placeholder="https://utsuygulama.saglik.gov.tr"
                  required
                />
              </div>

              {/* Endpoint URL'leri */}
              <h3 className="text-lg font-bold text-slate-200 mb-4 mt-8">Endpoint URL'leri</h3>
              <div className="grid grid-cols-2 gap-6">
                <InputField label="Verme Bildirimi URL" field="utsVermeBildirimiUrl" placeholder="/UTS/uh/rest/bildirim/verme/ekle" />
                <InputField label="Verme İptal Bildirimi URL" field="utsVermeIptalBildirimiUrl" placeholder="/UTS/uh/rest/bildirim/verme/iptal" />
                <InputField label="Alma Bildirimi URL" field="utsAlmaBildirimiUrl" placeholder="/UTS/uh/rest/bildirim/alma/ekle" />
                <InputField label="Firma Sorgula URL" field="utsFirmaSorgulaUrl" placeholder="/UTS/rest/kurum/firmaSorgula" />
                <InputField label="Ürün Sorgula URL" field="utsUrunSorgulaUrl" placeholder="/UTS/rest/tibbiCihaz/urunSorgula" />
                <InputField label="Bekleyenler Sorgula URL" field="utsBekleyenleriSorgulaUrl" placeholder="/UTS/uh/rest/bildirim/alma/bekleyenler/sorgula" />
                <InputField label="Bildirim Sorgula URL" field="utsBildirimSorgulaUrl" placeholder="/UTS/uh/rest/bildirim/sorgula/offset" />
                <InputField label="Stok Yapılabilir Tekil Ürün URL" field="utsStokYapilabilirTekilUrunSorgulaUrl" placeholder="/UTS/uh/rest/stokYapilabilirTekilUrun/sorgula" />
              </div>
            </div>
          )}

          {/* ERP Ayarları */}
          {activeTab === 'erp' && (
            <div>
              <h2 className="text-xl font-bold text-slate-100 mb-6">ERP Entegrasyon Ayarları</h2>
              <InputField
                label="ERP Web Servis Adresi"
                field="erpWebServiceUrl"
                placeholder="http://localhost:5000"
                required
              />
              <p className="text-sm text-slate-500 mt-2">
                💡 Backend API'nizin çalıştığı adres. Genellikle <code className="bg-dark-700 px-2 py-1 rounded text-primary-400">http://localhost:5000</code>
              </p>
            </div>
          )}

          {/* Alan Eşleştirmeleri */}
          {activeTab === 'mapping' && (
            <div>
              <h2 className="text-xl font-bold text-slate-100 mb-6">Veritabanı Alan Eşleştirmeleri</h2>

              {/* Ürün Ayarları */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  📦 Ürün Bilgileri
                </h3>
                <div className="space-y-4 bg-primary-500/10 border border-primary-500/20 p-4 rounded-lg">
                  <InputField
                    label="Ürün Barkod Bilgisi (Kolon Adı)"
                    field="urunBarkodBilgisi"
                    placeholder="STOK_KODU"
                  />
                  <p className="text-sm text-slate-500">
                    TBLSTSABIT tablosundaki barkod bilgisinin bulunduğu kolon
                  </p>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">ITS/UTS Tanımlama</h3>
                <div className="space-y-4 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg">
                  <div>
                    <InputField
                      label="Ürün ITS Bilgisi (SQL Koşulu)"
                      field="urunItsBilgisi"
                      placeholder="TBLSTSABIT.KOD_5='BESERI'"
                    />
                    <p className="text-sm text-slate-500">
                      ITS takibi gereken ürünleri belirleyen SQL koşulu (TBLSTSABIT veya TBLSTSABITEK)
                    </p>
                  </div>

                  <div>
                    <InputField
                      label="Ürün UTS Bilgisi (SQL Koşulu)"
                      field="urunUtsBilgisi"
                      placeholder="TBLSTSABIT.KOD_5='UTS'"
                    />
                    <p className="text-sm text-slate-500">
                      UTS takibi gereken ürünleri belirleyen SQL koşulu (TBLSTSABIT veya TBLSTSABITEK)
                    </p>
                  </div>
                </div>
              </div>

              {/* Cari Ayarları */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  👤 Cari Bilgileri
                </h3>
                <div className="space-y-4 bg-violet-500/10 border border-violet-500/20 p-4 rounded-lg">
                  <div>
                    <InputField
                      label="Cari GLN Bilgisi (Tablo.Kolon)"
                      field="cariGlnBilgisi"
                      placeholder="TBLCASABIT.EMAIL"
                    />
                    <p className="text-sm text-slate-500">
                      Cari GLN numarasının bulunduğu alan (TBLCASABIT veya TBLCASABITEK)
                    </p>
                  </div>

                  <div>
                    <InputField
                      label="Cari UTS Bilgisi (Tablo.Kolon)"
                      field="cariUtsBilgisi"
                      placeholder="TBLCASABITEK.KULL3S"
                    />
                    <p className="text-sm text-slate-500">
                      Cari UTS numarasının bulunduğu alan (TBLCASABIT veya TBLCASABITEK)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded">
                <p className="text-sm text-amber-400">
                  <strong>⚠️ Dikkat:</strong> Bu ayarlar değiştirildiğinde backend'in yeniden başlatılması gerekebilir.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
