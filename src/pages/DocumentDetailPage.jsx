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

  // Status Badge Component
  const StatusBadge = ({ isPrepared }) => {
    return isPrepared ? (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3.5 h-3.5" />
        Hazırlandı
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <AlertTriangle className="w-3.5 h-3.5" />
        Bekliyor
      </span>
    )
  }

  // Column Definitions
  const columnDefs = useMemo(() => [
    {
      headerName: '',
      field: 'isPrepared',
      width: 60,
      cellRenderer: (params) => (
        <div className="flex items-center justify-center h-full">
          {params.value ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-gray-300" />
          )}
        </div>
      ),
      pinned: 'left'
    },
    {
      headerName: 'Barkod',
      field: 'barcode',
      width: 150,
      cellClass: 'font-mono font-semibold',
      pinned: 'left'
    },
    {
      headerName: 'Ürün Adı',
      field: 'productName',
      flex: 1,
      minWidth: 250
    },
    {
      headerName: 'Miktar',
      field: 'quantity',
      width: 100,
      cellClass: 'text-center font-semibold'
    },
    {
      headerName: 'Birim',
      field: 'unit',
      width: 100,
      cellClass: 'text-center'
    },
    {
      headerName: 'Durum',
      field: 'isPrepared',
      width: 140,
      cellRenderer: (params) => <StatusBadge isPrepared={params.value} />
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
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/documents')}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{order.orderNo}</h1>
                <p className="text-sm text-gray-500">Belge Detayları ve Hazırlama</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-primary-600">{completionPercentage}%</div>
              <div className="text-sm text-gray-500">Tamamlanma</div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Info */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Müşteri</p>
              <p className="text-sm font-semibold text-gray-900">{order.customerName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Hash className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Müşteri Kodu</p>
              <p className="text-sm font-semibold text-gray-900">{order.customerCode}</p>
            </div>

          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Şehir</p>
              <p className="text-sm font-semibold text-gray-900">{order.city}</p>
            </div>

          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Belge Tarihi</p>
              <p className="text-sm font-semibold text-gray-900">
                {order.orderDate ? new Date(order.orderDate).toLocaleDateString('tr-TR') : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode Scanner */}
      <div className="px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600">
        <form onSubmit={handleBarcodeScan} className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Barcode className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-white/70" />
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Barkod okutun veya girin..."
                className="w-full pl-14 pr-4 py-4 text-lg bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-xl text-white placeholder-white/70 focus:bg-white/30 focus:border-white focus:outline-none transition-all"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              className="px-8 py-4 bg-white text-primary-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
            >
              Onayla
            </button>
          </div>
        </form>

        {/* Message */}
        {message && (
          <div className={`max-w-2xl mx-auto mt-4 p-4 rounded-lg font-medium ${
            message.type === 'success' ? 'bg-green-500 text-white' :
            message.type === 'error' ? 'bg-red-500 text-white' :
            'bg-yellow-500 text-white'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Toplam Kalem</p>
                <p className="text-3xl font-bold text-blue-700 mt-1">{stats.total}</p>
              </div>
              <Package className="w-10 h-10 text-blue-600/30" />
            </div>
          </div>

          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Hazırlanan</p>
                <p className="text-3xl font-bold text-green-700 mt-1">{stats.prepared}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600/30" />
            </div>
          </div>

          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">Kalan</p>
                <p className="text-3xl font-bold text-yellow-700 mt-1">{stats.remaining}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-yellow-600/30" />
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <span className="text-sm font-bold text-gray-700 min-w-[60px]">
            {stats.prepared}/{stats.total}
          </span>
        </div>
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
          />
        </div>
      </div>
    </div>
  )
}

export default DocumentDetailPage




