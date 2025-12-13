import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { 
  ArrowLeft, Package, CheckCircle, XCircle, Barcode, 
  AlertTriangle, User, MapPin, Calendar, Hash
} from 'lucide-react'
import apiService from '../services/apiService'

const DocumentDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const barcodeInputRef = useRef(null)
  
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [message, setMessage] = useState(null)
  const [stats, setStats] = useState({ total: 0, prepared: 0, remaining: 0 })
  const [loading, setLoading] = useState(true)

  // Load order and items from API
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true)
        console.log('Fetching document with ID:', id)
        const response = await apiService.getDocumentById(id)
        console.log('API Response:', response)
        
        if (response.success && response.data) {
          const doc = response.data
          console.log('Document data:', doc)
          setOrder(doc)
          setItems(doc.items || [])
          updateStats(doc.items || [])
        } else {
          console.error('API response unsuccessful or no data:', response)
        }
      } catch (error) {
        console.error('Belge yükleme hatası:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchDocument()
  }, [id])

  // Auto focus barcode input
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }, [])

  // Update statistics
  const updateStats = (currentItems) => {
    const total = currentItems.length
    const prepared = currentItems.filter(item => item.isPrepared).length
    const remaining = total - prepared
    setStats({ total, prepared, remaining })
  }

  // Calculate totals for footer
  const totals = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0)
    const totalOkutulan = items.reduce((sum, item) => sum + (item.okutulan || 0), 0)
    const totalKalan = totalQuantity - totalOkutulan
    
    return {
      rowNumber: items.length,
      turu: '',
      barcode: '',
      productName: 'Toplam',
      quantity: totalQuantity,
      okutulan: totalOkutulan,
      kalan: totalKalan
    }
  }, [items])

  // Column Definitions
  const columnDefs = useMemo(() => [
    {
      headerName: '#',
      valueGetter: (params) => {
        // Footer için toplam satır sayısını göster
        if (params.node.rowPinned === 'bottom') {
          return params.api.getDisplayedRowCount() - 1 // -1 çünkü footer'ı saymamalıyız
        }
        return params.node.rowIndex + 1
      },
      width: 60,
      cellClass: 'text-center font-semibold text-gray-600',
      pinned: 'left',
      cellClassRules: {
        'font-bold text-gray-900 bg-gray-100': (params) => params.node.rowPinned === 'bottom'
      }
    },
    {
      headerName: 'Türü',
      field: 'turu',
      width: 80,
      cellClass: 'text-center font-semibold',
      cellStyle: (params) => {
        if (params.node.rowPinned === 'bottom') return { backgroundColor: '#f3f4f6' }
        if (params.value === 'ITS') return { color: '#2563eb', fontWeight: 'bold' }
        if (params.value === 'UTS') return { color: '#dc2626', fontWeight: 'bold' }
        return { color: '#6b7280', fontWeight: 'bold' }
      }
    },
    {
      headerName: 'Stok Kodu',
      field: 'barcode',
      width: 150,
      cellClass: 'font-mono font-semibold',
      cellClassRules: {
        'bg-gray-100': (params) => params.node.rowPinned === 'bottom'
      }
    },
    {
      headerName: 'Ürün Adı',
      field: 'productName',
      flex: 1,
      minWidth: 300,
      cellClassRules: {
        'font-bold text-right bg-gray-100': (params) => params.node.rowPinned === 'bottom'
      }
    },
    {
      headerName: 'Miktar',
      field: 'quantity',
      width: 100,
      cellClass: 'text-center font-semibold',
      cellClassRules: {
        'font-bold bg-blue-50 text-blue-700': (params) => params.node.rowPinned === 'bottom'
      }
    },
    {
      headerName: 'Okutulan',
      field: 'okutulan',
      width: 100,
      cellClass: 'text-center font-semibold',
      cellClassRules: {
        'font-bold bg-green-50 text-green-700': (params) => params.node.rowPinned === 'bottom'
      }
    },
    {
      headerName: 'Kalan',
      field: 'kalan',
      width: 100,
      valueGetter: (params) => {
        if (params.node.rowPinned === 'bottom') return params.data.kalan
        return (params.data.quantity || 0) - (params.data.okutulan || 0)
      },
      cellClass: 'text-center font-semibold',
      cellClassRules: {
        'font-bold bg-yellow-50 text-yellow-700': (params) => params.node.rowPinned === 'bottom'
      }
    }
  ], [])

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: false
  }), [])

  // Handle Barcode Scan
  const handleBarcodeScan = (e) => {
    e.preventDefault()
    
    if (!barcodeInput.trim()) {
      showMessage('Lütfen bir barkod girin!', 'error')
      return
    }

    const scannedBarcode = barcodeInput.trim()
    
    // Find item by barcode
    const itemIndex = items.findIndex(item => item.barcode === scannedBarcode)
    
    if (itemIndex === -1) {
      showMessage(`Barkod bulunamadı: ${scannedBarcode}`, 'error')
      playErrorSound()
    } else if (items[itemIndex].isPrepared) {
      showMessage(`Bu ürün zaten hazırlandı: ${items[itemIndex].productName}`, 'warning')
      playWarningSound()
    } else {
      // Mark as prepared
      const updatedItems = [...items]
      updatedItems[itemIndex].isPrepared = true
      setItems(updatedItems)
      updateStats(updatedItems)
      
      showMessage(`✓ Hazırlandı: ${items[itemIndex].productName}`, 'success')
      playSuccessSound()
      
      // Check if all items are prepared
      if (updatedItems.every(item => item.isPrepared)) {
        setTimeout(() => {
          showMessage('🎉 Sipariş tamamlandı!', 'success')
        }, 500)
      }
    }
    
    setBarcodeInput('')
    barcodeInputRef.current?.focus()
  }

  // Show message
  const showMessage = (text, type) => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  // Sound effects (simple beep simulation)
  const playSuccessSound = () => {
    // You can add actual sound here
    console.log('Success beep!')
  }

  const playErrorSound = () => {
    console.log('Error beep!')
  }

  const playWarningSound = () => {
    console.log('Warning beep!')
  }

  // Row Style
  const getRowStyle = (params) => {
    if (params.data.isPrepared) {
      return { backgroundColor: '#f0fdf4', opacity: 0.8 }
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-gray-200 border-t-primary-600 rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Belge yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Belge bulunamadı</p>
          <button
            onClick={() => navigate('/documents')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Belgelere Dön
          </button>
        </div>
      </div>
    )
  }

  const completionPercentage = Math.round((stats.prepared / stats.total) * 100)

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/documents')}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{order.orderNo}</h1>
              </div>
            </div>
            
            {/* Customer Info - Center */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Müşteri</p>
                  <p className="text-sm font-semibold text-gray-900">{order.customerName}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Müşteri Kodu</p>
                  <p className="text-sm font-semibold text-gray-900">{order.customerCode}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Şehir</p>
                  <p className="text-sm font-semibold text-gray-900">{order.city}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Belge Tarihi</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {order.orderDate ? new Date(order.orderDate).toLocaleDateString('tr-TR') : '-'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold text-primary-600">{completionPercentage}%</div>
              <div className="text-xs text-gray-500">Tamamlanma</div>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode Scanner - Compact */}
      <div className="px-6 py-2 bg-gradient-to-r from-primary-500 to-primary-600">
        <form onSubmit={handleBarcodeScan}>
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/70" />
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Barkod okutun veya girin..."
                className="w-full pl-11 pr-4 py-2.5 text-base bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-lg text-white placeholder-white/70 focus:bg-white/30 focus:border-white focus:outline-none transition-all"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 bg-white text-primary-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Onayla
            </button>
            {/* Message - Inline */}
            {message && (
              <div className={`px-4 py-2.5 rounded-lg font-medium ${
                message.type === 'success' ? 'bg-green-500 text-white' :
                message.type === 'error' ? 'bg-red-500 text-white' :
                'bg-yellow-500 text-white'
              }`}>
                {message.text}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* AG Grid */}
      <div className="flex-1 px-6 py-4">
        <div className="ag-theme-alpine h-full rounded-lg shadow-lg overflow-hidden border border-gray-200">
          <AgGridReact
            rowData={items}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows={true}
            getRowStyle={getRowStyle}
            enableCellTextSelection={true}
            suppressCellFocus={true}
            pinnedBottomRowData={[totals]}
          />
        </div>
      </div>
    </div>
  )
}

export default DocumentDetailPage




