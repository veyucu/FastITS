import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Package, Home, Truck, Search, Download, RefreshCw, X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import apiService from '../services/apiService'
import usePageTitle from '../hooks/usePageTitle'

// Badge Renderer - Dark Theme
const BadgeRenderer = ({ value, type = 'default' }) => {
  const styles = {
    kalem: 'bg-primary-500/20 text-primary-400 border border-primary-500/30',
    adet: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    default: 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
  }

  if (!value && value !== 0) return null

  return (
    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-sm font-bold ${styles[type]}`}>
      {value}
    </span>
  )
}

const PTSPage = () => {
  usePageTitle('PTS')
  const navigate = useNavigate()
  const location = useLocation()
  const gridRef = useRef(null)

  // Dashboard'dan mı gelindi kontrolü
  const fromDashboard = location.state?.fromDashboard === true

  // Bugünün tarihi
  const today = new Date().toISOString().split('T')[0]

  // LocalStorage'dan tarih ayarlarını oku (Dashboard'dan gelindiyse bugünü kullan)
  const getStoredValue = (key, defaultValue) => {
    if (fromDashboard) {
      return defaultValue
    }
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? stored : defaultValue
    } catch {
      return defaultValue
    }
  }

  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(() =>
    getStoredValue('pts_startDate', today)
  )
  const [endDate, setEndDate] = useState(() =>
    getStoredValue('pts_endDate', today)
  )
  const [dateFilterType, setDateFilterType] = useState(() =>
    getStoredValue('pts_dateFilterType', 'document') // Varsayılan: Belge Tarihi
  )
  const [listData, setListData] = useState([]) // Grid için liste verisi
  const [searchText, setSearchText] = useState(() =>
    fromDashboard ? '' : getStoredValue('pts_searchText', '')
  ) // Arama metni
  const [initialLoadDone, setInitialLoadDone] = useState(false) // İlk yükleme kontrolü
  const [hideNotified, setHideNotified] = useState(false) // Bildirilenleri gizle filtresi
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768) // Mobil görünüm kontrolü

  // Ekran boyutu değişikliği dinleyicisi
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // İndirme modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState({
    total: 0,
    current: 0,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    status: 'idle', // idle, searching, downloading, completed, error
    failedPackages: [] // [{transferId, message}]
  })

  // Dashboard'dan gelindiyse location state'ini temizle (sayfa yenilemelerinde etkilenmemesi için)
  useEffect(() => {
    if (fromDashboard) {
      // State'i temizle - bu sayede refresh yapıldığında veya PTSDetails'den geri dönüldüğünde localStorage kullanılır
      window.history.replaceState({}, document.title)
    }
  }, [fromDashboard])

  // Tarih ayarlarını localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem('pts_startDate', startDate)
  }, [startDate])

  useEffect(() => {
    localStorage.setItem('pts_endDate', endDate)
  }, [endDate])

  useEffect(() => {
    localStorage.setItem('pts_dateFilterType', dateFilterType)
  }, [dateFilterType])

  useEffect(() => {
    localStorage.setItem('pts_searchText', searchText)
  }, [searchText])

  // Mesaj göster
  const showMessage = (text, type = 'info') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  // Tarih validasyonu - geçersiz tarihleri kontrol et
  const isValidDate = (dateString) => {
    if (!dateString) return false
    const date = new Date(dateString)
    // Geçersiz tarih kontrolü (Invalid Date veya tarih string'i ile eşleşmiyorsa)
    if (isNaN(date.getTime())) return false
    // Girilen tarih ile parse edilen tarih aynı mı kontrol et
    const [year, month, day] = dateString.split('-').map(Number)
    return date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
  }

  // Tarih değiştirme handler'ları
  const handleStartDateChange = (e) => {
    const value = e.target.value
    setStartDate(value)
  }

  const handleEndDateChange = (e) => {
    const value = e.target.value
    setEndDate(value)
  }

  // Veritabanındaki kayıtları listele
  const handleListPackages = useCallback(async () => {
    if (!startDate || !endDate) {
      showMessage('⚠️ Başlangıç ve bitiş tarihi seçin', 'error')
      return
    }

    if (!isValidDate(startDate)) {
      showMessage('⚠️ Geçersiz başlangıç tarihi', 'error')
      return
    }

    if (!isValidDate(endDate)) {
      showMessage('⚠️ Geçersiz bitiş tarihi', 'error')
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      showMessage('⚠️ Başlangıç tarihi bitiş tarihinden büyük olamaz', 'error')
      return
    }

    // En fazla 1 ay (31 gün) kontrolü
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    if (diffDays > 31) {
      showMessage('⚠️ Tarih aralığı en fazla 1 ay olabilir', 'error')
      return
    }

    try {
      setLoading(true)

      const response = await apiService.listPTSPackages(startDate, endDate, dateFilterType)

      if (!response.success) {
        showMessage(`❌ ${response.message || 'Kayıtlar listelenemedi'}`, 'error')
        return
      }

      const data = response.data || []
      setListData(data)
      // Başarı mesajı kaldırıldı

    } catch (error) {
      console.error('Liste hatası:', error)
      showMessage('❌ Kayıtlar listelenemedi', 'error')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, dateFilterType])

  // İndirme modalını kapat ve listeyi yenile
  const closeDownloadModal = useCallback(() => {
    setShowDownloadModal(false)
    // Liste yenile
    handleListPackages()
  }, [handleListPackages])

  // ESC tuşu ile modal kapatma
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && showDownloadModal) {
        closeDownloadModal()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showDownloadModal, closeDownloadModal])

  // Sayfa yüklendiğinde otomatik listeleme
  useEffect(() => {
    if (!initialLoadDone && startDate && endDate && isValidDate(startDate) && isValidDate(endDate)) {
      setInitialLoadDone(true)
      handleListPackages()
    }
  }, [initialLoadDone, startDate, endDate, handleListPackages])

  // Tarih aralığına göre paketleri indir ve veritabanına kaydet
  const handleSearchByDate = async () => {
    if (!startDate || !endDate) {
      showMessage('⚠️ Başlangıç ve bitiş tarihi seçin', 'error')
      return
    }

    if (!isValidDate(startDate)) {
      showMessage('⚠️ Geçersiz başlangıç tarihi', 'error')
      return
    }

    if (!isValidDate(endDate)) {
      showMessage('⚠️ Geçersiz bitiş tarihi', 'error')
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      showMessage('⚠️ Başlangıç tarihi bitiş tarihinden büyük olamaz', 'error')
      return
    }

    // En fazla 1 ay (31 gün) kontrolü
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    if (diffDays > 31) {
      showMessage('⚠️ Tarih aralığı en fazla 1 ay olabilir', 'error')
      return
    }

    try {
      // Modal'ı aç ve ilk durumu ayarla
      setShowDownloadModal(true)
      setDownloadProgress({
        total: 0,
        current: 0,
        downloaded: 0,
        skipped: 0,
        failed: 0,
        status: 'searching',
        failedPackages: []
      })

      // Önce kaç paket var öğren
      const searchResponse = await apiService.searchPackages(startDate, endDate)

      if (!searchResponse.success) {
        setDownloadProgress(prev => ({
          ...prev,
          status: 'error'
        }))
        return
      }

      const transferIds = searchResponse.data || []

      if (transferIds.length === 0) {
        setDownloadProgress(prev => ({
          ...prev,
          status: 'completed',
          total: 0
        }))
        return
      }

      // Progress'i güncelle
      setDownloadProgress(prev => ({
        ...prev,
        total: transferIds.length,
        status: 'downloading'
      }))

      // SSE ile real-time progress
      // Kullanıcı bilgisini localStorage'dan al
      const storedUser = localStorage.getItem('user')
      const kullanici = storedUser ? JSON.parse(storedUser)?.username : null

      await apiService.downloadBulkPackagesStream(
        startDate,
        endDate,
        (progressData) => {
          // Her progress güncellemesinde state'i güncelle
          setDownloadProgress(prev => {
            // Eğer yeni hatalı paket varsa listeye ekle
            let failedPackages = prev.failedPackages || []
            if (progressData.failedPackage) {
              failedPackages = [...failedPackages, progressData.failedPackage]
            }
            return {
              total: progressData.total || 0,
              current: progressData.current || 0,
              downloaded: progressData.downloaded || 0,
              skipped: progressData.skipped || 0,
              failed: progressData.failed || 0,
              status: progressData.status,
              failedPackages
            }
          })
        },
        null, // settings
        kullanici
      )

      // Mesaj kaldırıldı - modal'da zaten gösteriliyor

    } catch (error) {
      console.error('Toplu paket indirme hatası:', error)
      setDownloadProgress(prev => ({
        ...prev,
        status: 'error'
      }))
    }
  }

  // Sayfa yüklendiğinde veya geri gelindiğinde otomatik listele
  useEffect(() => {
    const shouldAutoLoad = localStorage.getItem('pts_autoLoad')
    if (shouldAutoLoad === 'true') {
      localStorage.removeItem('pts_autoLoad')
      // Biraz gecikme ekleyerek state'lerin hazır olmasını sağla
      setTimeout(() => {
        handleListPackages()
      }, 100)
    }
  }, [handleListPackages]) // handleListPackages değiştiğinde çalış

  // Arama filtresi uygula - Tüm alanlarda ara + Bildirilenleri gizle
  const filteredData = useMemo(() => {
    let data = listData

    // Bildirilenleri gizle filtresi (BILDIRIM = OK olanları gizle)
    if (hideNotified) {
      data = data.filter(item => item.BILDIRIM !== 'OK')
    }

    if (!searchText.trim()) return data

    const searchLower = searchText.toLowerCase().trim()

    return data.filter(item => {
      // Transfer ID, Belge No, Source GLN ve Cari İsim'de ara
      const transferId = (item.TRANSFER_ID || '').toString().toLowerCase()
      const documentNumber = (item.DOCUMENT_NUMBER || '').toString().toLowerCase()
      const sourceGln = (item.SOURCE_GLN || '').toString().toLowerCase()
      const cariIsim = (item.SOURCE_GLN_NAME || '').toString().toLowerCase()

      return transferId.includes(searchLower) ||
        documentNumber.includes(searchLower) ||
        sourceGln.includes(searchLower) ||
        cariIsim.includes(searchLower)
    })
  }, [listData, searchText, hideNotified])

  // Column State Yönetimi
  const saveColumnState = useCallback(() => {
    if (gridRef.current && gridRef.current.api) {
      const columnState = gridRef.current.api.getColumnState()
      localStorage.setItem('pts_columnState', JSON.stringify(columnState))
    }
  }, [])

  const loadColumnState = useCallback(() => {
    try {
      const savedState = localStorage.getItem('pts_columnState')
      if (savedState && gridRef.current && gridRef.current.api) {
        const columnState = JSON.parse(savedState)
        gridRef.current.api.applyColumnState({ state: columnState, applyOrder: true })
      }
    } catch (error) {
      console.error('Column state yükleme hatası:', error)
    }
  }, [])

  const onGridReady = useCallback((params) => {
    // Grid hazır olduğunda column state'i yükle
    setTimeout(() => loadColumnState(), 100)
  }, [loadColumnState])

  // AG Grid Kolon Tanımları
  // Liste görünümü için kolon tanımları
  const listColumnDefs = useMemo(() => [
    {
      headerName: isMobile ? 'ID' : 'Transfer ID',
      field: 'TRANSFER_ID',
      width: isMobile ? 65 : 180,
      wrapText: isMobile,
      autoHeight: isMobile,
      cellClass: 'font-mono font-bold text-blue-600',
      cellStyle: isMobile ? { whiteSpace: 'normal', wordBreak: 'break-all', lineHeight: '1.3' } : null
    },
    {
      headerName: isMobile ? 'Belge' : 'Belge No / Tarih',
      field: 'DOCUMENT_NUMBER',
      width: isMobile ? 70 : 160,
      cellRenderer: (params) => {
        const date = params.data?.DOCUMENT_DATE
        const dateStr = date ? new Date(date).toLocaleDateString('tr-TR') : ''
        return (
          <div className="flex flex-col leading-tight py-1">
            <span className="font-semibold text-slate-200">{params.value || '-'}</span>
            <span className="text-xs text-slate-400">{dateStr}</span>
          </div>
        )
      }
    },
    {
      headerName: isMobile ? 'Cari' : 'GLN / Cari',
      field: 'SOURCE_GLN_NAME',
      width: isMobile ? 185 : 220,
      cellRenderer: (params) => {
        const gln = params.data?.SOURCE_GLN || ''
        return (
          <div className="flex flex-col leading-tight py-1">
            <span className="font-mono text-xs text-slate-400">{gln}</span>
            <span className="font-semibold text-slate-200 truncate">{params.value || '-'}</span>
          </div>
        )
      }
    },
    {
      headerName: isMobile ? 'Adet' : 'Kalem/Adet',
      field: 'UNIQUE_GTIN_COUNT',
      width: isMobile ? 70 : 100,
      cellClass: 'text-center',
      cellStyle: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
      cellRenderer: (params) => {
        const kalem = params.value || 0
        const adet = params.data?.TOTAL_PRODUCT_COUNT || 0
        return (
          <span className="px-2 py-1 rounded bg-blue-600/20 text-blue-400 font-medium text-sm">
            {kalem}/{adet}
          </span>
        )
      }
    },
    {
      headerName: 'Bildirim',
      field: 'BILDIRIM',
      width: 200,
      cellRenderer: (params) => {
        const value = params.value
        const tarih = params.data?.BILDIRIM_TARIHI
        const kullanici = params.data?.BILDIRIM_KULLANICI
        const tarihStr = tarih ? new Date(tarih).toLocaleString('tr-TR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : ''

        if (value === 'OK') {
          return (
            <div className="flex items-center gap-2 py-1">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs text-slate-300">{tarihStr}</span>
                {kullanici && <span className="text-xs text-slate-500">{kullanici}</span>}
              </div>
            </div>
          )
        }

        if (value === 'NOK') {
          return (
            <div className="flex items-center gap-2 py-1">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-red-500/20 border border-red-500/40">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs text-slate-300">{tarihStr}</span>
                {kullanici && <span className="text-xs text-slate-500">{kullanici}</span>}
              </div>
            </div>
          )
        }

        // Boş veya diğer durumlar
        return (
          <div className="flex items-center gap-2 py-1">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-700/50 border border-slate-600">
              <div className="w-3 h-3 rounded-full border-2 border-slate-500" />
            </div>
            <span className="text-xs text-slate-500">-</span>
          </div>
        )
      }
    },
    {
      headerName: 'Kayıt',
      field: 'KAYIT_TARIHI',
      width: 150,
      cellClass: 'text-center',
      cellStyle: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
      cellRenderer: (params) => {
        const tarih = params.value
        const kullanici = params.data?.KAYIT_KULLANICI
        const tarihStr = tarih ? new Date(tarih).toLocaleString('tr-TR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : '-'

        return (
          <div className="flex flex-col items-center justify-center leading-tight py-1">
            <span className="text-xs text-slate-400">{tarihStr}</span>
            {kullanici && <span className="text-xs text-slate-500">{kullanici}</span>}
          </div>
        )
      }
    },
    {
      headerName: 'Note',
      field: 'NOTE',
      width: 200,
      cellClass: 'text-sm text-gray-600'
    }
  ], [isMobile])

  return (
    <div className="flex flex-col h-screen bg-dark-950">
      {/* Header - Dark Theme - Mobile Responsive */}
      <div className="bg-dark-900/80 backdrop-blur-sm border-b border-dark-700">
        <div className="px-3 md:px-6 py-2 md:py-3">
          {/* Üst Satır - Logo, Başlık, İşlem Butonları */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Sol - Başlık (PTS ikonu ve başlığı sadece desktop) */}
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => navigate('/')}
                className="w-8 h-8 bg-dark-700 rounded flex items-center justify-center hover:bg-dark-600 transition-colors border border-dark-600 flex-shrink-0"
                title="Ana Menü"
              >
                <Home className="w-5 h-5 text-slate-300" />
              </button>
              {/* PTS ikonu ve başlığı sadece desktop'ta görünür */}
              <div className="hidden md:flex w-8 h-8 bg-primary-600 rounded items-center justify-center shadow-lg shadow-primary-600/30 flex-shrink-0">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-slate-100 flex-shrink-0">PTS</h1>
            </div>

            {/* Orta - Arama (Desktop'ta) + İşlem Butonları */}
            <div className="flex items-center gap-2 flex-1 justify-end md:justify-start">
              {/* Arama Input - Sadece Desktop için üst satırda */}
              <div className="hidden md:block relative flex-1 max-w-md">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Transfer ID, Belge No, GLN, Cari..."
                  className="w-full pl-8 pr-2 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                />
              </div>

              {/* Bildirilenleri Gizle Checkbox - Sadece desktop, indir butonunun solunda */}
              <label className="hidden md:flex items-center gap-2 cursor-pointer text-sm text-slate-300 hover:text-slate-100 transition-colors flex-shrink-0">
                <input
                  type="checkbox"
                  checked={hideNotified}
                  onChange={(e) => setHideNotified(e.target.checked)}
                  className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500/50 focus:ring-offset-0"
                />
                <span>Bildirilenleri Gizle</span>
              </label>

              {/* İndir Butonu */}
              <button
                type="button"
                onClick={handleSearchByDate}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1.5 text-xs md:text-sm bg-emerald-600 text-white rounded shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 ${loading ? 'animate-bounce' : ''}`} />
                <span className="hidden sm:inline">İndir</span>
              </button>

              {/* Tarih Aralığı */}
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={handleStartDateChange}
                  className="w-[100px] md:w-auto px-1 md:px-2 py-1.5 text-xs md:text-sm bg-dark-800 border border-dark-600 rounded text-slate-100 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                  disabled={loading}
                />
                <span className="text-slate-500 font-bold text-xs">→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={handleEndDateChange}
                  className="w-[100px] md:w-auto px-1 md:px-2 py-1.5 text-xs md:text-sm bg-dark-800 border border-dark-600 rounded text-slate-100 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                  disabled={loading}
                />
              </div>

              {/* Tarih Tipi Seçimi - Sadece desktop */}
              <select
                value={dateFilterType}
                onChange={(e) => setDateFilterType(e.target.value)}
                className="hidden md:block px-2 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded text-slate-100 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                disabled={loading}
              >
                <option value="created">Kayıt Tarihi</option>
                <option value="document">Belge Tarihi</option>
              </select>

              {/* Listele Butonu */}
              <button
                type="button"
                onClick={handleListPackages}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1.5 text-xs md:text-sm bg-primary-600 text-white rounded shadow-lg shadow-primary-600/30 hover:bg-primary-500 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Listele</span>
              </button>
            </div>
          </div>

          {/* Alt Satır - Arama (Mobil için) */}
          <div className="flex md:hidden items-center gap-2 mt-2">
            {/* Arama Input */}
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Transfer ID, Belge No, GLN, Cari..."
                className="w-full pl-8 pr-2 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
              />
            </div>
            {/* Mobil Filtreler */}
            <div className="flex md:hidden items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={hideNotified}
                  onChange={(e) => setHideNotified(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-dark-600 bg-dark-800 text-primary-500"
                />
                <span>Gizle</span>
              </label>
              <select
                value={dateFilterType}
                onChange={(e) => setDateFilterType(e.target.value)}
                className="px-1.5 py-1 text-xs bg-dark-800 border border-dark-600 rounded text-slate-100"
                disabled={loading}
              >
                <option value="created">Kayıt T.</option>
                <option value="document">Belge T.</option>
              </select>
            </div>
          </div>
        </div>
      </div>


      {message && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border backdrop-blur-sm min-w-[300px] max-w-[450px] ${message.type === 'success' ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500/50' :
            message.type === 'error' ? 'bg-rose-900/90 text-rose-100 border-rose-500/50' :
              message.type === 'warning' ? 'bg-amber-900/90 text-amber-100 border-amber-500/50' :
                'bg-primary-900/90 text-primary-100 border-primary-500/50'
            }`}>
            {/* İkon */}
            <div className="flex-shrink-0">
              {message.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
              {message.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
              {message.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {message.type === 'info' && <Info className="w-5 h-5 text-primary-400" />}
              {!['success', 'error', 'warning', 'info'].includes(message.type) && <Info className="w-5 h-5 text-primary-400" />}
            </div>
            {/* Mesaj */}
            <span className="flex-1 text-sm font-medium">{message.text.replace(/^[⚠️❌✅ℹ️]+\s*/, '')}</span>
            {/* Kapat Butonu */}
            <button
              onClick={() => setMessage(null)}
              className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Paket Listesi - AG Grid Dark Theme */}
      <div className="flex-1 px-2 md:px-6 py-2 md:py-4 flex flex-col min-h-0">
        {listData.length > 0 ? (
          /* Liste Görünümü */
          <div className="ag-theme-alpine ag-pagination-visible rounded-xl overflow-hidden border border-dark-700 flex-1 relative">
            <AgGridReact
              ref={gridRef}
              rowData={filteredData}
              columnDefs={listColumnDefs}
              defaultColDef={{
                sortable: true,
                resizable: true,
                headerClass: 'ag-header-cell-center'
              }}
              enableCellTextSelection={true}
              ensureDomOrder={true}
              rowClass="cursor-pointer hover:bg-dark-700/50"
              animateRows={true}
              rowHeight={isMobile ? 40 : 50}
              headerHeight={isMobile ? 32 : 48}
              pagination={true}
              paginationPageSize={100}
              paginationPageSizeSelector={[25, 50, 100, 200]}
              localeText={{
                page: 'Sayfa',
                to: '-',
                of: '/',
                next: 'Sonraki',
                last: 'Son',
                first: 'İlk',
                previous: 'Önceki',
                loadingOoo: 'Yükleniyor...',
                noRowsToShow: 'Gösterilecek kayıt yok',
                pageSizeSelectorLabel: 'Sayfa Başına:'
              }}
              onGridReady={onGridReady}
              onColumnMoved={saveColumnState}
              onColumnResized={saveColumnState}
              onSortChanged={saveColumnState}
              onRowDoubleClicked={(event) => {
                // Çift tıklayınca PTSDetailPage'e git
                const transferId = event.data.TRANSFER_ID
                if (transferId) {
                  // Geri gelince otomatik yenileme için işaretle
                  localStorage.setItem('pts_autoLoad', 'true')
                  navigate(`/pts/${transferId}`)
                }
              }}
            />
            {/* Pagination içinde sol tarafa bilgi mesajı - Sadece desktop */}
            <div className="hidden md:flex absolute bottom-0 left-0 h-[48px] items-center px-4 text-xs text-slate-500 gap-1.5 pointer-events-none">
              <Info className="w-3.5 h-3.5" />
              <span>PTS içeriği için satıra çift tıklayın</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Package className="w-16 h-16 mb-4" />
            <p className="text-lg font-medium">Henüz kayıt listelenmedi</p>
            <p className="text-sm">Tarih aralığı seçip "Listele" butonuna tıklayın</p>
          </div>
        )}
      </div>

      {/* İndirme Progress Modal - Dark Theme */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-dark-800 rounded-2xl shadow-dark-xl border border-dark-700 w-full max-w-md">
            {/* Header with Status */}
            <div className="bg-gradient-to-r from-primary-600/30 to-cyan-600/30 border-b border-primary-500/30 rounded-t-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-500/20 border border-primary-500/30 rounded-lg flex items-center justify-center">
                  {downloadProgress.status === 'searching' && (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-400 border-t-transparent"></div>
                  )}
                  {downloadProgress.status === 'downloading' && (
                    <svg className="w-6 h-6 text-primary-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                  )}
                  {downloadProgress.status === 'completed' && (
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  )}
                  {downloadProgress.status === 'error' && (
                    <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-100">
                    {downloadProgress.status === 'searching' && '🔍 Paketler Aranıyor...'}
                    {downloadProgress.status === 'downloading' && '📥 İndiriliyor...'}
                    {downloadProgress.status === 'completed' && '✅ Tamamlandı!'}
                    {downloadProgress.status === 'error' && '❌ Hata Oluştu'}
                  </h3>
                  {downloadProgress.total > 0 && (
                    <p className="text-sm text-slate-400 font-medium">
                      {downloadProgress.downloaded + downloadProgress.skipped} / {downloadProgress.total} paket işlendi
                    </p>
                  )}
                </div>
                {/* Kapat Butonu (X) */}
                <button
                  onClick={closeDownloadModal}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  title="Kapat (ESC)"
                >
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-200" />
                </button>
              </div>
              {/* Tarih Bilgisi */}
              <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                <span className="px-2 py-1 bg-dark-700/50 rounded text-slate-300 border border-dark-600">
                  {new Date(startDate).toLocaleDateString('tr-TR')}
                </span>
                <span className="text-slate-500">→</span>
                <span className="px-2 py-1 bg-dark-700/50 rounded text-slate-300 border border-dark-600">
                  {new Date(endDate).toLocaleDateString('tr-TR')}
                </span>
                <span className="text-xs text-slate-500 ml-2">
                  ({dateFilterType === 'document' ? 'Belge Tarihi' : 'Kayıt Tarihi'})
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">

              {/* Progress Bar */}
              {downloadProgress.total > 0 && downloadProgress.status === 'downloading' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>İlerleme</span>
                    <span className="font-bold text-slate-200">
                      {Math.round(((downloadProgress.downloaded + downloadProgress.skipped + downloadProgress.failed) / downloadProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-dark-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                      style={{
                        width: `${Math.min(100, ((downloadProgress.downloaded + downloadProgress.skipped + downloadProgress.failed) / downloadProgress.total) * 100)}%`,
                        background: 'linear-gradient(90deg, #0891b2 0%, #06b6d4 50%, #0891b2 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 2s linear infinite'
                      }}
                    >
                    </div>
                  </div>
                </div>
              )}

              {/* Statistics */}
              {downloadProgress.total > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {/* Toplam */}
                  <div className="bg-dark-700/50 rounded-lg p-3 text-center border border-dark-600">
                    <div className="text-2xl font-bold text-slate-200">{downloadProgress.total}</div>
                    <div className="text-xs text-slate-500 mt-1">Toplam</div>
                  </div>

                  {/* İndirilen */}
                  <div className="bg-emerald-500/20 rounded-lg p-3 text-center border border-emerald-500/30">
                    <div className="text-2xl font-bold text-emerald-400">{downloadProgress.downloaded}</div>
                    <div className="text-xs text-emerald-500 mt-1">İndirilen</div>
                  </div>

                  {/* Atlandı */}
                  <div className="bg-primary-500/20 rounded-lg p-3 text-center border border-primary-500/30">
                    <div className="text-2xl font-bold text-primary-400">{downloadProgress.skipped}</div>
                    <div className="text-xs text-primary-500 mt-1">Atlandı</div>
                  </div>

                  {/* Başarısız */}
                  <div className={`rounded-lg p-3 text-center border ${downloadProgress.failed > 0
                    ? 'bg-rose-500/20 border-rose-500/30'
                    : 'bg-dark-700/50 border-dark-600'
                    }`}>
                    <div className={`text-2xl font-bold ${downloadProgress.failed > 0 ? 'text-rose-400' : 'text-slate-600'
                      }`}>
                      {downloadProgress.failed}
                    </div>
                    <div className={`text-xs mt-1 ${downloadProgress.failed > 0 ? 'text-rose-500' : 'text-slate-600'
                      }`}>
                      Hatalı
                    </div>
                  </div>
                </div>
              )}

              {/* Info Message */}
              {downloadProgress.skipped > 0 && downloadProgress.status === 'completed' && (
                <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3">
                  <p className="text-sm text-primary-400">
                    <span className="font-semibold">💡 Not:</span> {downloadProgress.skipped} paket zaten NETSIS veritabanında mevcut olduğu için atlandı.
                  </p>
                </div>
              )}

              {/* Hatalı Paketler Listesi */}
              {downloadProgress.failedPackages && downloadProgress.failedPackages.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                  <p className="text-sm text-rose-400 font-semibold mb-2">
                    ❌ Hatalı Paketler ({downloadProgress.failedPackages.length})
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {downloadProgress.failedPackages.map((pkg, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <span className="font-mono text-rose-300 flex-shrink-0">{pkg.transferId}</span>
                        <span className="text-slate-400">-</span>
                        <span className="text-slate-300 break-all">{pkg.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Button */}
            {(downloadProgress.status === 'completed' || downloadProgress.status === 'error') && (
              <div className="px-6 pb-6">
                <button
                  onClick={closeDownloadModal}
                  className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-500 transition-all shadow-lg shadow-primary-600/30"
                >
                  Kapat ve Listeyi Yenile
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PTSPage
