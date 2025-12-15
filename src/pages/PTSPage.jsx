import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Home, Truck, Search } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import apiService from '../services/apiService'

const PTSPage = () => {
  const navigate = useNavigate()
  const barcodeInputRef = useRef(null)
  
  const [barcode, setBarcode] = useState('')
  const [packages, setPackages] = useState([])
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  // Mesaj göster
  const showMessage = (text, type = 'info') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  // Transfer ID ile paket sorgula
  const handleBarcodeScan = async (e) => {
    e.preventDefault()
    
    if (!barcode || barcode.length < 5) {
      showMessage('❌ Geçersiz Transfer ID!', 'error')
      return
    }

    try {
      setLoading(true)
      showMessage('🔍 Paket sorgulanıyor...', 'info')
      
      // PTS'den paket bilgisini sorgula ve indir
      const response = await apiService.queryPackage(barcode)
      
      if (response.success && response.data) {
        // Paketi listeye ekle
        const packageData = response.data
        
        // XML'i localStorage'a kaydet (manuel kontrol için)
        if (packageData._rawXML) {
          const xmlKey = `pts_xml_${barcode}`
          localStorage.setItem(xmlKey, packageData._rawXML)
          console.log(`💾 XML kaydedildi: ${xmlKey} (${packageData._rawXML.length} karakter)`)
          console.log(`📄 İlk 500 karakter:`, packageData._rawXML.substring(0, 500))
        }
        
        const newPackage = {
          id: Date.now(),
          transferId: barcode,
          timestamp: new Date().toLocaleString('tr-TR'),
          documentNumber: packageData.documentNumber || '',
          documentDate: packageData.documentDate || '',
          sourceGLN: packageData.sourceGLN || '',
          destinationGLN: packageData.destinationGLN || '',
          productCount: packageData.products?.length || 0,
          products: packageData.products || []
        }
        
        setPackages([newPackage, ...packages])
        setBarcode('')
        showMessage(`✅ Paket bilgisi alındı - ${newPackage.productCount} ürün bulundu`, 'success')
      } else {
        showMessage(`❌ ${response.message || 'Paket sorgulanamadı'}`, 'error')
      }
      
      // Input'a focus geri dön
      barcodeInputRef.current?.focus()
      
    } catch (error) {
      console.error('Paket sorgulama hatası:', error)
      showMessage('❌ Paket sorgulanamadı', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Tarih aralığına göre paket listesi çek
  const handleSearchByDate = async () => {
    if (!startDate || !endDate) {
      showMessage('❌ Başlangıç ve bitiş tarihi seçin', 'error')
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      showMessage('❌ Başlangıç tarihi bitiş tarihinden büyük olamaz', 'error')
      return
    }

    try {
      setLoading(true)
      showMessage('🔍 Paketler aranıyor...', 'info')
      
      // PTS'den transfer ID listesi al
      const searchResponse = await apiService.searchPackages(startDate, endDate)
      
      if (!searchResponse.success) {
        showMessage(`❌ ${searchResponse.message || 'Paket listesi alınamadı'}`, 'error')
        return
      }

      const transferIds = searchResponse.data || []
      
      if (transferIds.length === 0) {
        showMessage('⚠️ Belirtilen tarih aralığında paket bulunamadı', 'warning')
        return
      }

      showMessage(`📦 ${transferIds.length} paket bulundu, indiriliyor...`, 'info')

      // Her transfer ID için paket detayını indir
      const newPackages = []
      for (let i = 0; i < transferIds.length; i++) {
        try {
          const transferId = transferIds[i]
          showMessage(`📥 Paket indiriliyor: ${i + 1}/${transferIds.length}`, 'info')
          
          const response = await apiService.queryPackage(transferId)
          
          if (response.success && response.data) {
            const packageData = response.data
            console.log('📦 Paket verisi:', packageData)
            
            // XML'i localStorage'a kaydet (manuel kontrol için)
            if (packageData._rawXML) {
              const xmlKey = `pts_xml_${transferId}`
              localStorage.setItem(xmlKey, packageData._rawXML)
              console.log(`💾 XML kaydedildi: ${xmlKey} (${packageData._rawXML.length} karakter)`)
              console.log(`📄 İlk 500 karakter:`, packageData._rawXML.substring(0, 500))
            }
            
            newPackages.push({
              id: Date.now() + i,
              transferId: transferId,
              timestamp: new Date().toLocaleString('tr-TR'),
              documentNumber: packageData.documentNumber || '',
              documentDate: packageData.documentDate || '',
              sourceGLN: packageData.sourceGLN || '',
              destinationGLN: packageData.destinationGLN || '',
              productCount: packageData.products?.length || 0,
              products: packageData.products || []
            })
          } else {
            console.error('❌ Paket indirme başarısız:', response.message)
          }
        } catch (error) {
          console.error(`Transfer ${transferIds[i]} indirme hatası:`, error)
        }
      }

      setPackages([...newPackages, ...packages])
      showMessage(`✅ ${newPackages.length} paket başarıyla indirildi`, 'success')
      
    } catch (error) {
      console.error('Tarih aralığı sorgulama hatası:', error)
      showMessage('❌ Paket listesi alınamadı', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Paketi sil
  const handleDeletePackage = (id) => {
    setPackages(packages.filter(p => p.id !== id))
    showMessage('🗑️ Paket silindi', 'info')
  }

  // Tümünü temizle
  const handleClearAll = () => {
    if (packages.length === 0) return
    
    if (confirm('Tüm paketler silinecek. Emin misiniz?')) {
      setPackages([])
      showMessage('🗑️ Tüm paketler temizlendi', 'info')
    }
  }

  // LocalStorage'daki XML'leri göster
  const handleShowStoredXML = () => {
    const xmlKeys = Object.keys(localStorage).filter(key => key.startsWith('pts_xml_'))
    
    if (xmlKeys.length === 0) {
      alert('LocalStorage\'da kayıtlı XML bulunamadı. Önce paket sorgulayın.')
      return
    }
    
    const xmlList = xmlKeys.map(key => {
      const transferId = key.replace('pts_xml_', '')
      const xml = localStorage.getItem(key)
      return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTransfer ID: ${transferId}\nUzunluk: ${xml.length} karakter\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${xml}\n`
    }).join('\n')
    
    console.log('📄 LocalStorage\'daki XML\'ler:', xmlList)
    alert(`${xmlKeys.length} adet XML bulundu.\n\nBrowser Console\'a (F12) yazdırıldı.\n\nXML\'leri görmek için Console\'u açın.`)
  }

  // İstatistikler
  const stats = {
    total: packages.length,
    totalProducts: packages.reduce((sum, pkg) => sum + pkg.productCount, 0)
  }

  // Seçili paketin detayını göster
  const [selectedPackageId, setSelectedPackageId] = useState(null)

  // AG Grid Kolon Tanımları
  const columnDefs = useMemo(() => [
    {
      headerName: '',
      width: 50,
      cellRenderer: (params) => {
        const isExpanded = selectedPackageId === params.data.id
        return `
          <button 
            class="w-full h-full flex items-center justify-center hover:bg-gray-100"
            onclick="window.togglePTSPackage(${params.data.id})"
          >
            ${isExpanded ? '▼' : '▶'}
          </button>
        `
      }
    },
    {
      headerName: 'Transfer ID',
      field: 'transferId',
      width: 180,
      cellClass: 'font-mono font-bold text-blue-600'
    },
    {
      headerName: 'Belge No',
      field: 'documentNumber',
      width: 150,
      cellClass: 'font-semibold'
    },
    {
      headerName: 'Belge Tarihi',
      field: 'documentDate',
      width: 120,
      cellClass: 'text-center'
    },
    {
      headerName: 'Kaynak GLN',
      field: 'sourceGLN',
      width: 160,
      cellClass: 'font-mono text-sm'
    },
    {
      headerName: 'Hedef GLN',
      field: 'destinationGLN',
      width: 160,
      cellClass: 'font-mono text-sm'
    },
    {
      headerName: 'Ürün Sayısı',
      field: 'productCount',
      width: 110,
      cellClass: 'text-center font-bold text-green-600'
    },
    {
      headerName: 'Sorgu Zamanı',
      field: 'timestamp',
      width: 160,
      cellClass: 'text-gray-600 text-sm'
    },
    {
      headerName: 'İşlem',
      width: 80,
      cellRenderer: (params) => {
        return `
          <button 
            class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
            onclick="window.deletePTSPackage(${params.data.id})"
          >
            Sil
          </button>
        `
      }
    }
  ], [selectedPackageId])

  // Ürün detayları için kolon tanımları
  const productColumnDefs = useMemo(() => [
    {
      headerName: 'GTIN',
      field: 'gtin',
      width: 180,
      cellClass: 'font-mono font-bold'
    },
    {
      headerName: 'Seri No',
      field: 'serialNumber',
      width: 280,
      cellClass: 'font-mono text-red-600 font-bold'
    },
    {
      headerName: 'Lot No',
      field: 'lotNumber',
      width: 150,
      cellClass: 'font-mono'
    },
    {
      headerName: 'Son Kullanma',
      field: 'expirationDate',
      width: 130,
      cellClass: 'text-center'
    },
    {
      headerName: 'Carrier Label',
      field: 'carrierLabel',
      flex: 1,
      cellClass: 'font-mono text-sm'
    }
  ], [])

  // Grid options
  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true
  }), [])

  // Global functions
  if (typeof window !== 'undefined') {
    window.deletePTSPackage = (id) => {
      handleDeletePackage(id)
    }
    window.togglePTSPackage = (id) => {
      setSelectedPackageId(selectedPackageId === id ? null : id)
    }
  }

  // Seçili paketin ürünlerini bul
  const selectedPackage = packages.find(p => p.id === selectedPackageId)

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-gray-200">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Sol - Başlık */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center hover:bg-gray-700 transition-colors shadow-lg hover:shadow-xl"
                title="Ana Menü"
              >
                <Home className="w-5 h-5 text-white" />
              </button>
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">PTS - Paket Transfer Sistemi</h1>
            </div>

            {/* Orta - İstatistikler */}
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded px-3 py-1.5 text-white shadow-sm">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" />
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-medium opacity-90">Paket:</span>
                    <span className="text-base font-bold">{stats.total}</span>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded px-3 py-1.5 text-white shadow-sm">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" />
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-medium opacity-90">Ürün:</span>
                    <span className="text-base font-bold">{stats.totalProducts}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mesaj Alanı */}
      {message && (
        <div className="px-6 py-2">
          <div className={`p-3 rounded-lg text-sm font-medium ${
            message.type === 'success' ? 'bg-green-100 text-green-800' :
            message.type === 'error' ? 'bg-red-100 text-red-800' :
            message.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {message.text}
          </div>
        </div>
      )}

      {/* Sorgulama Alanı */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        {/* Tarih Aralığı Sorgulama */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Tarih Aralığına Göre Paket Listesi</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Başlangıç Tarihi</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
            
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Bitiş Tarihi</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
            
            <button
              type="button"
              onClick={handleSearchByDate}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              Paketleri Listele
            </button>
          </div>
        </div>

        {/* Transfer ID ile Tekil Sorgulama */}
        <form onSubmit={handleBarcodeScan} className="flex gap-3 items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Transfer ID ile tekil sorgulama..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
                disabled={loading}
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading || !barcode}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <Search className="w-5 h-5" />
            Sorgula
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={loading || packages.length === 0}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-xl"
          >
            Tümünü Temizle
          </button>

          <button
            type="button"
            onClick={handleShowStoredXML}
            disabled={loading}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-xl"
          >
            XML'leri Göster
          </button>
        </form>
      </div>

      {/* Paket Listesi - AG Grid */}
      <div className="flex-1 px-6 py-4 flex flex-col gap-4">
        {packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Package className="w-16 h-16 mb-4" />
            <p className="text-lg font-medium">Henüz paket sorgulanmadı</p>
            <p className="text-sm">Transfer ID veya tarih aralığı ile paket sorgulayın</p>
          </div>
        ) : (
          <>
            {/* Paketler Grid */}
            <div className="ag-theme-alpine" style={{ height: '400px' }}>
              <AgGridReact
                rowData={packages}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                animateRows={true}
                rowHeight={50}
                headerHeight={48}
              />
            </div>

            {/* Seçili Paketin Ürünleri */}
            {selectedPackage && (
              <div className="flex-1 border border-gray-300 rounded-lg bg-white">
                <div className="p-4 bg-gray-50 border-b border-gray-300 rounded-t-lg">
                  <h3 className="text-lg font-bold text-gray-700">
                    Paket İçeriği - Transfer ID: {selectedPackage.transferId}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedPackage.products.length} ürün bulundu
                  </p>
                </div>
                
                {selectedPackage.products.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Bu pakette ürün bulunamadı
                  </div>
                ) : (
                  <div className="ag-theme-alpine" style={{ height: 'calc(100% - 80px)' }}>
                    <AgGridReact
                      rowData={selectedPackage.products}
                      columnDefs={productColumnDefs}
                      defaultColDef={{
                        sortable: true,
                        filter: true,
                        resizable: true
                      }}
                      animateRows={true}
                      rowHeight={42}
                      headerHeight={44}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PTSPage

