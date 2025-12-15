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
  const [showITSModal, setShowITSModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [itsRecords, setItsRecords] = useState([])
  const [selectedRecords, setSelectedRecords] = useState([])
  const [itsLoading, setItsLoading] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false) // Silme modu
  const [itsModalView, setItsModalView] = useState('grid') // 'grid' veya 'text'

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
      // FTIRSIP: '1' = Satış Faturası, '2' = Alış Faturası
      return docType === '1' ? 'Satış Faturası' : 'Alış Faturası'
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
        const item = params.data
        
        // ITS ürünleri için tıklanabilir badge
        if (item.turu === 'ITS' && okutulan > 0) {
          return (
            <button
              onClick={() => handleOpenITSModal(item)}
              className="px-3 py-1 rounded text-sm font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-colors cursor-pointer"
              title="ITS karekod detaylarını görüntüle"
            >
              {okutulan} 🔍
            </button>
          )
        }
        
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

  // ITS Modal Grid Column Definitions
  const itsModalColumnDefs = useMemo(() => [
    {
      headerName: '',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 50,
      pinned: 'left',
      suppressMenu: true
    },
    {
      headerName: '#',
      valueGetter: 'node.rowIndex + 1',
      width: 60,
      cellClass: 'text-center font-semibold text-gray-600'
    },
    {
      headerName: 'Barkod',
      field: 'barkod',
      width: 150,
      cellClass: 'font-mono'
    },
    {
      headerName: 'Seri No',
      field: 'seriNo',
      flex: 1,
      minWidth: 250,
      cellClass: 'font-mono font-bold text-primary-600'
    },
    {
      headerName: 'Miad',
      field: 'miad',
      width: 120,
      cellClass: 'text-center font-semibold'
    },
    {
      headerName: 'Lot',
      field: 'lot',
      width: 150,
      cellClass: 'font-mono'
    }
  ], [])

  const itsModalDefaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: true
  }), [])

  // Handle Barcode Scan
  const handleBarcodeScan = async (e) => {
    e.preventDefault()
    
    if (!barcodeInput.trim()) {
      showMessage('⚠️ Barkod giriniz', 'warning')
      playWarningSound()
      return
    }

    const scannedBarcode = barcodeInput.trim()
    
    // ITS Karekod kontrolü (01 ile başlıyorsa ITS karekodudur)
    const isITSBarcode = scannedBarcode.startsWith('01') && scannedBarcode.length > 30
    
    if (isITSBarcode) {
      // ITS Karekod İşlemi
      if (deleteMode) {
        await handleDeleteITSBarcode(scannedBarcode)
      } else {
        await handleITSBarcode(scannedBarcode)
      }
    } else {
      // Normal barkod işlemi (DGR/UTS)
      if (deleteMode) {
        await handleDeleteDGRBarcode(scannedBarcode)
      } else {
        await handleNormalBarcode(scannedBarcode)
      }
    }
    
    setBarcodeInput('')
    barcodeInputRef.current?.focus()
  }

  // Normal Barkod İşlemi (DGR/UTS Ürünleri - ITS DEĞİL!)
  const handleNormalBarcode = async (scannedBarcode) => {
    // Toplu okutma kontrolü: 100*Barkod formatı
    let quantity = 1
    let actualBarcode = scannedBarcode
    
    if (scannedBarcode.includes('*')) {
      const parts = scannedBarcode.split('*')
      if (parts.length === 2 && !isNaN(parts[0])) {
        quantity = parseInt(parts[0])
        actualBarcode = parts[1]
        console.log(`📦 Toplu okutma: ${quantity} adet - Barkod: ${actualBarcode}`)
      }
    }
    
    // Find item by barcode
    const itemIndex = items.findIndex(item => item.barcode === actualBarcode || item.stokKodu === actualBarcode)
    
    if (itemIndex === -1) {
      showMessage(`❌ Bulunamadı: ${actualBarcode}`, 'error')
      playErrorSound()
      return
    }
    
    const item = items[itemIndex]
    
    // ITS ürünü kontrolü - ITS ürünlerinde normal barkod kabul edilmez!
    if (item.turu === 'ITS') {
      showMessage(`❌ ${item.productName} - ITS ürünüdür! Karekod (2D) okutmalısınız!`, 'error')
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
    
    // Toplu okutma için döngü
    for (let i = 0; i < quantity; i++) {
      // Backend'e DGR barkod gönder (TBLSERITRA'ya kayıt)
      const result = await apiService.saveDGRBarcode({
        barcode: actualBarcode,
        documentId: order.id,
        itemId: item.itemId,
        stokKodu: item.stokKodu,
        belgeTip: item.stharHtur,     // STHAR_HTUR
        gckod: item.stharGckod || '', // STHAR_GCKOD
        belgeNo: order.orderNo,
        belgeTarihi: belgeTarihiFormatted, // Belge tarihi (saat yok)
        docType: order.docType,
        expectedQuantity: item.quantity // Miktar kontrolü için
      })
      
      if (!result.success) {
        // Hata varsa döngüyü kır
        if (result.error === 'QUANTITY_EXCEEDED') {
          console.error('⚠️⚠️⚠️ MİKTAR AŞIMI! Bu üründen daha fazla okutulamaz!')
          console.error('Ürün:', item.productName)
          console.error('Miktar:', item.quantity)
          
          showMessage(`❌ MİKTAR AŞIMI! ${item.productName} - ${result.message}`, 'error')
          playErrorSound()
        } else {
          showMessage(`❌ ${item.productName} - ${result.message}`, 'error')
          playErrorSound()
        }
        break
      }
    }
    
    // Tüm döngü başarılıysa, son güncellemeyi göster
    // Backend'den son durumu al
    const docResponse = await apiService.getDocumentById(order.id)
    if (docResponse.success && docResponse.data) {
      setItems(docResponse.data.items || [])
      updateStats(docResponse.data.items || [])
      
      const updatedItem = docResponse.data.items.find(i => i.itemId === item.itemId)
      if (updatedItem) {
        if (quantity > 1) {
          showMessage(`✅ ${item.productName} - ${quantity} adet eklendi (${updatedItem.okutulan}/${item.quantity})`, 'success')
        } else {
          showMessage(`✅ ${item.productName} (${updatedItem.okutulan}/${item.quantity})`, 'success')
        }
        playSuccessSound()
        
        // Check if all items are prepared
        if (docResponse.data.items.every(item => item.okutulan >= item.quantity)) {
          setTimeout(() => {
            showMessage('🎉 Tüm ürünler tamamlandı!', 'success')
            playSuccessSound()
          }, 1000)
        }
      }
    }
  }

  // ITS Barkod Silme İşlemi
  const handleDeleteITSBarcode = async (itsBarcode) => {
    try {
      console.log('🗑️ ITS Barkod siliniyor:', itsBarcode.substring(0, 50) + '...')
      showMessage('🗑️ Siliniyor...', 'info')
      
      // ITS karekoddan barkodu parse et
      const barkodPart = itsBarcode.substring(3, 16) // 13 digit barkod
      console.log('📦 Barkod parse edildi:', barkodPart)
      
      // Ürünü bul
      const itemIndex = items.findIndex(item => item.barcode === barkodPart || item.stokKodu === barkodPart)
      
      if (itemIndex === -1) {
        showMessage(`❌ Ürün bulunamadı: ${barkodPart}`, 'error')
        playErrorSound()
        return
      }
      
      const item = items[itemIndex]
      
      // Sadece ITS ürünleri için karekod silinebilir
      if (item.turu !== 'ITS') {
        showMessage(`❌ ${item.productName} - ITS ürünü değil!`, 'error')
        playErrorSound()
        return
      }
      
      // Seri numarasını karekoddan çıkar (21 ile başlayan kısım)
      const seriMatch = itsBarcode.match(/21([^\x1D]+)/)
      const seriNo = seriMatch ? seriMatch[1] : null
      
      if (!seriNo) {
        showMessage(`❌ Seri numarası okunamadı!`, 'error')
        playErrorSound()
        return
      }
      
      // Backend'e silme isteği gönder
      const result = await apiService.deleteITSBarcodeRecords(
        order.id,
        item.itemId,
        [seriNo]
      )
      
      if (result.success) {
        console.log('✅ ITS Barkod silindi!')
        
        // Grid'i yenile
        const docResponse = await apiService.getDocumentById(order.id)
        if (docResponse.success && docResponse.data) {
          setItems(docResponse.data.items || [])
          updateStats(docResponse.data.items || [])
          
          const updatedItem = docResponse.data.items.find(i => i.itemId === item.itemId)
          if (updatedItem) {
            showMessage(`🗑️ ${item.productName} - Silindi (${updatedItem.okutulan}/${item.quantity})`, 'success')
            playSuccessSound()
          }
        }
      } else {
        showMessage(`❌ ${item.productName} - ${result.message}`, 'error')
        playErrorSound()
      }
      
    } catch (error) {
      console.error('ITS Barkod Silme Hatası:', error)
      showMessage(`❌ Hata: ${error.message}`, 'error')
      playErrorSound()
    }
  }

  // DGR/UTS Barkod Silme İşlemi (ITS DEĞİL!)
  const handleDeleteDGRBarcode = async (scannedBarcode) => {
    try {
      console.log('🗑️ DGR/UTS Barkod siliniyor:', scannedBarcode)
      showMessage('🗑️ Siliniyor...', 'info')
      
      // Ürünü bul
      const itemIndex = items.findIndex(item => item.barcode === scannedBarcode || item.stokKodu === scannedBarcode)
      
      if (itemIndex === -1) {
        showMessage(`❌ Bulunamadı: ${scannedBarcode}`, 'error')
        playErrorSound()
        return
      }
      
      const item = items[itemIndex]
      
      // ITS ürünü kontrolü - ITS ürünlerinde normal barkod ile silme yapılamaz!
      if (item.turu === 'ITS') {
        showMessage(`❌ ${item.productName} - ITS ürünüdür! Silmek için karekod (2D) okutmalısınız!`, 'error')
        playErrorSound()
        return
      }
      
      // Backend'e silme isteği gönder (DGR için seri_no = stok_kodu)
      const result = await apiService.deleteITSBarcodeRecords(
        order.id,
        item.itemId,
        [item.stokKodu]  // DGR için SERI_NO = STOK_KODU
      )
      
      if (result.success) {
        console.log('✅ DGR Barkod silindi!')
        
        // Grid'i yenile
        const docResponse = await apiService.getDocumentById(order.id)
        if (docResponse.success && docResponse.data) {
          setItems(docResponse.data.items || [])
          updateStats(docResponse.data.items || [])
          
          const updatedItem = docResponse.data.items.find(i => i.itemId === item.itemId)
          if (updatedItem) {
            showMessage(`🗑️ ${item.productName} - Silindi (${updatedItem.okutulan}/${item.quantity})`, 'success')
            playSuccessSound()
          }
        }
      } else {
        showMessage(`❌ ${item.productName} - ${result.message}`, 'error')
        playErrorSound()
      }
      
    } catch (error) {
      console.error('DGR Barkod Silme Hatası:', error)
      showMessage(`❌ Hata: ${error.message}`, 'error')
      playErrorSound()
    }
  }

  // ITS Karekod İşlemi
  const handleITSBarcode = async (itsBarcode) => {
    try {
      console.log('🔍 ITS Karekod okutuldu:', itsBarcode.substring(0, 50) + '...')
      showMessage('📱 İşleniyor...', 'info')
      
      // ITS karekoddan barkodu parse et (basit parse - ilk 01'den sonraki 14 karakter)
      const barkodPart = itsBarcode.substring(3, 16) // 13 digit barkod
      console.log('📦 Barkod parse edildi:', barkodPart)
      
      // Ürünü bul
      const itemIndex = items.findIndex(item => item.barcode === barkodPart || item.stokKodu === barkodPart)
      
      if (itemIndex === -1) {
        showMessage(`❌ Ürün bulunamadı: ${barkodPart}`, 'error')
        playErrorSound()
        return
      }
      
      const item = items[itemIndex]
      
      // Sadece ITS ürünleri için karekod okutulabilir
      if (item.turu !== 'ITS') {
        showMessage(`❌ ${item.productName} - ITS ürünü değil!`, 'error')
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
        docType: order.docType,
        expectedQuantity: item.quantity // Miktar kontrolü için
      })
      
      if (result.success) {
        console.log('✅ ITS Karekod başarıyla kaydedildi!')
        console.log('Ürün:', item.productName)
        console.log('Seri No:', result.data.seriNo)
        console.log('Miad:', result.data.miad)
        console.log('Lot:', result.data.lot)
        
        // Ürünü hazırlandı olarak işaretle
        const updatedItems = [...items]
        updatedItems[itemIndex].okutulan = (updatedItems[itemIndex].okutulan || 0) + 1
        updatedItems[itemIndex].isPrepared = updatedItems[itemIndex].okutulan >= updatedItems[itemIndex].quantity
        setItems(updatedItems)
        updateStats(updatedItems)
        
        showMessage(
          `✅ ${item.productName} - Seri: ${result.data.seriNo} (${updatedItems[itemIndex].okutulan}/${item.quantity})`, 
          'success'
        )
        playSuccessSound()
        
        // Check if all items are prepared
        if (updatedItems.every(item => item.okutulan >= item.quantity)) {
          setTimeout(() => {
            showMessage('🎉 Tüm ürünler tamamlandı!', 'success')
            playSuccessSound()
          }, 1000)
        }
      } else if (result.error === 'DUPLICATE') {
        // Duplicate karekod uyarısı - HATA!
        console.error('⚠️⚠️⚠️ DUPLICATE KAREKOD! Bu seri numarası daha önce okutulmuş!')
        console.error('Ürün:', item.productName)
        console.error('Stok Kodu:', item.stokKodu)
        
        // Seri numarasını karekoddan çıkar (21 ile başlayan kısım)
        const seriMatch = itsBarcode.match(/21([^\x1D]+)/)
        const seriKisa = seriMatch ? seriMatch[1].substring(0, 12) : 'N/A'
        
        showMessage(`❌ DUPLICATE! ${item.productName} - Seri: ${seriKisa}... - Bu karekod zaten okutulmuş!`, 'error')
        playErrorSound() // Warning yerine error sesi çal
      } else if (result.error === 'QUANTITY_EXCEEDED') {
        // Miktar aşımı uyarısı
        console.error('⚠️⚠️⚠️ MİKTAR AŞIMI! Bu üründen daha fazla okutulamaz!')
        console.error('Ürün:', item.productName)
        console.error('Miktar:', item.quantity)
        
        showMessage(`❌ MİKTAR AŞIMI! ${item.productName} - ${result.message}`, 'error')
        playErrorSound()
      } else {
        showMessage(`❌ ${item.productName} - ${result.message}`, 'error')
        playErrorSound()
      }
      
    } catch (error) {
      console.error('ITS Karekod Hatası:', error)
      showMessage(`❌ Hata: ${error.message}`, 'error')
      playErrorSound()
    }
  }

  // Show message
  const showMessage = (text, type) => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  // ITS Modal Aç
  const handleOpenITSModal = async (item) => {
    try {
      setSelectedItem(item)
      setShowITSModal(true)
      setItsLoading(true)
      
      // ITS kayıtlarını getir
      const response = await apiService.getITSBarcodeRecords(order.id, item.itemId)
      
      if (response.success) {
        setItsRecords(response.data || [])
      } else {
        showMessage('ITS kayıtları yüklenemedi', 'error')
      }
    } catch (error) {
      console.error('ITS kayıtları yükleme hatası:', error)
      showMessage('ITS kayıtları yüklenemedi', 'error')
    } finally {
      setItsLoading(false)
    }
  }

  // ITS Modal Kapat
  const handleCloseITSModal = () => {
    setShowITSModal(false)
    setSelectedItem(null)
    setItsRecords([])
    setSelectedRecords([])
    setItsModalView('grid') // View'i sıfırla
  }
  
  // ITS Karekodları Text Formatında Oluştur
  const generateITSBarcodeTexts = () => {
    return itsRecords.map(record => {
      // Format: 010+ILC_GTIN+21+SERI_NO+17+ACIK1+10+ACIK2
      const parts = [
        '010',
        record.barkod || '',
        '21',
        record.seriNo || '',
        '17',
        record.miad || '',
        '10',
        record.lot || ''
      ]
      return parts.join('+')
    }).join('\n')
  }
  
  // Tüm Karekodları Kopyala
  const handleCopyAllBarcodes = () => {
    const text = generateITSBarcodeTexts()
    navigator.clipboard.writeText(text).then(() => {
      showMessage('✅ Karekodlar kopyalandı!', 'success')
      playSuccessSound()
    }).catch(err => {
      console.error('Kopyalama hatası:', err)
      showMessage('❌ Kopyalama başarısız!', 'error')
      playErrorSound()
    })
  }

  // ITS Kayıtlarını Sil
  const handleDeleteITSRecords = async () => {
    if (selectedRecords.length === 0) {
      showMessage('Lütfen silinecek kayıtları seçin', 'warning')
      return
    }

    if (!confirm(`${selectedRecords.length} kayıt silinecek. Emin misiniz?`)) {
      return
    }

    try {
      const result = await apiService.deleteITSBarcodeRecords(
        order.id,
        selectedItem.itemId,
        selectedRecords
      )

      if (result.success) {
        showMessage(`${result.deletedCount} kayıt silindi`, 'success')
        // Kayıtları yeniden yükle
        const response = await apiService.getITSBarcodeRecords(order.id, selectedItem.itemId)
        if (response.success) {
          setItsRecords(response.data || [])
          setSelectedRecords([])
        }
        
        // Ana grid'i yenile
        const docResponse = await apiService.getDocumentById(order.id)
        if (docResponse.success && docResponse.data) {
          setItems(docResponse.data.items || [])
        }
      } else {
        showMessage('Kayıtlar silinemedi: ' + result.message, 'error')
      }
    } catch (error) {
      console.error('ITS kayıt silme hatası:', error)
      showMessage('Kayıtlar silinemedi', 'error')
    }
  }

  // Sound effects - Web Audio API ile gerçek ses
  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800 // Başarı için yüksek ton
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.15)
    } catch (error) {
      console.log('Success beep!')
    }
  }

  const playErrorSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 200 // Hata için düşük ton
      oscillator.type = 'sawtooth'
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      console.log('Error beep!')
    }
  }

  const playWarningSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 500 // Uyarı için orta ton
      oscillator.type = 'square'
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)
    } catch (error) {
      console.log('Warning beep!')
    }
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
              <div className={`px-3 py-1 rounded-lg border shadow-sm ${
                order.docType === '6' 
                  ? 'bg-purple-100 border-purple-300' 
                  : order.docType === '1' 
                  ? 'bg-green-100 border-green-300' 
                  : 'bg-orange-100 border-orange-300'
              }`}>
                <p className={`text-[9px] font-medium leading-tight ${
                  order.docType === '6' 
                    ? 'text-purple-700' 
                    : order.docType === '1' 
                    ? 'text-green-700' 
                    : 'text-orange-700'
                }`}>
                  {getDocumentTypeName(order.docType, order.tipi)}
                </p>
                <h1 className={`text-sm font-bold leading-tight ${
                  order.docType === '6' 
                    ? 'text-purple-900' 
                    : order.docType === '1' 
                    ? 'text-green-900' 
                    : 'text-orange-900'
                }`}>{order.orderNo}</h1>
              </div>
            </div>
            
            {/* Center - Customer Info Cards - Ultra Compact */}
            <div className="flex items-center gap-1.5">
              <div className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-blue-600" />
                  <div>
                    <p className="text-[9px] text-gray-500 leading-tight">Müşteri</p>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{order.customerName}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <Hash className="w-3 h-3 text-purple-600" />
                  <div>
                    <p className="text-[9px] text-gray-500 leading-tight">Kod</p>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{order.customerCode}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-green-600" />
                  <div>
                    <p className="text-[9px] text-gray-500 leading-tight">İlçe / Şehir</p>
                    <p className="text-sm font-bold text-gray-900 leading-tight">
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
                    <p className="text-sm font-bold text-gray-900 leading-tight">
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
      <div className="bg-gradient-to-r from-primary-500 to-primary-600">
        <div className="px-6 py-2">
          <form onSubmit={handleBarcodeScan}>
            <div className="flex gap-3 items-center">
              {/* Silme Modu Checkbox */}
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer bg-white/20 backdrop-blur-sm px-3 py-2.5 rounded-lg border-2 border-white/30 hover:bg-white/30 transition-all">
                  <input
                    type="checkbox"
                    checked={deleteMode}
                    onChange={(e) => setDeleteMode(e.target.checked)}
                    className="w-5 h-5 cursor-pointer accent-red-600"
                  />
                  <span className="text-white font-semibold text-sm">Sil</span>
                </label>
              </div>
              
              <div className="flex-1 relative">
                <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/70" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder={deleteMode ? "Silmek için barkod okutun (ITS için karekod gerekli)..." : "Barkod okutun (ITS: karekod, DGR/UTS: normal barkod veya 100*Barkod)"}
                  className={`w-full pl-11 pr-4 py-2.5 text-base backdrop-blur-sm border-2 rounded-lg text-white placeholder-white/70 focus:border-white focus:outline-none transition-all ${
                    deleteMode 
                      ? 'bg-red-500/30 border-red-300/50 focus:bg-red-500/40' 
                      : 'bg-white/20 border-white/30 focus:bg-white/30'
                  }`}
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                className={`px-6 py-2.5 font-semibold rounded-lg transition-colors shadow-lg ${
                  deleteMode
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-white text-primary-600 hover:bg-gray-100'
                }`}
              >
                {deleteMode ? 'Sil' : 'Onayla'}
              </button>
            </div>
          </form>
        </div>
        
        {/* Message Strip - Fixed Below Barcode Scanner - Fixed Height */}
        <div className={`px-6 py-2.5 transition-all ${
          message 
            ? message.type === 'success' 
              ? 'bg-green-600' 
              : message.type === 'error' 
              ? 'bg-red-600' 
              : message.type === 'info'
              ? 'bg-blue-600'
              : 'bg-yellow-600'
            : deleteMode 
            ? 'bg-red-700'
            : 'bg-primary-700'
        }`}>
          <p className="text-white font-medium text-center text-sm h-5 leading-5 overflow-hidden text-ellipsis whitespace-nowrap">
            {message 
              ? message.text 
              : deleteMode 
              ? '🗑️ SİLME MODU AKTİF - ITS: Karekod okutun | DGR/UTS: Normal barkod okutun' 
              : '📱 ITS ürünler için KAREKOD (2D) zorunlu | DGR/UTS için normal barkod (Toplu: 100*Barkod)'}
          </p>
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

      {/* ITS Karekod Detay Modal */}
      {showITSModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleCloseITSModal}>
          <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-5xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">ITS Karekod Detayları</h2>
                  <p className="text-sm text-primary-100">{selectedItem.productName}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-primary-100">Toplam Okutulan</p>
                    <p className="text-2xl font-bold">{itsRecords.length}</p>
                  </div>
                  <button
                    onClick={handleCloseITSModal}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col" style={{ height: 'calc(80vh - 100px)' }}>
              {itsModalView === 'grid' ? (
                <>
                  {/* ITS Records Grid */}
                  <div className="ag-theme-alpine flex-1 mb-4">
                    {itsLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="animate-spin w-8 h-8 border-3 border-gray-200 border-t-primary-600 rounded-full mx-auto mb-2" />
                          <p className="text-gray-600 text-sm">Yükleniyor...</p>
                        </div>
                      </div>
                    ) : (
                      <AgGridReact
                        rowData={itsRecords}
                        columnDefs={itsModalColumnDefs}
                        defaultColDef={itsModalDefaultColDef}
                        rowSelection="multiple"
                        suppressRowClickSelection={true}
                        onSelectionChanged={(event) => {
                          const selected = event.api.getSelectedRows()
                          setSelectedRecords(selected.map(r => r.seriNo))
                        }}
                        animateRows={true}
                        enableCellTextSelection={true}
                      />
                    )}
                  </div>

                  {/* Action Bar - Fixed at Bottom */}
                  <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
                    <button
                      onClick={handleDeleteITSRecords}
                      disabled={selectedRecords.length === 0}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                    >
                      Seçilenleri Sil
                    </button>
                    <button
                      onClick={() => setItsModalView('text')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
                    >
                      📄 Karekodları Göster
                    </button>
                    {selectedRecords.length > 0 && (
                      <span className="text-sm text-gray-600 font-semibold">
                        {selectedRecords.length} kayıt seçildi
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* ITS Karekod Text View */}
                  <div className="flex-1 mb-4 flex flex-col">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900">
                        Karekod Text Formatı
                      </h3>
                      <span className="text-sm text-gray-600">
                        {itsRecords.length} kayıt
                      </span>
                    </div>
                    <textarea
                      value={generateITSBarcodeTexts()}
                      readOnly
                      className="flex-1 w-full p-4 font-mono text-sm border border-gray-300 rounded-lg bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ minHeight: '400px' }}
                    />
                  </div>

                  {/* Action Bar - Fixed at Bottom */}
                  <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
                    <button
                      onClick={() => setItsModalView('grid')}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors shadow-lg"
                    >
                      ← Tabloya Dön
                    </button>
                    <button
                      onClick={handleCopyAllBarcodes}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-lg"
                    >
                      📋 Tümünü Kopyala
                    </button>
                    <span className="text-sm text-gray-600">
                      Format: 010+BARKOD+21+SERİNO+17+MİAD+10+LOT
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentDetailPage












