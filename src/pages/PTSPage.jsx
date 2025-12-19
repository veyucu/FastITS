import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Home, Truck, Search, Download, RefreshCw, List } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import apiService from '../services/apiService'

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
  const navigate = useNavigate()
  const gridRef = useRef(null)
  
  // LocalStorage'dan tarih ayarlarını oku
  const getStoredValue = (key, defaultValue) => {
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
    getStoredValue('pts_startDate', new Date().toISOString().split('T')[0])
  )
  const [endDate, setEndDate] = useState(() => 
    getStoredValue('pts_endDate', new Date().toISOString().split('T')[0])
  )
  const [dateFilterType, setDateFilterType] = useState(() => 
    getStoredValue('pts_dateFilterType', 'document') // Varsayılan: Belge Tarihi
  )
  const [listData, setListData] = useState([]) // Grid için liste verisi
  const [searchText, setSearchText] = useState(() => 
    getStoredValue('pts_searchText', '')
  ) // Arama metni
  const [initialLoadDone, setInitialLoadDone] = useState(false) // İlk yükleme kontrolü
  
  // İndirme modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState({
    total: 0,
    current: 0,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    status: 'idle' // idle, searching, downloading, completed, error
  })

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

    try {
      // Modal'ı aç ve ilk durumu ayarla
      setShowDownloadModal(true)
      setDownloadProgress({
        total: 0,
        current: 0,
        downloaded: 0,
        skipped: 0,
        failed: 0,
        status: 'searching'
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
      await apiService.downloadBulkPackagesStream(
        startDate, 
        endDate, 
        (progressData) => {
          // Her progress güncellemesinde state'i güncelle
          setDownloadProgress({
            total: progressData.total || 0,
            current: progressData.current || 0,
            downloaded: progressData.downloaded || 0,
            skipped: progressData.skipped || 0,
            failed: progressData.failed || 0,
            status: progressData.status
          })
        }
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

  // Arama filtresi uygula - Tüm alanlarda ara
  const filteredData = useMemo(() => {
    if (!searchText.trim()) return listData

    const searchLower = searchText.toLowerCase().trim()
    
    return listData.filter(item => {
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
  }, [listData, searchText])

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
      headerName: 'Transfer ID',
      field: 'TRANSFER_ID',
      width: 180,
      cellClass: 'font-mono font-bold text-blue-600 cursor-pointer',
      filter: 'agTextColumnFilter'
    },
    {
      headerName: 'Belge Tarihi',
      field: 'DOCUMENT_DATE',
      width: 130,
      cellClass: 'text-center',
      valueFormatter: (params) => {
        if (!params.value) return ''
        const date = new Date(params.value)
        return date.toLocaleDateString('tr-TR')
      },
      filter: 'agDateColumnFilter'
    },
    {
      headerName: 'Belge No',
      field: 'DOCUMENT_NUMBER',
      width: 150,
      cellClass: 'font-semibold',
      filter: 'agTextColumnFilter'
    },
    {
      headerName: 'Source GLN',
      field: 'SOURCE_GLN',
      width: 160,
      cellClass: 'font-mono text-sm',
      filter: 'agTextColumnFilter'
    },
    {
      headerName: 'Cari İsim',
      field: 'SOURCE_GLN_NAME',
      width: 200,
      cellClass: 'font-semibold',
      filter: 'agTextColumnFilter'
    },
    {
      headerName: 'Kalem',
      field: 'UNIQUE_GTIN_COUNT',
      width: 110,
      cellClass: 'text-center',
      filter: 'agNumberColumnFilter',
      cellRenderer: (params) => <BadgeRenderer value={params.value} type="kalem" />
    },
    {
      headerName: 'Adet',
      field: 'TOTAL_PRODUCT_COUNT',
      width: 110,
      cellClass: 'text-center',
      filter: 'agNumberColumnFilter',
      cellRenderer: (params) => <BadgeRenderer value={params.value} type="adet" />
    },
    {
      headerName: 'Kayıt Tarihi',
      field: 'CREATED_DATE',
      width: 150,
      cellClass: 'text-center text-gray-600',
      valueFormatter: (params) => {
        if (!params.value) return ''
        const date = new Date(params.value)
        return date.toLocaleString('tr-TR')
      },
      filter: 'agDateColumnFilter'
    },
    {
      headerName: 'Durum',
      field: 'DURUM',
      width: 120,
      cellClass: 'text-center font-semibold',
      filter: 'agTextColumnFilter'
    },
    {
      headerName: 'Bildirim Tarihi',
      field: 'BILDIRIM_TARIHI',
      width: 150,
      cellClass: 'text-center text-gray-600',
      valueFormatter: (params) => {
        if (!params.value) return ''
        const date = new Date(params.value)
        return date.toLocaleString('tr-TR')
      },
      filter: 'agDateColumnFilter'
    },
    {
      headerName: 'Aksiyon Tipi',
      field: 'ACTION_TYPE',
      width: 120,
      cellClass: 'text-center',
      filter: 'agTextColumnFilter'
    },
    {
      headerName: 'Note',
      field: 'NOTE',
      width: 200,
      cellClass: 'text-sm text-gray-600',
      filter: 'agTextColumnFilter'
    }
  ], [])

  return (
    <div className="flex flex-col h-screen bg-dark-950">
      {/* Header - Dark Theme */}
      <div className="bg-dark-900/80 backdrop-blur-sm border-b border-dark-700">
        <div className="px-6 py-3">
          <div className="flex items-center gap-4">
            {/* Sol - Başlık ve Arama */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="w-8 h-8 bg-dark-700 rounded flex items-center justify-center hover:bg-dark-600 transition-colors border border-dark-600"
                title="Ana Menü"
              >
                <Home className="w-5 h-5 text-slate-300" />
              </button>
              <div className="w-8 h-8 bg-primary-600 rounded flex items-center justify-center shadow-lg shadow-primary-600/30">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-slate-100">PTS</h1>
              
              {/* Arama Input */}
              <div className="relative w-96 ml-4">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Transfer ID, Belge No, Source GLN veya Cari İsim..."
                  className="w-full pl-8 pr-2 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Sağ - İşlem Butonları ve Filtreler */}
            <div className="flex items-center gap-3 ml-auto">

              {/* İndir Butonu */}
              <button
                type="button"
                onClick={handleSearchByDate}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 ${loading ? 'animate-bounce' : ''}`} />
                İndir
              </button>

              {/* Tarih Aralığı */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={handleStartDateChange}
                  className="px-2 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded text-slate-100 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                  disabled={loading}
                />
                <span className="text-slate-500 font-bold">→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={handleEndDateChange}
                  className="px-2 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded text-slate-100 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                  disabled={loading}
                />
              </div>

              {/* Tarih Tipi Seçimi */}
              <select
                value={dateFilterType}
                onChange={(e) => setDateFilterType(e.target.value)}
                className="px-2 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded text-slate-100 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded shadow-lg shadow-primary-600/30 hover:bg-primary-500 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Listele
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Mesaj Alanı - Dark Theme */}
      {message && (
        <div className="px-6 py-2">
          <div className={`p-3 rounded-lg text-sm font-medium border ${
            message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
            message.type === 'error' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
            message.type === 'warning' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
            'bg-primary-500/20 text-primary-400 border-primary-500/30'
          }`}>
            {message.text}
          </div>
        </div>
      )}

      {/* Paket Listesi - AG Grid Dark Theme */}
      <div className="flex-1 px-6 py-4 flex flex-col min-h-0">
        {listData.length > 0 ? (
          /* Liste Görünümü */
          <div className="ag-theme-alpine rounded-xl overflow-hidden border border-dark-700 flex-1">
            <AgGridReact
              ref={gridRef}
              rowData={filteredData}
              columnDefs={listColumnDefs}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                headerClass: 'ag-header-cell-center'
              }}
              animateRows={true}
              rowHeight={50}
              headerHeight={48}
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
                  <div className={`rounded-lg p-3 text-center border ${
                    downloadProgress.failed > 0 
                      ? 'bg-rose-500/20 border-rose-500/30' 
                      : 'bg-dark-700/50 border-dark-600'
                  }`}>
                    <div className={`text-2xl font-bold ${
                      downloadProgress.failed > 0 ? 'text-rose-400' : 'text-slate-600'
                    }`}>
                      {downloadProgress.failed}
                    </div>
                    <div className={`text-xs mt-1 ${
                      downloadProgress.failed > 0 ? 'text-rose-500' : 'text-slate-600'
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
            </div>

            {/* Footer Button */}
            {(downloadProgress.status === 'completed' || downloadProgress.status === 'error') && (
              <div className="px-6 pb-6">
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-500 transition-all shadow-lg shadow-primary-600/30"
                >
                  Kapat
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
