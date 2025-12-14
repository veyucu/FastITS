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

  // Belge tipini belirle
  const getDocumentTypeName = (docType, tipi) => {
    // docType: FTIRSIP değeri ('1', '2', '6')
    // tipi: TIPI değeri (Alış/Satış bilgisi)
    if (docType === '6') {
      return 'Sipariş'
    } else if (docType === '1' || docType === '2') {
      // TIPI alanına göre Alış veya Satış faturası
      const tipiStr = tipi ? String(tipi).toLowerCase() : ''
      if (tipiStr.includes('aliş') || tipiStr.includes('alis')) {
        return 'Alış Faturası'
      } else if (tipiStr.includes('satiş') || tipiStr.includes('satis')) {
        return 'Satış Faturası'
      }
      // Eğer TIPI bilgisi yoksa, FTIRSIP'e göre varsayılan
      return docType === '1' ? 'Alış Faturası' : 'Satış Faturası'
    }
    return 'Belge'
  }

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

  // Auto focus barcode input - sayfa yüklendiğinde ve her state değiştiğinde
  useEffect(() => {
    const timer = setTimeout(() => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [items, message])

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
      turu: null, // Footer'da türü boş olacak
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
          return items.length
        }
        return params.node.rowIndex + 1
      },
      width: 60,
      cellClass: 'text-center font-semibold text-gray-600',
      pinned: 'left',
      cellStyle: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return { borderLeft: 'none', backgroundColor: '#f9fafb' }
        }
        return { borderLeft: 'none' }
      },
      cellClassRules: {
        'font-bold text-gray-900': (params) => params.node.rowPinned === 'bottom'
      }
    },
    {
      headerName: 'Türü',
      field: 'turu',
      width: 90,
      cellClass: 'text-center',
      cellStyle: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return { backgroundColor: '#f9fafb' }
        }
        return {}
      },
      cellRenderer: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return '' // Footer'da türü boş
        }
        if (params.value === 'ITS') {
          return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">ITS</span>
        }
        if (params.value === 'UTS') {
          return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">UTS</span>
        }
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">{params.value}</span>
      }
    },
    {
      headerName: 'Stok Kodu',
      field: 'barcode',
      width: 150,
      cellClass: 'font-mono',
      cellStyle: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return { backgroundColor: '#f9fafb' }
        }
        return {}
      }
    },
    {
      headerName: 'Ürün Adı',
      field: 'productName',
      flex: 1,
      minWidth: 300,
      cellClass: 'font-bold',
      cellStyle: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return { textAlign: 'right', backgroundColor: '#f9fafb' }
        }
        return {}
      }
    },
    {
      headerName: 'Miktar',
      field: 'quantity',
      width: 110,
      cellClass: 'text-center',
      cellStyle: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return { backgroundColor: '#f9fafb' }
        }
        return {}
      },
      cellRenderer: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return (
            <span className="px-3 py-1 rounded text-sm font-bold bg-gray-100 text-gray-800">
              {params.value}
            </span>
          )
        }
        return (
          <span className="px-3 py-1 rounded text-sm font-bold bg-gray-100 text-gray-800">
            {params.value}
          </span>
        )
      }
    },
    {
      headerName: 'Okutulan',
      field: 'okutulan',
      width: 110,
      cellClass: 'text-center',
      cellStyle: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return { backgroundColor: '#f9fafb' }
        }
        return {}
      },
      cellRenderer: (params) => {
        if (params.node.rowPinned === 'bottom') {
          const val = params.value || 0
          if (val > 0) {
            return (
              <span className="px-3 py-1 rounded text-sm font-bold bg-green-100 text-green-700">
                {val}
              </span>
            )
          }
          return (
            <span className="px-3 py-1 rounded text-sm font-bold bg-gray-100 text-gray-400">
              {val}
            </span>
          )
        }
        const okutulan = params.value || 0
        if (okutulan > 0) {
          return (
            <span className="px-3 py-1 rounded text-sm font-bold bg-green-100 text-green-700">
              {okutulan}
            </span>
          )
        }
        return (
          <span className="px-3 py-1 rounded text-sm font-bold bg-gray-100 text-gray-400">
            {okutulan}
          </span>
        )
      }
    },
    {
      headerName: 'Kalan',
      field: 'kalan',
      width: 110,
      valueGetter: (params) => {
        if (params.node.rowPinned === 'bottom') return params.data.kalan
        return (params.data.quantity || 0) - (params.data.okutulan || 0)
      },
      cellClass: 'text-center',
      cellStyle: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return { backgroundColor: '#f9fafb' }
        }
        return {}
      },
      cellRenderer: (params) => {
        if (params.node.rowPinned === 'bottom') {
          const val = params.value || 0
          if (val > 0) {
            return (
              <span className="px-3 py-1 rounded text-sm font-bold bg-orange-100 text-orange-700">
                {val}
              </span>
            )
          }
          return (
            <span className="px-3 py-1 rounded text-sm font-bold bg-green-100 text-green-700">
              ✓
            </span>
          )
        }
        const kalan = params.value || 0
        if (kalan > 0) {
          return (
            <span className="px-3 py-1 rounded text-sm font-bold bg-orange-100 text-orange-700">
              {kalan}
            </span>
          )
        }
        return (
          <span className="px-3 py-1 rounded text-sm font-bold bg-green-100 text-green-700">
            ✓
          </span>
        )
      }
    }
  ], [items])

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: false
  }), [])

  // Handle Barcode Scan
  const handleBarcodeScan = async (e) => {
    e.preventDefault()
    
    if (!barcodeInput.trim()) {
      showMessage('Lütfen bir barkod girin!', 'error')
      return
    }

    const scannedBarcode = barcodeInput.trim()
    
    // ITS Karekod kontrolü (01 ile başlıyorsa ITS karekodudur)
    const isITSBarcode = scannedBarcode.startsWith('01') && scannedBarcode.length > 30
    
    if (isITSBarcode) {
      // ITS Karekod İşlemi
      await handleITSBarcode(scannedBarcode)
    } else {
      // Normal barkod işlemi
      await handleNormalBarcode(scannedBarcode)
    }
    
    setBarcodeInput('')
    barcodeInputRef.current?.focus()
  }

  // Normal Barkod İşlemi
  const handleNormalBarcode = async (scannedBarcode) => {
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
  }

  // ITS Karekod İşlemi
  const handleITSBarcode = async (itsBarcode) => {
    try {
      showMessage('📱 ITS Karekod işleniyor...', 'info')
      
      // ITS karekoddan barkodu parse et (basit parse - ilk 01'den sonraki 14 karakter)
      const barkodPart = itsBarcode.substring(3, 16) // 13 digit barkod
      
      // Ürünü bul
      const itemIndex = items.findIndex(item => item.barcode === barkodPart || item.stokKodu === barkodPart)
      
      if (itemIndex === -1) {
        showMessage(`ITS Karekodda barkod bulunamadı: ${barkodPart}`, 'error')
        playErrorSound()
        return
      }
      
      const item = items[itemIndex]
      
      // Sadece ITS ürünleri için karekod okutulabilir
      if (item.turu !== 'ITS') {
        showMessage(`Bu ürün ITS değil! Sadece ITS ürünleri için karekod okutabilirsiniz.`, 'error')
        playErrorSound()
        return
      }
      
      // Belge tarihini saat bilgisi olmadan formatla (YYYY-MM-DD) - Local time
      let belgeTarihiFormatted
      if (order.orderDate) {
        const date = new Date(order.orderDate)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        belgeTarihiFormatted = `${year}-${month}-${day}`
      } else {
        const today = new Date()
        const year = today.getFullYear()
        const month = String(today.getMonth() + 1).padStart(2, '0')
        const day = String(today.getDate()).padStart(2, '0')
        belgeTarihiFormatted = `${year}-${month}-${day}`
      }
      
      // Backend'e ITS karekod gönder
      const result = await apiService.saveITSBarcode({
        barcode: itsBarcode,
        documentId: order.id,
        itemId: item.itemId,
        stokKodu: item.stokKodu,
        belgeTip: item.stharHtur, // STHAR_HTUR
        gckod: item.stharGckod || '', // STHAR_GCKOD
        belgeNo: order.orderNo,
        belgeTarihi: belgeTarihiFormatted, // Belge tarihi (saat yok)
        docType: order.docType
      })
      
      if (result.success) {
        // Ürünü hazırlandı olarak işaretle
        const updatedItems = [...items]
        updatedItems[itemIndex].isPrepared = true
        updatedItems[itemIndex].okutulan = (updatedItems[itemIndex].okutulan || 0) + 1
        setItems(updatedItems)
        updateStats(updatedItems)
        
        showMessage(
          `✓ ITS Karekod Kaydedildi!\nÜrün: ${item.productName}\nSeri: ${result.data.seriNo}\nMiad: ${result.data.miad}`, 
          'success'
        )
        playSuccessSound()
        
        // Check if all items are prepared
        if (updatedItems.every(item => item.isPrepared)) {
          setTimeout(() => {
            showMessage('🎉 Sipariş tamamlandı!', 'success')
          }, 500)
        }
      } else {
        showMessage(`❌ ITS Karekod Hatası: ${result.message}`, 'error')
        playErrorSound()
      }
      
    } catch (error) {
      console.error('ITS Karekod Hatası:', error)
      showMessage(`❌ ITS Karekod işlenemedi: ${error.message}`, 'error')
      playErrorSound()
    }
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

  // Tamamlanma yüzdesini miktar bazında hesapla (Hook'lar early return'den ÖNCE olmalı)
  const completionPercentage = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0)
    const totalOkutulan = items.reduce((sum, item) => sum + (item.okutulan || 0), 0)
    
    if (totalQuantity === 0) return 0
    return Math.round((totalOkutulan / totalQuantity) * 100)
  }, [items])

  // Row Style - Satır renklerine göre
  const getRowStyle = (params) => {
    // Footer satırı için stil - header ile aynı renk
    if (params.node.rowPinned === 'bottom') {
      return { 
        backgroundColor: '#f9fafb',
        fontWeight: 'bold',
        borderTop: '2px solid #e5e7eb'
      }
    }
    
    const quantity = params.data.quantity || 0
    const okutulan = params.data.okutulan || 0
    
    // Tamamı okutulan → Yeşil
    if (okutulan > 0 && okutulan >= quantity) {
      return { 
        backgroundColor: '#f0fdf4'
      }
    }
    
    // Kısmen okutulan → Sarı
    if (okutulan > 0 && okutulan < quantity) {
      return { 
        backgroundColor: '#fef9e7'
      }
    }
    
    // Hiç okutulmayan → Normal (beyaz)
    return { 
      backgroundColor: '#ffffff'
    }
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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header - Ultra Compact */}
      <div className="bg-gradient-to-r from-white to-gray-50 border-b border-primary-100 shadow-sm">
        <div className="px-4 py-1.5">
          <div className="flex items-center justify-between">
            {/* Left - Back Button & Document Info */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/documents')}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-primary-50 border border-gray-200 hover:border-primary-300 transition-all shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-gray-700" />
              </button>
              <div className="bg-primary-50 px-3 py-1 rounded-lg border border-primary-200">
                <p className="text-[9px] text-primary-600 font-medium leading-tight">
                  {getDocumentTypeName(order.docType, order.tipi)}
                </p>
                <h1 className="text-sm font-bold text-primary-900 leading-tight">{order.orderNo}</h1>
              </div>
            </div>
            
            {/* Center - Customer Info Cards - Ultra Compact */}
            <div className="flex items-center gap-1.5">
              <div className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-blue-600" />
                  <div>
                    <p className="text-[9px] text-gray-500 leading-tight">Müşteri</p>
                    <p className="text-[11px] font-bold text-gray-900 leading-tight">{order.customerName}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <Hash className="w-3 h-3 text-purple-600" />
                  <div>
                    <p className="text-[9px] text-gray-500 leading-tight">Kod</p>
                    <p className="text-[11px] font-bold text-gray-900 leading-tight">{order.customerCode}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-green-600" />
                  <div>
                    <p className="text-[9px] text-gray-500 leading-tight">İlçe / Şehir</p>
                    <p className="text-[11px] font-bold text-gray-900 leading-tight">
                      {order.district ? `${order.district} / ${order.city}` : order.city}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-orange-600" />
                  <div>
                    <p className="text-[9px] text-gray-500 leading-tight">Tarih</p>
                    <p className="text-[11px] font-bold text-gray-900 leading-tight">
                      {order.orderDate ? new Date(order.orderDate).toLocaleDateString('tr-TR') : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right - Completion - Ultra Compact */}
            <div className="bg-gradient-to-br from-primary-500 to-primary-600 px-3 py-1 rounded-lg shadow-md">
              <div className="flex items-center gap-2">
                <div className="text-xl font-bold text-white leading-tight">{completionPercentage}%</div>
                <div className="w-12 bg-white/20 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all duration-500"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>
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
            suppressRowHoverHighlight={false}
            getRowClass={(params) => {
              if (params.node.rowPinned === 'bottom') {
                return 'footer-row-no-hover'
              }
              return ''
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default DocumentDetailPage




