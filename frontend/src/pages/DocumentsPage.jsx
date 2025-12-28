import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { Package, Search, RefreshCw, Wifi, WifiOff, ChevronLeft, ChevronRight, Calendar, Clock, CheckCircle, AlertCircle, Home } from 'lucide-react'
import apiService from '../services/apiService'
import usePageTitle from '../hooks/usePageTitle'
import { encodeDocumentId } from '../utils/documentIdUtils'

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
  const [allDocuments, setAllDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [serverStatus, setServerStatus] = useState('checking') // checking, online, offline
  const [isInitialLoad, setIsInitialLoad] = useState(true) // İlk yükleme kontrolü

  // Belge Tipi Gösterimi - Dark Theme
  // FTIRSIP + TIPI kombinasyonu ile belge türü belirlenir
  const DocTypeRenderer = ({ value, data }) => {
    const ftirsip = value
    const tipi = data?.tipi

    // FTIRSIP + TIPI kombinasyonuna göre belge türü
    let docTypeInfo = { text: 'Bilinmeyen', color: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' }

    if (ftirsip === '6') {
      // Sipariş
      docTypeInfo = { text: 'Sipariş', color: 'bg-violet-500/20 text-violet-400 border border-violet-500/30' }
    } else if (ftirsip === '1') {
      // Satış Faturası
      if (tipi === 4 || tipi === '4') {
        docTypeInfo = { text: 'Satış Faturası (İade)', color: 'bg-rose-500/20 text-rose-400 border border-rose-500/30' }
      } else {
        docTypeInfo = { text: 'Satış Faturası', color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' }
      }
    } else if (ftirsip === '2') {
      // Alış Faturası
      if (tipi === 4 || tipi === '4') {
        docTypeInfo = { text: 'Alış Faturası (İade)', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' }
      } else {
        docTypeInfo = { text: 'Alış Faturası', color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' }
      }
    } else if (ftirsip === '4') {
      // Alış İrsaliyesi
      if (tipi === 4 || tipi === '4') {
        docTypeInfo = { text: 'Alış İrsaliyesi (İade)', color: 'bg-pink-500/20 text-pink-400 border border-pink-500/30' }
      } else {
        docTypeInfo = { text: 'Alış İrsaliyesi', color: 'bg-sky-500/20 text-sky-400 border border-sky-500/30' }
      }
    }

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${docTypeInfo.color}`}>
        {docTypeInfo.text}
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
        <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          ✓
        </span>
      )
    }

    return (
      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold ${styles[type]}`}>
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
      cellRenderer: (params) => <DocTypeRenderer value={params.value} data={params.data} />,
      wrapHeaderText: true,
      autoHeaderHeight: true
    },
    {
      headerName: 'Belge No',
      field: 'documentNo',
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
      field: 'itsBildirim',
      width: 60,
      cellClass: 'text-center',
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRenderer: (params) => {
        const durum = params.value
        const { itsTarih, itsKullanici } = params.data
        const tarihStr = itsTarih ? new Date(itsTarih).toLocaleString('tr-TR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : ''
        const tooltip = tarihStr ? `ITS: ${tarihStr}${itsKullanici ? ` - ${itsKullanici}` : ''}` : ''

        if (durum === 'OK') {
          return (
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 cursor-help" title={tooltip}>
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
          )
        }
        if (durum === 'NOK') {
          return (
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-red-500/20 border border-red-500/40 cursor-help" title={tooltip}>
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
          )
        }
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-700/50 border border-slate-600">
            <div className="w-3 h-3 rounded-full border-2 border-slate-500" />
          </div>
        )
      }
    },
    {
      headerName: 'PTS',
      field: 'ptsId',
      width: 60,
      cellClass: 'text-center',
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRenderer: (params) => {
        const ptsId = params.value
        const { ptsTarih, ptsKullanici } = params.data
        const tarihStr = ptsTarih ? new Date(ptsTarih).toLocaleString('tr-TR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : ''

        if (ptsId) {
          const handleClick = (e) => {
            e.stopPropagation()
            // Popup oluştur
            const popup = document.createElement('div')
            popup.className = 'fixed bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-50 p-3'
            popup.style.left = `${e.clientX - 100}px`
            popup.style.top = `${e.clientY + 10}px`
            popup.innerHTML = `
              <div class="text-xs text-slate-400 mb-1">PTS ID (seçip kopyalayın):</div>
              <input type="text" value="${ptsId}" readonly 
                class="w-full bg-dark-900 border border-dark-500 rounded px-2 py-1 text-sm text-slate-100 font-mono select-all" 
                style="min-width: 200px"
              />
              <div class="text-[10px] text-slate-500 mt-1">${tarihStr}${ptsKullanici ? ` - ${ptsKullanici}` : ''}</div>
            `
            document.body.appendChild(popup)
            // Input'a fokusla ve seç
            const input = popup.querySelector('input')
            input.focus()
            input.select()
            // Dışarı tıklayınca kapat
            const closePopup = (ev) => {
              if (!popup.contains(ev.target)) {
                popup.remove()
                document.removeEventListener('click', closePopup)
              }
            }
            setTimeout(() => document.addEventListener('click', closePopup), 100)
          }
          return (
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 cursor-pointer hover:bg-emerald-500/40 transition-colors"
              title="Tıkla ve PTS ID'yi kopyala"
              onClick={handleClick}
            >
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
          )
        }
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-700/50 border border-slate-600">
            <div className="w-3 h-3 rounded-full border-2 border-slate-500" />
          </div>
        )
      }
    },
    {
      headerName: 'UTS',
      field: 'utsBildirim',
      width: 60,
      cellClass: 'text-center',
      wrapHeaderText: true,
      autoHeaderHeight: true,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRenderer: (params) => {
        const durum = params.value
        const { utsTarih, utsKullanici } = params.data
        const tarihStr = utsTarih ? new Date(utsTarih).toLocaleString('tr-TR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : ''
        const tooltip = tarihStr ? `UTS: ${tarihStr}${utsKullanici ? ` - ${utsKullanici}` : ''}` : ''

        if (durum === 'OK') {
          return (
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 cursor-help" title={tooltip}>
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
          )
        }
        if (durum === 'NOK') {
          return (
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-red-500/20 border border-red-500/40 cursor-help" title={tooltip}>
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
          )
        }
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-700/50 border border-slate-600">
            <div className="w-3 h-3 rounded-full border-2 border-slate-500" />
          </div>
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
      columnKeys: ['docType', 'documentNo', 'kayitTarihi', 'customerName', 'customerCode', 'district', 'city', 'phone', 'totalItems', 'miktar', 'okutulan', 'kalan'],
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

  // Row Double Click Handler - Base64 encoded ID ile navigate
  const onRowDoubleClicked = useCallback((event) => {
    const row = event.data
    if (row) {
      // Composite key: SUBE_KODU|FTIRSIP|FATIRS_NO|CARI_KODU -> Base64
      const encodedId = encodeDocumentId(
        row.subeKodu || '0',
        row.docType || '1',
        row.documentNo,
        row.customerCode || ''
      )
      navigate(`/documents/${encodedId}`)
    }
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
        setAllDocuments(response.data)
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
    if (!isInitialLoad && allDocuments.length > 0) {
      handleFilter()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docTypeFilter, statusFilter, searchText, hideCompleted, allDocuments, isInitialLoad])

  // Filter Handler - Client-side filtreleme
  const handleFilter = () => {
    let filtered = allDocuments

    // Belge tipi filtresi
    if (docTypeFilter !== 'all') {
      filtered = filtered.filter(document => document.docType === docTypeFilter)
    }

    // Durum filtresi
    if (statusFilter !== 'all') {
      filtered = filtered.filter(document => document.status === statusFilter)
    }

    // Bitirilenleri gizle - Tamamlanma şartları:
    // - dgrCount = 0 ise ITS ürünü yok, ITS şartları atlanır, sadece kalan = 0 bakılır
    // - dgrCount > 0 ve kalan = 0 ise:
    //   1. itsCount > 0 ise itsBildirim = 'OK' olmalı
    //   2. utsCount > 0 ise utsBildirim = 'OK' olmalı
    //   3. itsCount > 0 ise ptsId boş olmamalı
    if (hideCompleted) {
      filtered = filtered.filter(document => {
        // Bitirilmiş şartları:
        // 1. kalan = 0 (zorunlu)
        // 2. dgrCount = 0 ise: sadece kalan kontrolü yeterli
        // 3. dgrCount > 0 ise:
        //    - itsCount > 0 ise itsBildirim = 'OK'
        //    - utsCount > 0 ise utsBildirim = 'OK'
        //    - itsCount > 0 ise ptsId boş değil

        const isKalanZero = document.kalan === 0

        // dgrCount = 0 ise ITS ürünü yok, sadece kalan kontrolü yeterli
        if (!document.dgrCount || document.dgrCount === 0) {
          return !isKalanZero // kalan = 0 ise bitirilmiş, gizle
        }

        // dgrCount > 0 ise ITS/UTS/PTS şartlarına bak
        const isItsOk = document.itsCount > 0 ? document.itsBildirim === 'OK' : true
        const isUtsOk = document.utsCount > 0 ? document.utsBildirim === 'OK' : true
        const isPtsOk = document.itsCount > 0 ? (document.ptsId && document.ptsId !== '') : true

        // Tüm şartlar sağlanıyorsa bitirilmiş demek
        const isCompleted = isKalanZero && isItsOk && isUtsOk && isPtsOk
        return !isCompleted // Bitirilmemişleri göster
      })
    }

    // Arama filtresi
    if (searchText) {
      const search = searchText.toLowerCase()
      filtered = filtered.filter(document =>
        document.documentNo?.toLowerCase().includes(search) ||
        document.customerName?.toLowerCase().includes(search) ||
        document.customerCode?.toLowerCase().includes(search) ||
        document.city?.toLowerCase().includes(search) ||
        document.district?.toLowerCase().includes(search)
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
    setRowData(allDocuments)

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
      {/* Header with Filters - Dark Theme */}
      <div className="bg-dark-900/80 backdrop-blur-sm border-b border-dark-700">
        <div className="px-4 py-2">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Ana Menü Butonu */}
            <button
              onClick={() => navigate('/')}
              className="w-8 h-8 bg-dark-700 rounded flex items-center justify-center hover:bg-dark-600 transition-colors border border-dark-600 shrink-0"
              title="Ana Menü"
            >
              <Home className="w-5 h-5 text-slate-300" />
            </button>

            <div className="h-6 w-px bg-dark-600"></div>

            {/* Belge Tipi Filtreleri */}
            <div className="flex gap-1">
              <button
                onClick={() => setDocTypeFilter('all')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${docTypeFilter === 'all'
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                  : 'bg-dark-700 text-slate-300 hover:bg-dark-600 border border-dark-600'
                  }`}
              >
                Tümü
              </button>
              <button
                onClick={() => setDocTypeFilter('6')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${docTypeFilter === '6'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                  : 'bg-dark-700 text-slate-300 hover:bg-dark-600 border border-dark-600'
                  }`}
              >
                Sipariş
              </button>
              <button
                onClick={() => setDocTypeFilter('1')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all text-center leading-tight ${docTypeFilter === '1'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-dark-700 text-slate-300 hover:bg-dark-600 border border-dark-600'
                  }`}
              >
                Satış<br />Faturası
              </button>
              <button
                onClick={() => setDocTypeFilter('2')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all text-center leading-tight ${docTypeFilter === '2'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'bg-dark-700 text-slate-300 hover:bg-dark-600 border border-dark-600'
                  }`}
              >
                Alış<br />Faturası
              </button>
              <button
                onClick={() => setDocTypeFilter('4')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all text-center leading-tight ${docTypeFilter === '4'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                  : 'bg-dark-700 text-slate-300 hover:bg-dark-600 border border-dark-600'
                  }`}
              >
                Alış<br />İrsaliyesi
              </button>
            </div>

            <div className="h-6 w-px bg-dark-600"></div>

            {/* Bitirilenleri Gizle */}
            <label className="flex items-center gap-1.5 px-2 py-0.5 bg-dark-700/50 rounded cursor-pointer hover:bg-dark-600 transition-colors border border-dark-600">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
                className="w-3.5 h-3.5 text-primary-600 rounded bg-dark-800 border-dark-500 focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-[10px] font-medium text-slate-300 text-center leading-tight">Bitirilenleri<br />Gizle</span>
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

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-2 py-1.5 text-xs border border-dark-600 rounded bg-dark-800 text-slate-100 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />

              <button
                onClick={goToNextDate}
                className="p-1.5 hover:bg-dark-600 rounded transition-all border border-dark-600"
                title="Sonraki Gün"
              >
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="h-6 w-px bg-dark-600"></div>

            {/* Arama ve Yenile */}
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
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded shadow-lg shadow-primary-600/30 hover:bg-primary-500 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
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
                      applyDocument: true
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


