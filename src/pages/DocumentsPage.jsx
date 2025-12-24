import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { Package, Search, RefreshCw, Wifi, WifiOff, ChevronLeft, ChevronRight, Calendar, Clock, CheckCircle, AlertCircle, Home } from 'lucide-react'
import apiService from '../services/apiService'
import usePageTitle from '../hooks/usePageTitle'

const DocumentsPage = () => {
  usePageTitle('Ürün Hazırlama')
  const navigate = useNavigate()
  const gridRef = useRef(null)

  // LocalStorage'dan filtreleri yükle
  const loadFilters = () => {
    try {
      const saved = localStorage.getItem('documentsPageFilters')
      if (saved) {
        const filters = JSON.parse(saved)
        return {
          searchText: filters.searchText || '',
          docTypeFilter: filters.docTypeFilter || 'all',
          dateFilter: filters.dateFilter || new Date().toISOString().split('T')[0], // Varsayılan bugün
          hideCompleted: filters.hideCompleted || false
        }
      }
    } catch (error) {
      console.error('Filter yükleme hatası:', error)
    }
    return {
      searchText: '',
      docTypeFilter: 'all',
      dateFilter: new Date().toISOString().split('T')[0], // Varsayılan bugün
      hideCompleted: false
    }
  }

  const savedFilters = loadFilters()

  const [searchText, setSearchText] = useState(savedFilters.searchText)
  const [statusFilter, setStatusFilter] = useState('all')
  const [docTypeFilter, setDocTypeFilter] = useState(savedFilters.docTypeFilter)
  const [dateFilter, setDateFilter] = useState(savedFilters.dateFilter)
  const [hideCompleted, setHideCompleted] = useState(savedFilters.hideCompleted) // Okutulanları gizle
  const [rowData, setRowData] = useState([])
  const [allOrders, setAllOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [serverStatus, setServerStatus] = useState('checking') // checking, online, offline
  const [isInitialLoad, setIsInitialLoad] = useState(true) // İlk yükleme kontrolü

  // Belge Tipi Gösterimi - Dark Theme
  const DocTypeRenderer = ({ value }) => {
    const types = {
      '6': { text: 'Sipariş', color: 'bg-violet-500/20 text-violet-400 border border-violet-500/30' },
      '1': { text: 'Satış Faturası', color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
      '2': { text: 'Alış Faturası', color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' }
    }
    const type = types[value] || { text: 'Bilinmeyen', color: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${type.color}`}>
        {type.text}
      </span>
    )
  }

  // Badge Renderer - Dark Theme
  const BadgeRenderer = ({ value, type = 'default' }) => {
    const styles = {
      kalem: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
      miktar: 'bg-primary-500/20 text-primary-400 border border-primary-500/30',
      okutulan: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      kalan: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      default: 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
    }

    // Kalan sütunu için özel gösterim
    if (type === 'kalan' && (value === 0 || value === '0')) {
      return (
        <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          ✓
        </span>
      )
    }

    return (
      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-sm font-bold ${styles[type]}`}>
        {value || 0}
      </span>
    )
  }

  // Column Definitions
  const columnDefs = useMemo(() => [
    {
      headerName: 'Belge Tipi',
      field: 'docType',
      width: 140,
      cellRenderer: (params) => <DocTypeRenderer value={params.value} />,
      wrapHeaderText: true,
      autoHeaderHeight: true
    },
    {
      headerName: 'Belge No',
      field: 'orderNo',
      width: 150,
      pinned: 'left',
      cellClass: 'font-semibold text-blue-600',
      wrapHeaderText: true,
      autoHeaderHeight: true
    },
    {
      headerName: 'Saat',
      field: 'kayitTarihi',
      width: 90,
      valueFormatter: (params) => {
        if (!params.value) return '';
        try {
          const date = new Date(params.value);
          if (isNaN(date.getTime())) return '';
          return date.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (error) {
          return '';
        }
      },
      wrapHeaderText: true,
      autoHeaderHeight: true
    },
    {
      headerName: 'Cari İsim',
      field: 'customerName',
      width: 250,
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellRenderer: (params) => {
        const { customerName, district, city } = params.data
        const location = district ? `${district} / ${city}` : city || ''
        return (
          <div className="flex items-center gap-2 w-full">
            <span className="truncate font-medium">{customerName}</span>
            {location && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 shrink-0">{location}</span>
              </>
            )}
          </div>
        )
      }
    },
    {
      headerName: 'Kalem',
      field: 'totalItems',
      width: 140,
      cellClass: 'text-center',
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRenderer: (params) => {
        const { itsCount, utsCount, dgrCount } = params.data

        return (
          <div className="flex items-center justify-center gap-1">
            {itsCount > 0 && (
              <span className="px-2.5 py-1 rounded text-sm font-bold bg-blue-100 text-blue-700 border border-blue-200 shadow-sm min-w-[32px]" title="ITS">
                {itsCount}
              </span>
            )}
            {utsCount > 0 && (
              <span className="px-2.5 py-1 rounded text-sm font-bold bg-red-100 text-red-700 border border-red-200 shadow-sm min-w-[32px]" title="UTS">
                {utsCount}
              </span>
            )}
            {dgrCount > 0 && (
              <span className="px-2.5 py-1 rounded text-sm font-bold bg-gray-100 text-gray-700 border border-gray-200 shadow-sm min-w-[32px]" title="DGR">
                {dgrCount}
              </span>
            )}
          </div>
        )
      }
    },
    {
      headerName: 'Miktar',
      field: 'miktar',
      width: 110,
      cellClass: 'text-center',
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellStyle: { justifyContent: 'center' },
      cellRenderer: (params) => <BadgeRenderer value={params.value} type="miktar" />
    },
    {
      headerName: 'Okutulan',
      field: 'okutulan',
      width: 120,
      cellClass: 'text-center',
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellStyle: { justifyContent: 'center' },
      cellRenderer: (params) => <BadgeRenderer value={params.value} type="okutulan" />
    },
    {
      headerName: 'Kalan',
      field: 'kalan',
      width: 110,
      cellClass: 'text-center',
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellStyle: { justifyContent: 'center' },
      cellRenderer: (params) => <BadgeRenderer value={params.value} type="kalan" />
    },
    {
      headerName: 'ITS',
      field: 'itsDurum',
      width: 70,
      cellClass: 'text-center',
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRenderer: (params) => {
        const durum = params.value
        if (durum === 'OK') {
          return (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" title="ITS Bildirimi Yapıldı">
              ✓
            </span>
          )
        }
        // NOK veya boş ise
        return (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/30" title="ITS Bildirimi Yapılmadı">
            -
          </span>
        )
      }
    }
  ], [])

  // Default Column Properties
  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: false
  }), [])

  // Excel Export
  const onExportExcel = useCallback(() => {
    if (!gridRef.current) return

    const params = {
      fileName: `Urun_Hazirlama_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.xlsx`,
      sheetName: 'Ürün Hazırlama',
      columnKeys: ['docType', 'orderNo', 'kayitTarihi', 'customerName', 'customerCode', 'district', 'city', 'phone', 'totalItems', 'miktar', 'okutulan', 'kalan'],
      processCellCallback: (params) => {
        // Belge tipi için text'e çevir
        if (params.column.colId === 'docType') {
          const types = { '6': 'Sipariş', '1': 'Satış Faturası', '2': 'Alış Faturası' }
          return types[params.value] || params.value
        }
        // Saat formatı
        if (params.column.colId === 'kayitTarihi' && params.value) {
          try {
            const date = new Date(params.value)
            if (isNaN(date.getTime())) return params.value
            return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          } catch (error) {
            return params.value
          }
        }
        // Kalem sütunu için ITS/UTS/DGR detayı
        if (params.column.colId === 'totalItems') {
          const { itsCount, utsCount, dgrCount } = params.node.data
          const parts = []
          if (itsCount > 0) parts.push(`ITS:${itsCount}`)
          if (utsCount > 0) parts.push(`UTS:${utsCount}`)
          if (dgrCount > 0) parts.push(`DGR:${dgrCount}`)
          return parts.length > 0 ? parts.join(' | ') : params.value
        }
        // Kalan sütunu için - 0 ise ✓
        if (params.column.colId === 'kalan') {
          return params.value === 0 || params.value === '0' ? '✓' : params.value
        }
        return params.value
      }
    }
    gridRef.current.api.exportDataAsExcel(params)
  }, [])

  // Row Double Click Handler
  const onRowDoubleClicked = useCallback((event) => {
    navigate(`/documents/${event.data.id}`)
  }, [navigate])

  // Fetch Documents from API (tarih zorunlu)
  const fetchDocuments = async () => {
    try {
      setLoading(true)
      setError(null)

      // Tarih zorunlu
      const date = dateFilter || new Date().toISOString().split('T')[0]

      const response = await apiService.getDocuments(date)

      if (response.success && response.data) {
        setAllOrders(response.data)
        // İlk yüklemede filtreleme yapma, tüm veriyi göster
        setRowData(response.data)
        setServerStatus('online')
        setIsInitialLoad(false)
      } else {
        throw new Error(response.message || 'Veri alınamadı')
      }
    } catch (err) {
      console.error('Sipariş yükleme hatası:', err)
      setError(err.message || 'Sunucuya bağlanılamadı')
      setServerStatus('offline')
      setIsInitialLoad(false)
    } finally {
      setLoading(false)
    }
  }

  // Check server health
  const checkServerHealth = async () => {
    try {
      await apiService.healthCheck()
      setServerStatus('online')
    } catch (err) {
      setServerStatus('offline')
    }
  }

  // Initial load
  useEffect(() => {
    fetchDocuments()

    // Her 30 saniyede bir sunucu durumunu kontrol et
    const healthCheckInterval = setInterval(checkServerHealth, 30000)

    return () => clearInterval(healthCheckInterval)
  }, [])

  // Filtreleri localStorage'a kaydet
  useEffect(() => {
    const filters = {
      searchText,
      docTypeFilter,
      dateFilter,
      hideCompleted
    }
    localStorage.setItem('documentsPageFilters', JSON.stringify(filters))
  }, [searchText, docTypeFilter, dateFilter, hideCompleted])

  // Tarih değiştiğinde backend'den yeni veri çek
  useEffect(() => {
    if (!isInitialLoad && dateFilter) {
      fetchDocuments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter])

  // Diğer filtreler değiştiğinde client-side filtrele
  useEffect(() => {
    if (!isInitialLoad && allOrders.length > 0) {
      handleFilter()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docTypeFilter, statusFilter, searchText, hideCompleted, allOrders, isInitialLoad])

  // Filter Handler - Client-side filtreleme
  const handleFilter = () => {
    let filtered = allOrders

    // Belge tipi filtresi
    if (docTypeFilter !== 'all') {
      filtered = filtered.filter(order => order.docType === docTypeFilter)
    }

    // Durum filtresi
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter)
    }

    // Tamamlananları gizle (kalan = 0 olanları filtrele)
    if (hideCompleted) {
      filtered = filtered.filter(order => order.kalan > 0)
    }

    // Arama filtresi
    if (searchText) {
      const search = searchText.toLowerCase()
      filtered = filtered.filter(order =>
        order.orderNo?.toLowerCase().includes(search) ||
        order.customerName?.toLowerCase().includes(search) ||
        order.customerCode?.toLowerCase().includes(search) ||
        order.city?.toLowerCase().includes(search) ||
        order.district?.toLowerCase().includes(search)
      )
    }

    setRowData(filtered)
  }

  // Tarih değiştirme fonksiyonları
  const changeDateByDays = (days) => {
    try {
      let baseDate
      if (dateFilter) {
        baseDate = new Date(dateFilter)
        if (isNaN(baseDate.getTime())) {
          baseDate = new Date() // Geçersizse bugünü kullan
        }
      } else {
        baseDate = new Date()
      }

      baseDate.setDate(baseDate.getDate() + days)
      const newDate = baseDate.toISOString().split('T')[0]
      setDateFilter(newDate)
    } catch (error) {
      console.error('Tarih değiştirme hatası:', error)
      // Hata durumunda bugüne dön
      const today = new Date().toISOString().split('T')[0]
      setDateFilter(today)
    }
  }

  const goToPreviousDate = () => changeDateByDays(-1)
  const goToNextDate = () => changeDateByDays(1)

  // Reset Filters
  const handleReset = () => {
    setSearchText('')
    setStatusFilter('all')
    setDocTypeFilter('all')
    setHideCompleted(false)
    const today = new Date().toISOString().split('T')[0]
    setDateFilter(today) // Bugüne sıfırla
    setRowData(allOrders)

    // LocalStorage'ı temizle
    localStorage.removeItem('documentsPageFilters')
    localStorage.removeItem('documentsGridColumnState')
    localStorage.removeItem('documentsGridPage')

    // Grid'i varsayılan haline getir
    if (gridRef.current) {
      gridRef.current.api.resetColumnState()
      gridRef.current.api.sizeColumnsToFit()
      gridRef.current.api.paginationGoToFirstPage()
    }
  }

  // Refresh data
  const handleRefresh = () => {
    fetchDocuments()
  }

  // Statistics - Filtrelenmiş veriye göre hesapla
  const stats = useMemo(() => {
    const total = rowData.length
    const completed = rowData.filter(o => o.kalan === 0).length // Tamamlanan (kalan = 0)
    const partial = rowData.filter(o => o.okutulan > 0 && o.kalan > 0).length // Yarım (okutulan > 0 ve kalan > 0)
    const pending = rowData.filter(o => o.okutulan === 0).length // Bekleyen (okutulan = 0)

    return { total, completed, partial, pending }
  }, [rowData])

  return (
    <div className="flex flex-col h-screen bg-dark-950">
      {/* Header - Dark Theme */}
      <div className="bg-dark-900/80 backdrop-blur-sm border-b border-dark-700">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Sol - Başlık */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="w-8 h-8 bg-dark-700 rounded flex items-center justify-center hover:bg-dark-600 transition-colors border border-dark-600"
                title="Ana Menü"
              >
                <Home className="w-5 h-5 text-slate-300" />
              </button>
              <div className="w-8 h-8 bg-primary-600 rounded flex items-center justify-center shadow-lg shadow-primary-600/30">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-slate-100">Ürün Hazırlama</h1>
            </div>

            {/* Orta - İstatistikler */}
            <div className="flex items-center gap-2">
              <div className="bg-primary-600/20 border border-primary-500/30 rounded px-3 py-1.5 text-primary-400">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" />
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-medium opacity-90">Toplam:</span>
                    <span className="text-base font-bold">{stats.total}</span>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-600/20 border border-emerald-500/30 rounded px-3 py-1.5 text-emerald-400">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-medium opacity-90">Okutulan:</span>
                    <span className="text-base font-bold">{stats.completed}</span>
                  </div>
                </div>
              </div>

              <div className="bg-violet-600/20 border border-violet-500/30 rounded px-3 py-1.5 text-violet-400">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-medium opacity-90">Yarım:</span>
                    <span className="text-base font-bold">{stats.partial}</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-600/20 border border-amber-500/30 rounded px-3 py-1.5 text-amber-400">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-medium opacity-90">Bekleyen:</span>
                    <span className="text-base font-bold">{stats.pending}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sağ - Server Status */}
            <div>
              {serverStatus === 'online' && (
                <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-medium">
                  <Wifi className="w-3 h-3" />
                  Bağlı
                </span>
              )}
              {serverStatus === 'offline' && (
                <span className="flex items-center gap-1 px-2 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-xs font-medium">
                  <WifiOff className="w-3 h-3" />
                  Bağlantı Yok
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters - Dark Theme */}
      <div className="px-6 py-2 bg-dark-800/50 border-b border-dark-700">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Belge Tipi Filtreleri */}
          <div className="flex gap-1">
            <button
              onClick={() => setDocTypeFilter('all')}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${docTypeFilter === 'all'
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                : 'bg-dark-700 text-slate-300 hover:bg-dark-600 border border-dark-600'
                }`}
            >
              Tümü
            </button>
            <button
              onClick={() => setDocTypeFilter('6')}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${docTypeFilter === '6'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                : 'bg-dark-700 text-slate-300 hover:bg-dark-600 border border-dark-600'
                }`}
            >
              Sipariş
            </button>
            <button
              onClick={() => setDocTypeFilter('1')}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${docTypeFilter === '1'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-dark-700 text-slate-300 hover:bg-dark-600 border border-dark-600'
                }`}
            >
              Satış
            </button>
            <button
              onClick={() => setDocTypeFilter('2')}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${docTypeFilter === '2'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'bg-dark-700 text-slate-300 hover:bg-dark-600 border border-dark-600'
                }`}
            >
              Alış
            </button>
          </div>

          <div className="h-6 w-px bg-dark-600"></div>

          {/* Okutulanları Gizle */}
          <label className="flex items-center gap-2 px-3 py-1.5 bg-dark-700/50 rounded cursor-pointer hover:bg-dark-600 transition-colors border border-dark-600">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded bg-dark-800 border-dark-500 focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-slate-300">Okutulanları Gizle</span>
          </label>

          <div className="h-6 w-px bg-dark-600"></div>

          {/* Tarih Filtresi */}
          <div className="flex items-center gap-1">
            <button
              onClick={goToPreviousDate}
              className="p-1.5 hover:bg-dark-600 rounded transition-all border border-dark-600"
              title="Önceki Gün"
            >
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-dark-600 rounded bg-dark-800 text-slate-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <button
              onClick={goToNextDate}
              className="p-1.5 hover:bg-dark-600 rounded transition-all border border-dark-600"
              title="Sonraki Gün"
            >
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="h-6 w-px bg-dark-600"></div>

          {/* Arama ve Diğer Filtreler */}
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Belge no, cari, şehir ara..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-dark-600 rounded bg-dark-800 text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-dark-700 text-slate-300 rounded hover:bg-dark-600 transition-all border border-dark-600"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sıfırla
            </button>

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded shadow-lg shadow-primary-600/30 hover:bg-primary-500 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Yenile
            </button>

            <button
              onClick={onExportExcel}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all"
            >
              📊 Excel
            </button>
          </div>
        </div>
      </div>

      {/* Loading & Error States - Dark Theme */}
      {loading && rowData.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-dark-700 border-t-primary-500 rounded-full mx-auto mb-4" />
            <p className="text-slate-400">Siparişler yükleniyor...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-100 mb-2">Bağlantı Hatası</h3>
            <p className="text-slate-400 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg shadow-lg shadow-primary-600/30 hover:bg-primary-500 transition-all"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      )}

      {/* AG Grid - Dark Theme */}
      {!loading && !error && (
        <div className="flex-1 px-6 py-2">
          <div className="ag-theme-alpine h-full rounded-xl shadow-dark-lg overflow-hidden border border-dark-700">
            <AgGridReact
              ref={gridRef}
              onGridReady={(params) => {
                gridRef.current = params

                // Kaydedilmiş grid durumunu yükle
                try {
                  const savedColumnState = localStorage.getItem('documentsGridColumnState')
                  if (savedColumnState) {
                    params.api.applyColumnState({
                      state: JSON.parse(savedColumnState),
                      applyOrder: true
                    })
                  } else {
                    params.api.sizeColumnsToFit()
                  }
                } catch (error) {
                  console.error('Grid state yükleme hatası:', error)
                  params.api.sizeColumnsToFit()
                }
              }}
              onColumnResized={(params) => {
                // Sütun genişliği değiştiğinde kaydet
                if (params.finished && gridRef.current) {
                  const columnState = gridRef.current.api.getColumnState()
                  localStorage.setItem('documentsGridColumnState', JSON.stringify(columnState))
                }
              }}
              onColumnMoved={(params) => {
                // Sütun sırası değiştiğinde kaydet
                if (params.finished && gridRef.current) {
                  const columnState = gridRef.current.api.getColumnState()
                  localStorage.setItem('documentsGridColumnState', JSON.stringify(columnState))
                }
              }}
              onSortChanged={(params) => {
                // Sıralama değiştiğinde kaydet
                if (gridRef.current) {
                  const columnState = gridRef.current.api.getColumnState()
                  localStorage.setItem('documentsGridColumnState', JSON.stringify(columnState))
                }
              }}
              onPaginationChanged={(params) => {
                // Sayfa değiştiğinde kaydet
                if (gridRef.current && params.newPage) {
                  const currentPage = params.api.paginationGetCurrentPage()
                  localStorage.setItem('documentsGridPage', currentPage.toString())
                }
              }}
              onFirstDataRendered={(params) => {
                // İlk veri yüklendiğinde kaydedilmiş sayfaya git
                try {
                  const savedPage = localStorage.getItem('documentsGridPage')
                  if (savedPage) {
                    params.api.paginationGoToPage(parseInt(savedPage))
                  }
                } catch (error) {
                  console.error('Sayfa yükleme hatası:', error)
                }
              }}
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              onRowDoubleClicked={onRowDoubleClicked}
              rowClass="cursor-pointer"
              animateRows={true}
              enableCellTextSelection={true}
              suppressCellFocus={true}
              localeText={{
                page: 'Sayfa',
                to: '-',
                of: '/',
                next: 'Sonraki',
                last: 'Son',
                first: 'İlk',
                previous: 'Önceki',
                loadingOoo: 'Yükleniyor...',
                noRowsToShow: 'Gösterilecek sipariş yok'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentsPage


