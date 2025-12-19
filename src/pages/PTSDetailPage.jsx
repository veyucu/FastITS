import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Package, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Clock, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react'
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

// Durum badge renkleri
const getStatusStyle = (status) => {
  const statusLower = (status || '').toLowerCase()
  if (statusLower.includes('onay') || statusLower.includes('kabul') || statusLower.includes('tamamlan')) {
    return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle }
  }
  if (statusLower.includes('bekle') || statusLower.includes('işlem')) {
    return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: Clock }
  }
  if (statusLower.includes('iptal') || statusLower.includes('red')) {
    return { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30', icon: XCircle }
  }
  if (statusLower.includes('hata') || statusLower.includes('error')) {
    return { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30', icon: AlertCircle }
  }
  return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', icon: Info }
}

const PTSDetailPage = () => {
  const { transferId } = useParams()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [packageData, setPackageData] = useState(null)
  const [products, setProducts] = useState([])
  const [grouping, setGrouping] = useState(['gtin'])
  const [expanded, setExpanded] = useState({})
  const [sorting, setSorting] = useState([])

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
            containerType: p.CONTAINER_TYPE
          }))
        
        setProducts(onlyProducts)
      }
    } catch (error) {
      console.error('Paket detay yükleme hatası:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'gtin',
      header: 'GTIN',
      enableSorting: true,
      size: 180,
      cell: info => <span className="font-mono font-bold text-primary-400">{info.getValue()}</span>,
      enableGrouping: true,
      aggregatedCell: ({ getValue, row }) => (
        <div className="flex items-center gap-3">
          <button
            onClick={row.getToggleExpandedHandler()}
            className="p-1.5 hover:bg-dark-600 rounded-lg transition-all duration-200 bg-dark-700/50"
          >
            {row.getIsExpanded() ? 
              <ChevronDown className="w-4 h-4 text-primary-400" /> : 
              <ChevronRight className="w-4 h-4 text-primary-400" />
            }
          </button>
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-primary-300 text-sm bg-primary-500/10 px-2 py-1 rounded border border-primary-500/20">{getValue()}</span>
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold">
              {row.subRows.length} Adet
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'stockName',
      header: 'Stok Adı',
      enableSorting: true,
      size: 250,
      cell: info => <span className="font-medium text-slate-200">{info.getValue()}</span>,
      aggregatedCell: ({ row }) => (
        <span className="font-semibold text-slate-100 text-sm">{row.subRows[0]?.original.stockName}</span>
      ),
    },
    {
      accessorKey: 'serialNumber',
      header: 'Seri No',
      enableSorting: true,
      size: 180,
      cell: info => <span className="font-mono text-rose-400 font-bold text-sm">{info.getValue()}</span>,
    },
    {
      accessorKey: 'lotNumber',
      header: 'Lot No',
      enableSorting: true,
      size: 120,
      cell: info => <span className="font-mono text-slate-300">{info.getValue() || '-'}</span>,
    },
    {
      accessorKey: 'expirationDate',
      header: 'Miad',
      enableSorting: true,
      size: 110,
      cell: info => (
        <span className="px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-medium text-xs">
          {info.getValue() || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'productionDate',
      header: 'Üretim',
      enableSorting: true,
      size: 110,
      cell: info => (
        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-medium text-xs">
          {info.getValue() || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'carrierLabel',
      header: 'Koli',
      enableSorting: true,
      size: 200,
      cell: info => (
        <span className="font-mono text-xs text-slate-400 bg-dark-700/50 border border-dark-600 px-2 py-1 rounded">
          {info.getValue() || '-'}
        </span>
      ),
    },
  ], [])

  const table = useReactTable({
    data: products,
    columns,
    state: {
      grouping,
      expanded,
      sorting,
    },
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    autoResetExpanded: false,
    enableSortingRemoval: false,
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
    <div className="flex flex-col h-screen bg-dark-950">
      {/* Header - Dark Theme */}
      <div className="bg-dark-900/80 backdrop-blur-sm border-b border-dark-700">
        <div className="px-6 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/pts')}
              className="w-10 h-10 bg-dark-700 rounded-lg flex items-center justify-center hover:bg-dark-600 transition-colors border border-dark-600"
            >
              <ArrowLeft className="w-6 h-6 text-slate-300" />
            </button>
            <div className="flex-1 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-100">PTS Paket Detayı</h1>
                <p className="text-slate-500 text-sm">Transfer ID: {transferId}</p>
              </div>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <div className="bg-dark-800/80 border border-dark-700 px-3 py-1.5 rounded-lg">
                  <span className="font-semibold text-slate-400">Belge No:</span> <span className="text-slate-200">{packageData.DOCUMENT_NUMBER || '-'}</span>
                </div>
                <div className="bg-dark-800/80 border border-dark-700 px-3 py-1.5 rounded-lg">
                  <span className="font-semibold text-slate-400">Belge Tarihi:</span>{' '}
                  <span className="text-slate-200">{packageData.DOCUMENT_DATE ? new Date(packageData.DOCUMENT_DATE).toLocaleDateString('tr-TR') : '-'}</span>
                </div>
                <div className="bg-dark-800/80 border border-dark-700 px-3 py-1.5 rounded-lg">
                  <span className="font-semibold text-slate-400">Kaynak GLN:</span>{' '}
                  <span className="font-mono text-slate-200">{packageData.SOURCE_GLN || '-'}</span>
                </div>
                {packageData.SOURCE_GLN_NAME && (
                  <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg">
                    <span className="font-semibold text-amber-400">Cari:</span>{' '}
                    <span className="text-amber-300">
                      {packageData.SOURCE_GLN_NAME}
                      {packageData.SOURCE_GLN_ILCE && ` - ${packageData.SOURCE_GLN_ILCE}`}
                      {packageData.SOURCE_GLN_IL && ` / ${packageData.SOURCE_GLN_IL}`}
                    </span>
                  </div>
                )}
                {/* Durum */}
                {packageData.DURUM && (() => {
                  const style = getStatusStyle(packageData.DURUM)
                  const StatusIcon = style.icon
                  return (
                    <div className={`${style.bg} ${style.border} border px-3 py-1.5 rounded-lg flex items-center gap-2`}>
                      <StatusIcon className={`w-4 h-4 ${style.text}`} />
                      <span className={`font-semibold ${style.text}`}>{packageData.DURUM}</span>
                    </div>
                  )
                })()}
                {/* Bildirim Tarihi */}
                {packageData.BILDIRIM_TARIHI && (
                  <div className="bg-primary-500/10 border border-primary-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary-400" />
                    <span className="font-semibold text-primary-400">Bildirim:</span>{' '}
                    <span className="text-primary-300">{new Date(packageData.BILDIRIM_TARIHI).toLocaleDateString('tr-TR')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TanStack Table - Dark Theme */}
      <div className="flex-1 px-6 py-4 overflow-auto">
        <div className="bg-dark-800/60 rounded-2xl border border-dark-700 overflow-hidden shadow-xl shadow-dark-950/50">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-dark-900 to-dark-800 text-slate-300 sticky top-0 z-10 border-b border-dark-600">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ width: header.column.columnDef.size }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center gap-2 ${
                            header.column.getCanSort() ? 'cursor-pointer select-none hover:text-primary-400 transition-colors' : ''
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
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className={`
                    ${row.getIsGrouped() 
                      ? 'bg-gradient-to-r from-dark-700/80 to-dark-700/40 hover:from-dark-700 hover:to-dark-700/60 border-l-4 border-primary-500' 
                      : 'hover:bg-dark-700/20 border-l-4 border-transparent hover:border-primary-500/30'
                    }
                    transition-all duration-150 text-slate-200
                  `}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <td
                      key={cell.id}
                      className={`
                        px-4 text-sm
                        ${row.getIsGrouped() ? 'font-semibold py-2.5' : 'py-2'}
                        ${index === 0 && !row.getIsGrouped() ? 'pl-14' : ''}
                      `}
                    >
                      {cell.getIsGrouped() ? (
                        flexRender(cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell, cell.getContext())
                      ) : cell.getIsAggregated() ? (
                        flexRender(cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell, cell.getContext())
                      ) : cell.getIsPlaceholder() ? null : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {/* Footer */}
          <div className="bg-gradient-to-r from-dark-900 to-dark-800 border-t border-dark-600 px-5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-400">Toplam:</span>
                  <span className="px-2.5 py-1 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-lg text-sm font-bold">
                    {products.length}
                  </span>
                </div>
                <div className="w-px h-5 bg-dark-600" />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">Kalem:</span>
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-bold">
                    {new Set(products.map(p => p.gtin)).size}
                  </span>
                </div>
                <div className="w-px h-5 bg-dark-600" />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">Koli:</span>
                  <span className="px-2.5 py-1 bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-lg text-sm font-bold">
                    {new Set(products.filter(p => p.carrierLabel).map(p => p.carrierLabel)).size}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Info className="w-3.5 h-3.5" />
                <span>Grupları genişletmek/daraltmak için satıra tıklayın</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PTSDetailPage
