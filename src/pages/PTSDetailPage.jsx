import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Package, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
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
      cell: info => <span className="font-mono font-bold text-primary-400">{info.getValue()}</span>,
      enableGrouping: true,
      aggregatedCell: ({ getValue, row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={row.getToggleExpandedHandler()}
            className="p-1 hover:bg-dark-600 rounded transition-all duration-200"
          >
            {row.getIsExpanded() ? 
              <ChevronDown className="w-4 h-4 text-primary-400" /> : 
              <ChevronRight className="w-4 h-4 text-primary-400" />
            }
          </button>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary-400 text-sm">{getValue()}</span>
            <span className="px-2 py-0.5 bg-primary-600/30 text-primary-400 border border-primary-500/30 rounded-full text-xs font-bold">
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
      cell: info => <span className="font-medium text-gray-800">{info.getValue()}</span>,
      aggregatedCell: ({ row }) => (
        <span className="font-semibold text-gray-900 text-sm">{row.subRows[0]?.original.stockName}</span>
      ),
    },
    {
      accessorKey: 'serialNumber',
      header: 'Seri No',
      enableSorting: true,
      cell: info => <span className="font-mono text-red-600 font-bold text-sm">{info.getValue()}</span>,
    },
    {
      accessorKey: 'lotNumber',
      header: 'Lot No',
      enableSorting: true,
      cell: info => <span className="font-mono text-gray-700">{info.getValue() || '-'}</span>,
    },
    {
      accessorKey: 'expirationDate',
      header: 'Son Kullanma Tarihi',
      enableSorting: true,
      cell: info => (
        <span className="px-2 py-1 bg-amber-50 text-amber-800 rounded font-medium text-sm">
          {info.getValue() || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'productionDate',
      header: 'Üretim Tarihi',
      enableSorting: true,
      cell: info => (
        <span className="px-2 py-1 bg-green-50 text-green-800 rounded font-medium text-sm">
          {info.getValue() || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'carrierLabel',
      header: 'Carrier Label',
      enableSorting: true,
      cell: info => (
        <span className="font-mono text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
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
              <div className="flex items-center gap-4 text-sm">
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
                  {packageData.SOURCE_GLN_NAME && (
                    <span className="ml-2 text-amber-400">
                      ({packageData.SOURCE_GLN_NAME}
                      {packageData.SOURCE_GLN_ILCE && ` - ${packageData.SOURCE_GLN_ILCE}`}
                      {packageData.SOURCE_GLN_IL && ` / ${packageData.SOURCE_GLN_IL}`})
                    </span>
                  )}
                </div>
                <div className="bg-dark-800/80 border border-dark-700 px-3 py-1.5 rounded-lg">
                  <span className="font-semibold text-slate-400">Hedef GLN:</span>{' '}
                  <span className="font-mono text-slate-200">{packageData.DESTINATION_GLN || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TanStack Table - Dark Theme */}
      <div className="flex-1 px-6 py-4 overflow-auto table-container">
        <div className="bg-dark-800/60 rounded-xl border border-dark-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-dark-900/80 text-slate-300 sticky top-0 z-10 border-b border-dark-700">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider"
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
                                <ArrowUp className="w-4 h-4 text-primary-400" />
                              ) : header.column.getIsSorted() === 'desc' ? (
                                <ArrowDown className="w-4 h-4 text-primary-400" />
                              ) : (
                                <ArrowUpDown className="w-4 h-4 opacity-50" />
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
            <tbody className="divide-y divide-dark-700">
              {table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className={`
                    ${row.getIsGrouped() 
                      ? 'tanstack-table-row-group bg-dark-700/50 hover:bg-dark-700 border-l-4 border-primary-500' 
                      : 'tanstack-table-row-detail hover:bg-dark-700/30 border-l-4 border-transparent hover:border-primary-500/50'
                    }
                    transition-all duration-200 text-slate-200
                  `}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <td
                      key={cell.id}
                      className={`
                        px-4 text-sm
                        ${row.getIsGrouped() ? 'font-semibold py-2' : 'py-2.5'}
                        ${index === 0 && !row.getIsGrouped() ? 'pl-12' : ''}
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
            <tfoot className="bg-dark-900/80 border-t-2 border-primary-500/30">
              <tr>
                <td colSpan={table.getVisibleFlatColumns().length} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-400">Toplam Satır:</span>
                        <span className="px-3 py-1 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-full text-sm font-bold">
                          {products.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-400">Kalem:</span>
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-sm font-bold">
                          {new Set(products.map(p => p.gtin)).size}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

export default PTSDetailPage
