import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { Package, Search, Filter, RefreshCw, Wifi, WifiOff, ChevronLeft, ChevronRight, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import apiService from '../services/apiService'

const DocumentsPage = () => {
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
          dateFilter: filters.dateFilter || new Date().toISOString().split('T')[0] // Varsayılan bugün
        }
      }
    } catch (error) {
      console.error('Filter yükleme hatası:', error)
    }
    return {
      searchText: '',
      docTypeFilter: 'all',
      dateFilter: new Date().toISOString().split('T')[0] // Varsayılan bugün
    }
  }

  const savedFilters = loadFilters()
  
  const [searchText, setSearchText] = useState(savedFilters.searchText)
  const [statusFilter, setStatusFilter] = useState('all')
  const [docTypeFilter, setDocTypeFilter] = useState(savedFilters.docTypeFilter)
  const [dateFilter, setDateFilter] = useState(savedFilters.dateFilter)
  const [rowData, setRowData] = useState([])
  const [allOrders, setAllOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [serverStatus, setServerStatus] = useState('checking') // checking, online, offline
  const [isInitialLoad, setIsInitialLoad] = useState(true) // İlk yükleme kontrolü

  // Belge Tipi Gösterimi
  const DocTypeRenderer = ({ value }) => {
    const types = {
      '6': { text: 'Sipariş', color: 'bg-purple-100 text-purple-700' },
      '1': { text: 'Satış Faturası', color: 'bg-green-100 text-green-700' },
      '2': { text: 'Alış Faturası', color: 'bg-orange-100 text-orange-700' }
    }
    const type = types[value] || { text: 'Bilinmeyen', color: 'bg-gray-100 text-gray-700' }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${type.color}`}>
        {type.text}
      </span>
    )
  }

  // Badge Renderer - Sayısal değerler için
  const BadgeRenderer = ({ value, type = 'default' }) => {
    const styles = {
      kalem: 'bg-slate-100 text-slate-700 border border-slate-300',
      miktar: 'bg-blue-100 text-blue-700 border border-blue-300',
      okutulan: 'bg-green-100 text-green-700 border border-green-300',
      kalan: 'bg-orange-100 text-orange-700 border border-orange-300',
      default: 'bg-gray-100 text-gray-700 border border-gray-300'
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
      filter: 'agSetColumnFilter',
      wrapHeaderText: true,
      autoHeaderHeight: true
    },
    {
      headerName: 'Belge No',
      field: 'orderNo',
      width: 150,
      pinned: 'left',
      cellClass: 'font-semibold text-blue-600',
      filter: 'agTextColumnFilter',
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
      filter: false,
      wrapHeaderText: true,
      autoHeaderHeight: true
    },
    {
      headerName: 'Cari Kodu',
      field: 'customerCode',
      width: 120,
      filter: 'agTextColumnFilter',
      wrapHeaderText: true,
      autoHeaderHeight: true
    },
    {
      headerName: 'Cari İsim',
      field: 'customerName',
      width: 220,
      filter: 'agTextColumnFilter',
      wrapHeaderText: true,
      autoHeaderHeight: true
    },
    {
      headerName: 'İlçe',
      field: 'district',
      width: 120,
      filter: 'agTextColumnFilter',
      wrapHeaderText: true,
      autoHeaderHeight: true
    },
    {
      headerName: 'Şehir',
      field: 'city',
      width: 110,
      filter: 'agTextColumnFilter',
      wrapHeaderText: true,
      autoHeaderHeight: true
    },
    {
      headerName: 'Telefon',
      field: 'phone',
      width: 130,
      filter: 'agTextColumnFilter',
      wrapHeaderText: true,
      autoHeaderHeight: true
    },
    {
      headerName: 'Kalem',
      field: 'totalItems',
      width: 110,
      filter: 'agNumberColumnFilter',
      cellClass: 'text-center',
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellRenderer: (params) => <BadgeRenderer value={params.value} type="kalem" />
    },
    {
      headerName: 'Miktar',
      field: 'miktar',
      width: 110,
      filter: 'agNumberColumnFilter',
      cellClass: 'text-center',
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellRenderer: (params) => <BadgeRenderer value={params.value} type="miktar" />
    },
    {
      headerName: 'Okutulan',
      field: 'okutulan',
      width: 120,
      filter: 'agNumberColumnFilter',
      cellClass: 'text-center',
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellRenderer: (params) => <BadgeRenderer value={params.value} type="okutulan" />
    },
    {
      headerName: 'Kalan',
      field: 'kalan',
      width: 110,
      filter: 'agNumberColumnFilter',
      cellClass: 'text-center',
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellRenderer: (params) => <BadgeRenderer value={params.value} type="kalan" />
    }
  ], [])

  // Default Column Properties
  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: true
  }), [])

  // Excel Export
  const onExportExcel = useCallback(() => {
    if (!gridRef.current) return
    
    const params = {
      fileName: `Urun_Hazirlama_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.xlsx`,
      sheetName: 'Ürün Hazırlama',
      columnKeys: ['docType', 'orderNo', 'kayitTarihi', 'customerCode', 'customerName', 'district', 'city', 'phone', 'totalItems', 'miktar', 'okutulan', 'kalan'],
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
        return params.value
      }
    }
    gridRef.current.api.exportDataAsExcel(params)
  }, [])

  // Row Click Handler
  const onRowClicked = useCallback((event) => {
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
      dateFilter
    }
    localStorage.setItem('documentsPageFilters', JSON.stringify(filters))
  }, [searchText, docTypeFilter, dateFilter])

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
  }, [docTypeFilter, statusFilter, searchText, allOrders, isInitialLoad])

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

  // Statistics
  const stats = useMemo(() => {
    const total = allOrders.length
    const pending = allOrders.filter(o => o.status === 'pending').length
    const preparing = allOrders.filter(o => o.status === 'preparing').length
    const completed = allOrders.filter(o => o.status === 'completed').length
    
    return { total, pending, preparing, completed }
  }, [allOrders])

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header - Tek Satır */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Sol - Başlık */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">Ürün Hazırlama</h1>
            </div>
            
            {/* Orta - İstatistikler (Küçük) */}
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded px-3 py-1.5 text-white shadow-sm">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" />
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-medium opacity-90">Toplam:</span>
                    <span className="text-base font-bold">{stats.total}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded px-3 py-1.5 text-white shadow-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-medium opacity-90">Bekleyen:</span>
                    <span className="text-base font-bold">{stats.pending}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded px-3 py-1.5 text-white shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-medium opacity-90">Hazırlanıyor:</span>
                    <span className="text-base font-bold">{stats.preparing}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded px-3 py-1.5 text-white shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-medium opacity-90">Tamamlanan:</span>
                    <span className="text-base font-bold">{stats.completed}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sağ - Server Status */}
            <div>
              {serverStatus === 'online' && (
                <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                  <Wifi className="w-3 h-3" />
                  Bağlı
                </span>
              )}
              {serverStatus === 'offline' && (
                <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                  <WifiOff className="w-3 h-3" />
                  Bağlantı Yok
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters - Compact */}
      <div className="px-6 py-2 bg-white border-b border-gray-200">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Belge Tipi Filtreleri - Compact */}
          <div className="flex gap-1">
            <button
              onClick={() => setDocTypeFilter('all')}
              className={`px-3 py-1.5 rounded text-sm font-semibold shadow-lg hover:shadow-xl transition-all ${
                docTypeFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tümü
            </button>
            <button
              onClick={() => setDocTypeFilter('6')}
              className={`px-3 py-1.5 rounded text-sm font-semibold shadow-lg hover:shadow-xl transition-all ${
                docTypeFilter === '6'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sipariş
            </button>
            <button
              onClick={() => setDocTypeFilter('1')}
              className={`px-3 py-1.5 rounded text-sm font-semibold shadow-lg hover:shadow-xl transition-all ${
                docTypeFilter === '1'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Satış
            </button>
            <button
              onClick={() => setDocTypeFilter('2')}
              className={`px-3 py-1.5 rounded text-sm font-semibold shadow-lg hover:shadow-xl transition-all ${
                docTypeFilter === '2'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Alış
            </button>
          </div>

          <div className="h-6 w-px bg-gray-300"></div>

          {/* Tarih Filtresi */}
          <div className="flex items-center gap-1">
            <button
              onClick={goToPreviousDate}
              className="p-1.5 hover:bg-gray-100 rounded shadow-lg hover:shadow-xl transition-all"
              title="Önceki Gün"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded shadow-lg focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>

            <button
              onClick={goToNextDate}
              className="p-1.5 hover:bg-gray-100 rounded shadow-lg hover:shadow-xl transition-all"
              title="Sonraki Gün"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="h-6 w-px bg-gray-300"></div>

          {/* Arama ve Diğer Filtreler */}
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Belge no, cari, şehir ara..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded shadow-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleFilter}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all"
            >
              <Filter className="w-3.5 h-3.5" />
              Filtrele
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-600 text-white rounded shadow-lg hover:shadow-xl hover:bg-gray-700 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sıfırla
            </button>

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded shadow-lg hover:shadow-xl hover:bg-green-700 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Yenile
            </button>

            <button
              onClick={onExportExcel}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded shadow-lg hover:shadow-xl hover:bg-emerald-700 transition-all"
            >
              📊 Excel
            </button>
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && rowData.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-gray-200 border-t-primary-600 rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Siparişler yükleniyor...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Bağlantı Hatası</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg shadow-lg hover:shadow-xl hover:bg-primary-700 transition-all"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      )}

      {/* AG Grid */}
      {!loading && !error && (
        <div className="flex-1 px-6 py-2 bg-gray-50">
          <div className="ag-theme-alpine h-full rounded-lg shadow-lg overflow-hidden border border-gray-200">
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
            pagination={true}
            paginationPageSize={20}
            onRowClicked={onRowClicked}
            rowClass="cursor-pointer hover:bg-gray-50"
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
              noRowsToShow: 'Gösterilecek sipariş yok',
              filterOoo: 'Filtrele...',
              applyFilter: 'Filtre Uygula',
              clearFilter: 'Filtreyi Temizle'
            }}
          />
        </div>
      </div>
      )}
    </div>
  )
}

export default DocumentsPage


