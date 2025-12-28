import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Package, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Clock, CheckCircle, AlertCircle, XCircle, Info, Send, Search, Filter } from 'lucide-react'
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import apiService from '../services/apiService'
import { getSettings } from '../utils/settingsHelper'
import usePageTitle from '../hooks/usePageTitle'

// Durum badge renkleri - Kod bazlı
const getStatusStyle = (status) => {
  // Baştaki sıfırları temizle (00000 -> 0, 00045 -> 45)
  const normalizedStatus = String(status || '').replace(/^0+/, '') || '0'

  // Durum kodu 0 ise başarılı (yeşil)
  if (normalizedStatus === '0') {
    return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle }
  }
  // Diğer tüm kodlar hatalı (kırmızı)
  if (status && status !== '-') {
    return { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30', icon: XCircle }
  }
  // Boş veya tanımsız
  return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', icon: Info }
}

const PTSDetailPage = () => {
  const { transferId } = useParams()
  const navigate = useNavigate()
  usePageTitle('PTS Detay')

  const [loading, setLoading] = useState(true)
  const [packageData, setPackageData] = useState(null)
  const [products, setProducts] = useState([])
  const [grouping, setGrouping] = useState(['gtin'])
  const [expanded, setExpanded] = useState({})
  const [sorting, setSorting] = useState([])
  const [statusFilter, setStatusFilter] = useState('all') // Durum filtresi
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState(null) // {type: 'success'|'error', text: '...'}
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768) // Mobil görünüm kontrolü
  const [showTooltip, setShowTooltip] = useState(false) // Transfer ID tooltip

  // Ekran boyutu değişikliği dinleyicisi
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Bildirim popup state
  const [bildirimModal, setBildirimModal] = useState({
    show: false,
    type: '', // 'alim' | 'iade'
    status: 'loading', // 'loading' | 'success' | 'error'
    message: '',
    productCount: 0,
    results: [] // [{message: 'mesaj', count: 10}, ...]
  })

  useEffect(() => {
    loadPackageDetails()
  }, [transferId])

  // Tüm grupları otomatik aç
  useEffect(() => {
    if (products.length > 0) {
      const expandAll = {}
      const uniqueGtins = [...new Set(products.map(p => p.gtin))]
      uniqueGtins.forEach((gtin, index) => {
        expandAll[`${index}`] = true
      })
      setExpanded(expandAll)
    }
  }, [products])

  const loadPackageDetails = async () => {
    try {
      setLoading(true)

      const settings = getSettings()
      const response = await apiService.getPackageFromDB(transferId, settings)

      if (response.success && response.data) {
        const data = response.data
        setPackageData(data)

        const onlyProducts = (data.products || [])
          .filter(p => p.SERIAL_NUMBER)
          .map(p => ({
            id: p.ID,
            gtin: p.GTIN || '',
            stockName: p.STOK_ADI || '-',
            serialNumber: p.SERIAL_NUMBER,
            lotNumber: p.LOT_NUMBER,
            expirationDate: p.EXPIRATION_DATE ? new Date(p.EXPIRATION_DATE).toLocaleDateString('tr-TR') : '',
            productionDate: p.PRODUCTION_DATE ? new Date(p.PRODUCTION_DATE).toLocaleDateString('tr-TR') : '',
            carrierLabel: p.CARRIER_LABEL,
            containerType: p.CONTAINER_TYPE,
            durum: p.DURUM || null,
            durumMesaji: p.DURUM_MESAJI || null,
            bildirim: p.BILDIRIM || null,
            bildirimTarihi: p.BILDIRIM_TARIHI ? new Date(p.BILDIRIM_TARIHI).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : null,
            bildirimKullanici: p.BILDIRIM_KULLANICI || null
          }))

        setProducts(onlyProducts)
      }
    } catch (error) {
      console.error('Paket detay yükleme hatası:', error)
    } finally {
      setLoading(false)
    }
  }

  // Sadece verileri yenile (loading göstermeden)
  const refreshData = async () => {
    try {
      const settings = getSettings()
      const response = await apiService.getPackageFromDB(transferId, settings)

      if (response.success && response.data) {
        const data = response.data
        setPackageData(data)

        const onlyProducts = (data.products || [])
          .filter(p => p.SERIAL_NUMBER)
          .map(p => ({
            id: p.ID,
            gtin: p.GTIN || '',
            stockName: p.STOK_ADI || '-',
            serialNumber: p.SERIAL_NUMBER,
            lotNumber: p.LOT_NUMBER,
            expirationDate: p.EXPIRATION_DATE ? new Date(p.EXPIRATION_DATE).toLocaleDateString('tr-TR') : '',
            productionDate: p.PRODUCTION_DATE ? new Date(p.PRODUCTION_DATE).toLocaleDateString('tr-TR') : '',
            carrierLabel: p.CARRIER_LABEL,
            containerType: p.CONTAINER_TYPE,
            durum: p.DURUM || null,
            durumMesaji: p.DURUM_MESAJI || null,
            bildirim: p.BILDIRIM || null,
            bildirimTarihi: p.BILDIRIM_TARIHI ? new Date(p.BILDIRIM_TARIHI).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : null,
            bildirimKullanici: p.BILDIRIM_KULLANICI || null
          }))

        setProducts(onlyProducts)
      }
    } catch (error) {
      console.error('Veri yenileme hatası:', error)
    }
  }

  // Durum istatistikleri - her durum mesajı için kayıt sayısı
  const statusStats = useMemo(() => {
    const stats = {}
    products.forEach(p => {
      const durumMesaji = p.durumMesaji || p.durum || '-'
      stats[durumMesaji] = (stats[durumMesaji] || 0) + 1
    })
    return Object.entries(stats).sort((a, b) => b[1] - a[1]) // Adede göre sırala
  }, [products])

  // Filtrelenmiş ürünler
  const filteredProducts = useMemo(() => {
    if (statusFilter === 'all') return products
    return products.filter(p => (p.durumMesaji || p.durum || '-') === statusFilter)
  }, [products, statusFilter])

  // Alım Bildirimi - /common/app/accept
  const handleAlimBildirimi = async (e) => {
    e?.preventDefault()
    e?.stopPropagation()

    if (filteredProducts.length === 0) {
      setMessage({ type: 'error', text: 'Bildirilecek ürün bulunamadı!' })
      return
    }

    // Onay iste
    const confirmed = window.confirm(
      `${filteredProducts.length} adet ürün için Alım Bildirimi yapılacaktır.\n\nDevam etmek istiyor musunuz?`
    )
    if (!confirmed) return

    // Popup göster
    setBildirimModal({
      show: true,
      type: 'alim',
      status: 'loading',
      message: 'Lütfen bekleyin, alım bildirimi yapılıyor...',
      productCount: filteredProducts.length
    })

    try {
      const settings = getSettings()

      // Ürün listesini hazırla
      const productsToSend = filteredProducts.map(p => ({
        id: p.id,
        gtin: p.gtin,
        sn: p.serialNumber,
        xd: p.expirationDate,
        bn: p.lotNumber
      }))

      const result = await apiService.ptsAlimBildirimi(transferId, productsToSend, settings, JSON.parse(localStorage.getItem('user'))?.username)

      // Mesajları gruplandır (durumMesaji alanını kullan)
      const groupedResults = []
      if (result.data && Array.isArray(result.data)) {
        const counts = {}
        result.data.forEach(item => {
          const msg = item.durumMesaji || item.message || `Kod: ${item.durum}`
          counts[msg] = (counts[msg] || 0) + 1
        })
        Object.entries(counts).forEach(([msg, count]) => {
          groupedResults.push({ message: msg, count })
        })
        groupedResults.sort((a, b) => b.count - a.count)
      }

      if (result.success) {
        setBildirimModal(prev => ({
          ...prev,
          status: 'success',
          message: result.message || 'Alım bildirimi başarıyla gönderildi!',
          results: groupedResults
        }))
        // Verileri yenile (grid ve header durumu - loading göstermeden)
        await refreshData()
      } else {
        setBildirimModal(prev => ({
          ...prev,
          status: 'error',
          message: result.message || 'Alım bildirimi gönderilemedi!',
          results: groupedResults
        }))
      }
    } catch (error) {
      console.error('Alım bildirimi hatası:', error)
      setBildirimModal(prev => ({
        ...prev,
        status: 'error',
        message: error.message || 'Bir hata oluştu!'
      }))
    }
  }

  // Sorgulama - /common/app/verify - Sadece grid'i günceller, veritabanına yazmaz
  const handleSorgula = async (e) => {
    e?.preventDefault()
    e?.stopPropagation()

    if (filteredProducts.length === 0) {
      setMessage({ type: 'error', text: 'Sorgulanacak ürün bulunamadı!' })
      return
    }

    // Onay iste
    const confirmed = window.confirm(
      `${filteredProducts.length} adet ürün için Sorgulama yapılacaktır.\n\nDevam etmek istiyor musunuz?`
    )
    if (!confirmed) return

    // Popup göster
    setBildirimModal({
      show: true,
      type: 'sorgulama',
      status: 'loading',
      message: 'Lütfen bekleyin, sorgulama yapılıyor...',
      productCount: filteredProducts.length
    })

    try {
      const settings = getSettings()

      // Ürün listesini hazırla
      const productsToSend = filteredProducts.map(p => ({
        id: p.id,
        gtin: p.gtin,
        sn: p.serialNumber
      }))

      const result = await apiService.ptsSorgula(transferId, productsToSend, settings)

      // Mesajları gruplandır (durumMesaji alanını kullan)
      const groupedResults = []
      if (result.data && Array.isArray(result.data)) {
        const counts = {}
        result.data.forEach(item => {
          const msg = item.durumMesaji || item.message || `Kod: ${item.durum}`
          counts[msg] = (counts[msg] || 0) + 1
        })
        Object.entries(counts).forEach(([msg, count]) => {
          groupedResults.push({ message: msg, count })
        })
        groupedResults.sort((a, b) => b.count - a.count)

        // Grid'deki ürünlerin bildirim değerlerini güncelle (SADECE UI, veritabanına yazmaz)
        setProducts(prev => prev.map(p => {
          const resultItem = result.data.find(r => r.gtin === p.gtin && r.seriNo === p.serialNumber)
          if (resultItem) {
            return {
              ...p,
              bildirim: resultItem.durum,
              durumMesaji: resultItem.durumMesaji || null
            }
          }
          return p
        }))
      }

      if (result.success) {
        setBildirimModal(prev => ({
          ...prev,
          status: 'success',
          message: result.message || 'Sorgulama tamamlandı!',
          results: groupedResults
        }))
        // NOT: Veritabanına yazmadığımız için refreshData çağırmıyoruz
      } else {
        setBildirimModal(prev => ({
          ...prev,
          status: 'error',
          message: result.message || 'Sorgulama yapılamadı!',
          results: groupedResults
        }))
      }
    } catch (error) {
      console.error('Sorgulama hatası:', error)
      setBildirimModal(prev => ({
        ...prev,
        status: 'error',
        message: error.message || 'Bir hata oluştu!'
      }))
    }
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'gtin',
      header: 'GTIN',
      enableSorting: true,
      size: 130,
      cell: info => <span className="font-mono font-bold text-primary-400 text-xs">{info.getValue()}</span>,
      enableGrouping: true,
      aggregatedCell: ({ getValue, row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={row.getToggleExpandedHandler()}
            className="p-1 hover:bg-dark-600 rounded transition-all duration-200 bg-dark-700/50"
          >
            {row.getIsExpanded() ?
              <ChevronDown className="w-3.5 h-3.5 text-primary-400" /> :
              <ChevronRight className="w-3.5 h-3.5 text-primary-400" />
            }
          </button>
          <span className="font-mono font-bold text-primary-300 text-xs">{getValue()}</span>
        </div>
      ),
    },
    {
      accessorKey: 'stockName',
      header: 'Stok Adı',
      enableSorting: true,
      size: 300,
      cell: info => <span className="font-medium text-slate-200 text-xs md:text-sm">{info.getValue()}</span>,
      aggregatedCell: ({ row }) => {
        // MIAD'ları adetleriyle grupla
        const miadCounts = {}
        const now = new Date()
        const oneYearLater = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())

        row.subRows.forEach(r => {
          const date = r.original.expirationDate
          if (date) {
            const parts = date.split('.')
            if (parts.length >= 2) {
              const miadKey = `${parts[1]}/${parts[2]}` // AA/YYYY
              miadCounts[miadKey] = (miadCounts[miadKey] || 0) + 1
            }
          }
        })

        // Miad'ın 1 yıldan az mı kontrol fonksiyonu
        const isMiadExpiringSoon = (miadStr) => {
          const [ay, yil] = miadStr.split('/')
          const miadDate = new Date(parseInt(yil), parseInt(ay) - 1, 1)
          return miadDate <= oneYearLater
        }

        const miadList = Object.entries(miadCounts).sort((a, b) => a[0].localeCompare(b[0]))
        const totalCount = row.subRows.length
        const showTotal = miadList.length > 1

        return (
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-100 text-sm">{row.subRows[0]?.original.stockName}</span>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-2">
              {miadList.map(([miad, count], idx) => {
                const isExpiring = isMiadExpiringSoon(miad)
                return (
                  <span key={idx} className="flex items-center gap-1">
                    <span className={`text-xs font-bold ${isExpiring ? 'text-rose-400' : 'text-emerald-400'}`}>{count}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${isExpiring ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'}`}>
                      {miad}
                    </span>
                  </span>
                )
              })}
              {showTotal && (
                <>
                  <span className="text-slate-600">=</span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold">
                    {totalCount} Toplam
                  </span>
                </>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'serialNumber',
      header: 'Seri No',
      enableSorting: true,
      size: 150,
      cell: info => <span className="font-mono text-rose-400 font-bold text-xs">{info.getValue()}</span>,
    },
    {
      accessorKey: 'expirationDate',
      header: 'Miad',
      enableSorting: true,
      size: 90,
      cell: info => {
        const dateStr = info.getValue()
        if (!dateStr || dateStr === '-') {
          return <span className="text-slate-500 text-xs">-</span>
        }
        // Tarih formatı: GG.AA.YYYY
        const parts = dateStr.split('.')
        if (parts.length >= 3) {
          const miadDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
          const now = new Date()
          const oneYearLater = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
          const isExpiring = miadDate <= oneYearLater

          return (
            <span className={`px-1.5 py-0.5 rounded font-medium text-xs ${isExpiring ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
              {dateStr}
            </span>
          )
        }
        return (
          <span className="px-1.5 py-0.5 bg-slate-500/20 text-slate-300 border border-slate-500/30 rounded font-medium text-xs">
            {dateStr}
          </span>
        )
      },
    },
    {
      accessorKey: 'lotNumber',
      header: 'Lot',
      enableSorting: true,
      size: 100,
      cell: info => <span className="font-mono text-slate-300 text-xs">{info.getValue() || '-'}</span>,
    },
    {
      accessorKey: 'productionDate',
      header: 'Üretim',
      enableSorting: true,
      size: 90,
      cell: info => (
        <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-medium text-xs">
          {info.getValue() || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'carrierLabel',
      header: 'Koli',
      enableSorting: true,
      size: 160,
      cell: info => (
        <span className="font-mono text-xs text-slate-400 bg-dark-700/50 border border-dark-600 px-1.5 py-0.5 rounded">
          {info.getValue() || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'bildirim',
      header: 'Bildirim',
      enableSorting: true,
      size: 220,
      cell: info => {
        const value = info.getValue()
        const row = info.row.original
        const mesaj = row.durumMesaji
        const displayText = mesaj || value || '-'
        if (!value || value === '-') return <span className="text-slate-500">-</span>
        const style = getStatusStyle(value)
        const StatusIcon = style.icon
        return (
          <div
            className={`inline-flex items-center gap-2 px-2.5 py-1.5 ${style.bg} ${style.border} border-2 rounded-lg text-xs font-bold shadow-sm`}
            title={`Kod: ${value}`}
          >
            <StatusIcon className={`w-4 h-4 ${style.text} flex-shrink-0`} />
            <span className={`${style.text}`}>{displayText}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'bildirimTarihi',
      header: 'Bildirim Tarihi',
      enableSorting: true,
      size: 120,
      cell: info => {
        const tarih = info.getValue()
        const kullanici = info.row.original.bildirimKullanici
        return (
          <div className="flex flex-col leading-tight">
            <span className="text-slate-400 text-xs">{tarih || '-'}</span>
            {kullanici && <span className="text-slate-500 text-[10px]">{kullanici}</span>}
          </div>
        )
      },
    },
  ], [])

  const [columnSizing, setColumnSizing] = useState({})

  const table = useReactTable({
    data: filteredProducts,
    columns,
    state: {
      grouping,
      expanded,
      sorting,
      columnSizing,
    },
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    autoResetExpanded: false,
    enableSortingRemoval: false,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-950">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-primary-500 animate-bounce" />
          <p className="text-lg font-medium text-slate-300">Paket detayları yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!packageData) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-950">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-rose-500" />
          <p className="text-lg font-medium text-slate-300">Paket bulunamadı</p>
          <button
            onClick={() => navigate('/pts')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-500 shadow-lg shadow-primary-600/30"
          >
            Geri Dön
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-dark-950 overflow-hidden">
      {/* Header - Sabit - Kompakt - Mobile Responsive */}
      <div className="flex-shrink-0 bg-dark-900/80 backdrop-blur-sm border-b border-dark-700 z-20">
        <div className="px-2 md:px-3 py-1.5">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Sol - Geri butonu */}
            <button
              onClick={() => navigate('/pts')}
              className="w-6 h-6 bg-dark-700 rounded flex items-center justify-center hover:bg-dark-600 transition-colors border border-dark-600 flex-shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-300" />
            </button>

            {/* Transfer ID - Badge with Tooltip for Mobile */}
            <div className="relative">
              <div
                className="bg-primary-500/10 border border-primary-500/30 rounded px-2 py-0.5 flex flex-col items-center cursor-pointer"
                onClick={() => isMobile && setShowTooltip(!showTooltip)}
                onMouseEnter={() => !isMobile && setShowTooltip(true)}
                onMouseLeave={() => !isMobile && setShowTooltip(false)}
              >
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-primary-400/70 uppercase">Transfer</span>
                  {isMobile && <Info className="w-2.5 h-2.5 text-primary-400/50" />}
                </div>
                <span className="text-primary-400 text-xs font-bold font-mono">#{transferId}</span>
              </div>

              {/* Tooltip - Belge bilgileri */}
              {showTooltip && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-dark-800 border border-dark-600 rounded-lg shadow-xl p-3 min-w-[200px]">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Belge No:</span>
                      <span className="text-slate-200 font-medium">{packageData.DOCUMENT_NUMBER || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tarih:</span>
                      <span className="text-slate-200">{packageData.DOCUMENT_DATE ? new Date(packageData.DOCUMENT_DATE).toLocaleDateString('tr-TR') : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">GLN:</span>
                      <span className="text-slate-200 font-mono text-[10px]">{packageData.SOURCE_GLN || '-'}</span>
                    </div>
                    {packageData.SOURCE_GLN_NAME && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Cari:</span>
                        <span className="text-amber-400 font-medium truncate max-w-[120px]">{packageData.SOURCE_GLN_NAME}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop - Badge'ler */}
            {!isMobile && (
              <>
                {/* Belge No - Badge */}
                <div className="bg-dark-800 border border-dark-600 rounded px-2 py-0.5 flex flex-col items-center">
                  <span className="text-[9px] text-slate-500 uppercase">Belge No</span>
                  <span className="text-slate-200 text-xs font-medium">{packageData.DOCUMENT_NUMBER || '-'}</span>
                </div>

                {/* Tarih - Badge */}
                <div className="bg-dark-800 border border-dark-600 rounded px-2 py-0.5 flex flex-col items-center">
                  <span className="text-[9px] text-slate-500 uppercase">Tarih</span>
                  <span className="text-slate-200 text-xs font-medium">{packageData.DOCUMENT_DATE ? new Date(packageData.DOCUMENT_DATE).toLocaleDateString('tr-TR') : '-'}</span>
                </div>

                {/* GLN - Badge */}
                <div className="bg-dark-800 border border-dark-600 rounded px-2 py-0.5 flex flex-col items-center">
                  <span className="text-[9px] text-slate-500 uppercase">GLN</span>
                  <span className="text-slate-200 text-xs font-mono">{packageData.SOURCE_GLN || '-'}</span>
                </div>

                {/* Cari - Badge */}
                {packageData.SOURCE_GLN_NAME && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5 flex flex-col items-center">
                    <span className="text-[9px] text-amber-400/70 uppercase">Cari</span>
                    <span className="text-amber-400 text-xs font-medium truncate max-w-[180px]">
                      {packageData.SOURCE_GLN_NAME}
                      {packageData.SOURCE_GLN_IL && ` / ${packageData.SOURCE_GLN_IL}`}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Sağ - Aksiyon Butonları */}
            <div className="flex items-center gap-1.5 md:gap-2 ml-auto">
              {/* Durum Filtresi - Sadece Desktop */}
              {!isMobile && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-dark-800 border border-dark-600 text-slate-200 text-xs rounded px-1.5 py-0.5 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 min-w-[120px]"
                >
                  <option value="all">Tümü ({products.length})</option>
                  {statusStats.map(([durum, count]) => (
                    <option key={durum} value={durum}>
                      {durum} ({count})
                    </option>
                  ))}
                </select>
              )}

              {/* Aksiyon Butonları - Mobilde daha büyük touch hedefleri */}
              <button
                type="button"
                onClick={handleAlimBildirimi}
                disabled={actionLoading || filteredProducts.length === 0}
                className="flex items-center gap-1 px-3 md:px-2 py-1.5 md:py-0.5 text-xs md:text-xs bg-emerald-600 text-white rounded shadow-sm hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Alım</span>
              </button>

              <button
                type="button"
                onClick={handleSorgula}
                disabled={actionLoading || filteredProducts.length === 0}
                className="flex items-center gap-1 px-3 md:px-2 py-1.5 md:py-0.5 text-xs md:text-xs bg-primary-600 text-white rounded shadow-sm hover:bg-primary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-1"
              >
                {actionLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Sorgula</span>
              </button>

              {/* Bildirim Durumu - Desktop için */}
              {!isMobile && (() => {
                const bildirimValue = packageData.BILDIRIM
                const bildirimTarihi = packageData.BILDIRIM_TARIHI
                const bildirimKullanici = packageData.BILDIRIM_KULLANICI
                const tarihStr = bildirimTarihi ? new Date(bildirimTarihi).toLocaleString('tr-TR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : ''

                if (bildirimValue === 'OK') {
                  return (
                    <div className="flex items-center gap-2" title="ITS Bildirimi">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="text-xs text-slate-300">{tarihStr}</span>
                        {bildirimKullanici && <span className="text-xs text-slate-500">{bildirimKullanici}</span>}
                      </div>
                    </div>
                  )
                }

                if (bildirimValue === 'NOK') {
                  return (
                    <div className="flex items-center gap-2" title="ITS Bildirimi">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="text-xs text-slate-300">{tarihStr}</span>
                        {bildirimKullanici && <span className="text-xs text-slate-500">{bildirimKullanici}</span>}
                      </div>
                    </div>
                  )
                }

                // Boş veya diğer durumlar
                return (
                  <div className="flex items-center gap-2" title="ITS Bildirimi">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-700/50 border border-slate-600">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-500" />
                    </div>
                    <span className="text-xs text-slate-500">Bildirilmedi</span>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Mesaj Gösterimi */}
      {
        message && (
          <div className={`mx-6 mt-4 px-4 py-3 rounded-lg flex items-center gap-3 ${message.type === 'success'
            ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
            : 'bg-rose-500/20 border border-rose-500/30 text-rose-400'
            }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="font-medium">{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="ml-auto text-current opacity-60 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        )
      }

      {/* TanStack Table - Scrollable Area */}
      <div className="flex-1 flex flex-col min-h-0 px-2 md:px-6 py-2 md:py-4">
        <div className="flex-1 flex flex-col min-h-0 bg-dark-800/60 rounded-xl border border-dark-700 overflow-hidden shadow-xl shadow-dark-950/50">
          {/* Table with scroll */}
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-dark-900 to-dark-800 text-slate-300 sticky top-0 z-10 border-b border-dark-600">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className={`px-2 md:px-4 py-2 md:py-3.5 text-left text-[10px] md:text-xs font-bold uppercase tracking-wider relative group`}
                        style={{ width: isMobile ? 'auto' : header.getSize() }}
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            className={`flex items-center gap-2 ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-primary-400 transition-colors' : ''
                              }`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="flex flex-col">
                                {header.column.getIsSorted() === 'asc' ? (
                                  <ArrowUp className="w-3.5 h-3.5 text-primary-400" />
                                ) : header.column.getIsSorted() === 'desc' ? (
                                  <ArrowDown className="w-3.5 h-3.5 text-primary-400" />
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                                )}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Resize Handle */}
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none opacity-0 group-hover:opacity-100 transition-opacity ${header.column.getIsResizing() ? 'bg-primary-500 opacity-100' : 'bg-slate-500 hover:bg-primary-400'
                            }`}
                        />
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-dark-700/50">
                {table.getRowModel().rows.map(row => {
                  const visibleCells = row.getVisibleCells()
                  const isGrouped = row.getIsGrouped()

                  // Gruplandırma satırı için özel render
                  if (isGrouped) {
                    // İlk iki hücreyi al (GTIN ve Stok Adı)
                    const gtinCell = visibleCells[0]
                    const stockNameCell = visibleCells[1]
                    const remainingColSpan = visibleCells.length - 2

                    return (
                      <tr
                        key={row.id}
                        className="bg-gradient-to-r from-dark-700/80 to-dark-700/40 hover:from-dark-700 hover:to-dark-700/60 border-l-4 border-primary-500 transition-all duration-150 text-slate-200"
                      >
                        {/* GTIN */}
                        <td className="px-4 py-1.5 text-sm font-semibold" style={{ width: gtinCell.column.getSize() }}>
                          {flexRender(gtinCell.column.columnDef.aggregatedCell ?? gtinCell.column.columnDef.cell, gtinCell.getContext())}
                        </td>
                        {/* Stok Adı + Adet + MIAD'lar (colspan ile birleşik) */}
                        <td
                          colSpan={remainingColSpan + 1}
                          className="px-4 py-1.5 text-sm font-semibold"
                        >
                          {flexRender(stockNameCell.column.columnDef.aggregatedCell ?? stockNameCell.column.columnDef.cell, stockNameCell.getContext())}
                        </td>
                      </tr>
                    )
                  }

                  // Normal satırlar
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-dark-700/20 border-l-4 border-transparent hover:border-primary-500/30 transition-all duration-150 text-slate-200"
                    >
                      {visibleCells.map((cell, index) => (
                        <td
                          key={cell.id}
                          className={`px-4 text-sm py-2 ${index === 0 ? 'pl-14' : ''}`}
                          style={{ width: cell.column.getSize() }}
                        >
                          {cell.getIsPlaceholder() ? null : flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Footer - Sabit - Mobile Responsive */}
          <div className="flex-shrink-0 bg-gradient-to-r from-dark-900 to-dark-800 border-t border-dark-600 px-2 md:px-5 py-1.5 md:py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-4">
                <div className="flex items-center gap-1 md:gap-2">
                  <Package className="w-3.5 md:w-4 h-3.5 md:h-4 text-slate-500" />
                  <span className="text-[10px] md:text-sm text-slate-400">Gösterilen:</span>
                  <span className="px-1.5 md:px-2.5 py-0.5 md:py-1 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-lg text-[10px] md:text-sm font-bold">
                    {filteredProducts.length}
                  </span>
                  {statusFilter !== 'all' && (
                    <>
                      <span className="text-slate-500">/</span>
                      <span className="text-[10px] md:text-sm text-slate-400">{products.length}</span>
                    </>
                  )}
                </div>
                <div className="hidden md:block w-px h-5 bg-dark-600" />
                <div className="flex items-center gap-1 md:gap-2">
                  <span className="text-[10px] md:text-sm text-slate-400">Kalem:</span>
                  <span className="px-1.5 md:px-2.5 py-0.5 md:py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] md:text-sm font-bold">
                    {new Set(filteredProducts.map(p => p.gtin)).size}
                  </span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <span className="text-[10px] md:text-sm text-slate-400">Koli:</span>
                  <span className="px-1.5 md:px-2.5 py-0.5 md:py-1 bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-lg text-[10px] md:text-sm font-bold">
                    {new Set(filteredProducts.filter(p => p.carrierLabel).map(p => p.carrierLabel)).size}
                  </span>
                </div>
              </div>
              {!isMobile && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Info className="w-3.5 h-3.5" />
                  <span>Grupları genişletmek/daraltmak için satıra tıklayın</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bildirim Modal Popup */}
      {
        bildirimModal.show && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
              {/* İkon */}
              <div className="flex justify-center mb-6">
                {bildirimModal.status === 'loading' && (
                  <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                )}
                {bildirimModal.status === 'success' && (
                  <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-emerald-400" />
                  </div>
                )}
                {bildirimModal.status === 'error' && (
                  <div className="w-16 h-16 bg-rose-500/20 border-2 border-rose-500 rounded-full flex items-center justify-center">
                    <XCircle className="w-10 h-10 text-rose-400" />
                  </div>
                )}
              </div>

              {/* Başlık */}
              <h3 className="text-xl font-bold text-center text-slate-100 mb-2">
                {bildirimModal.type === 'alim' ? 'Alım Bildirimi' :
                  bildirimModal.type === 'sorgulama' ? 'Sorgulama' : 'İade Bildirimi'}
              </h3>

              {/* Ürün Sayısı */}
              <p className="text-center text-slate-400 text-sm mb-4">
                {bildirimModal.productCount} ürün işleniyor
              </p>

              {/* Mesaj */}
              <p className={`text-center text-lg font-medium mb-6 ${bildirimModal.status === 'success' ? 'text-emerald-400' :
                bildirimModal.status === 'error' ? 'text-rose-400' :
                  'text-slate-300'
                }`}>
                {bildirimModal.message}
              </p>

              {/* Sonuç Detayları */}
              {bildirimModal.results?.length > 0 && bildirimModal.status !== 'loading' && (
                <div className="bg-dark-900/50 border border-dark-600 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {bildirimModal.results.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 flex-1 truncate mr-2">{item.message}</span>
                        <span className={`font-bold px-2 py-0.5 rounded ${item.message.includes('0') || item.message.toLowerCase().includes('başar')
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                          }`}>
                          ({item.count})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Kapat Butonu (sadece success veya error durumunda) */}
              {bildirimModal.status !== 'loading' && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setBildirimModal(prev => ({ ...prev, show: false }))}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all ${bildirimModal.status === 'success'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                      }`}
                  >
                    Tamam
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      }
    </div >
  )
}

export default PTSDetailPage

