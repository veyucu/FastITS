import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { FileText, Home, QrCode, RefreshCw, User, X, Search, Hash, MapPin, Info, Trash2, AlertCircle, CheckCircle, XCircle, Package, Send, AlertTriangle, ChevronDown } from 'lucide-react'
import usePageTitle from '../hooks/usePageTitle'
import apiService from '../services/apiService'
import { parseITSBarcode, detectBarcodeType, formatExpiryDate } from '../utils/barcodeParser'

const SerbestBildirimPage = () => {
    usePageTitle('Serbest Bildirim')
    const navigate = useNavigate()
    const barcodeInputRef = useRef(null)
    const gridRef = useRef(null)

    // LocalStorage key'leri
    const STORAGE_KEY_ITEMS = 'serbest_bildirim_items'      // Detaylı kayıtlar: gtin, seriNo, miad, lotNo, bildirim, okutmaZamani, stokKodu, stokAdi, turu
    const STORAGE_KEY_BELGE = 'serbest_bildirim_belge'      // Belge No
    const STORAGE_KEY_CARI = 'serbest_bildirim_cari'        // Cari bilgileri

    // State'ler
    const [barcodeInput, setBarcodeInput] = useState('')
    const [belgeNo, setBelgeNo] = useState('')
    const [deleteMode, setDeleteMode] = useState(false)
    const [showBulkScanModal, setShowBulkScanModal] = useState(false)
    const [bulkBarcodeText, setBulkBarcodeText] = useState('') // Toplu karekod metni
    const [bulkScanLoading, setBulkScanLoading] = useState(false) // Toplu okutma loading
    const [bulkScanResults, setBulkScanResults] = useState(null) // Toplu okutma sonuçları
    const [scannedItems, setScannedItems] = useState([]) // Detaylı barkodlar (localStorage'a kaydedilir)
    const [message, setMessage] = useState(null) // {type: 'success'|'error', text: '...'}
    const [selectedStokForDetail, setSelectedStokForDetail] = useState(null) // Detay modalı için seçilen stok
    const [selectedDetailRecords, setSelectedDetailRecords] = useState([]) // Detay modalında seçili kayıtlar
    const [detailModalView, setDetailModalView] = useState('grid') // 'grid' veya 'text'
    const [showITSModal, setShowITSModal] = useState(false) // ITS Bildirim modalı
    const [itsDurumDropdownOpen, setItsDurumDropdownOpen] = useState(false) // ITS durum dropdown
    const [itsSelectedDurumlar, setItsSelectedDurumlar] = useState([]) // ITS seçili durumlar
    const [itsBildirimTuru, setItsBildirimTuru] = useState('satis') // Bildirim türü
    const [itsActionLoading, setItsActionLoading] = useState(false) // ITS işlem loading
    const [itsMessage, setItsMessage] = useState(null) // ITS işlem mesajı

    // Cari Seçimi State'leri
    const [selectedCari, setSelectedCari] = useState(null)
    const [showCariModal, setShowCariModal] = useState(false)
    const [cariSearchText, setCariSearchText] = useState('')
    const [cariler, setCariler] = useState([])
    const [cariLoading, setCariLoading] = useState(false)

    // Grid için gruplandırılmış veri (GTIN bazında toplam okutulmuş adet)
    const gridData = useMemo(() => {
        const grouped = {}
        scannedItems.forEach(item => {
            const key = item.gtin || item.stokKodu
            if (!grouped[key]) {
                grouped[key] = {
                    gtin: item.gtin,
                    stokKodu: item.stokKodu,
                    stokAdi: item.stokAdi,
                    turu: item.turu,
                    okutulan: 0
                }
            }
            grouped[key].okutulan += 1
        })
        return Object.values(grouped)
    }, [scannedItems])

    // Detay modalı için filtrelenmiş kayıtlar
    const detailItems = useMemo(() => {
        if (!selectedStokForDetail) return []
        return scannedItems.filter(item =>
            (item.gtin === selectedStokForDetail.gtin) ||
            (item.stokKodu === selectedStokForDetail.stokKodu)
        )
    }, [scannedItems, selectedStokForDetail])

    // Footer verisi (alt toplam satırı)
    const footerData = useMemo(() => {
        const totalOkutulan = gridData.reduce((sum, item) => sum + (item.okutulan || 0), 0)
        return [{
            isFooter: true,
            stokKodu: `${gridData.length} Kalem`,
            stokAdi: '',
            turu: '',
            okutulan: totalOkutulan
        }]
    }, [gridData])

    // ITS öğeleri
    const itsItems = useMemo(() => {
        return scannedItems.filter(i => i.turu === 'ITS').map((r, index) => ({
            ...r,
            siraNo: index + 1,
            id: r.seriNo || `${r.gtin}-${index}`
        }))
    }, [scannedItems])

    // ITS benzersiz bildirim durumları
    const itsUniqueDurumlar = useMemo(() => {
        const durumMap = new Map()
        itsItems.forEach(r => {
            const key = r.bildirim ?? 'null'
            if (!durumMap.has(key)) {
                durumMap.set(key, {
                    bildirim: r.bildirim,
                    mesaj: r.bildirimMesaji || (r.bildirim === 0 || r.bildirim === '0' ? 'Beklemede' : r.bildirim ? `Kod: ${r.bildirim}` : 'Beklemede'),
                    count: 0
                })
            }
            durumMap.get(key).count++
        })
        return Array.from(durumMap.values()).sort((a, b) => b.count - a.count)
    }, [itsItems])

    // Filtrelenmiş ITS kayıtları
    const filteredItsItems = useMemo(() => {
        if (itsSelectedDurumlar.length === 0) return itsItems
        return itsItems.filter(r => {
            const key = r.bildirim ?? 'null'
            return itsSelectedDurumlar.includes(key)
        })
    }, [itsItems, itsSelectedDurumlar])

    // İlk yükleme kontrolü için ref
    const isInitialized = useRef(false)

    // Sayfa yüklendiğinde localStorage'dan verileri oku
    useEffect(() => {
        // Detaylı kayıtları yükle
        const savedItems = localStorage.getItem(STORAGE_KEY_ITEMS)
        if (savedItems) {
            try {
                setScannedItems(JSON.parse(savedItems))
            } catch (e) {
                console.error('localStorage parse hatası:', e)
            }
        }
        // Belge No'yu yükle
        const savedBelge = localStorage.getItem(STORAGE_KEY_BELGE)
        if (savedBelge) {
            setBelgeNo(savedBelge)
        }
        // Cari bilgilerini yükle
        const savedCari = localStorage.getItem(STORAGE_KEY_CARI)
        if (savedCari) {
            try {
                setSelectedCari(JSON.parse(savedCari))
            } catch (e) {
                console.error('localStorage cari parse hatası:', e)
            }
        }
        // Yükleme tamamlandı, artık kaydetme yapılabilir
        setTimeout(() => {
            isInitialized.current = true
        }, 100)
    }, [])

    // scannedItems değiştiğinde localStorage'a kaydet (ilk render'ı atla)
    useEffect(() => {
        if (!isInitialized.current) return
        localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(scannedItems))
    }, [scannedItems])

    // Belge No değiştiğinde localStorage'a kaydet (ilk render'ı atla)
    useEffect(() => {
        if (!isInitialized.current) return
        localStorage.setItem(STORAGE_KEY_BELGE, belgeNo)
    }, [belgeNo])

    // Cari değiştiğinde localStorage'a kaydet
    useEffect(() => {
        if (selectedCari) {
            localStorage.setItem(STORAGE_KEY_CARI, JSON.stringify(selectedCari))
        } else {
            localStorage.removeItem(STORAGE_KEY_CARI)
        }
    }, [selectedCari])

    // Mesajı otomatik kapat
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [message])

    // Cari listesini API'den çek
    const fetchCariler = async (searchText = '') => {
        setCariLoading(true)
        console.log('🔍 fetchCariler çağrıldı, searchText:', searchText)
        try {
            const result = await apiService.getCariler(searchText)
            console.log('📋 API sonucu:', result)
            if (result.success) {
                console.log('✅ Cari sayısı:', result.data?.length || 0)
                setCariler(result.data || [])
            } else {
                console.error('❌ Cari listesi hatası:', result.message)
                setCariler([])
            }
        } catch (error) {
            console.error('❌ Cari listesi hatası:', error)
            setCariler([])
        } finally {
            setCariLoading(false)
        }
    }

    // Modal açıldığında temizle
    useEffect(() => {
        if (showCariModal) {
            setCariSearchText('') // Arama metnini temizle
            setCariler([]) // Listeyi temizle
        }
    }, [showCariModal])

    // Enter tuşuna basınca ara (en az 3 karakter)
    const handleCariSearch = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            if (cariSearchText.trim().length < 3) {
                alert('En az 3 karakter girmelisiniz')
                return
            }
            fetchCariler(cariSearchText)
        }
    }

    // Cari Modal Kolon Tanımları
    const cariModalColumnDefs = useMemo(() => [
        { headerName: 'Cari Kodu', field: 'cariKodu', width: 120 },
        { headerName: 'Cari İsim', field: 'cariIsim', flex: 1, minWidth: 200, sort: 'asc' },
        { headerName: 'İlçe', field: 'ilce', width: 120 },
        { headerName: 'İl', field: 'il', width: 100 },
        { headerName: 'GLN No', field: 'glnNo', width: 150, cellClass: 'font-mono' }
    ], [])

    // Barkod okutma işlemi
    const handleBarcodeScan = useCallback(async (e) => {
        e.preventDefault()
        const barcode = barcodeInput.trim()
        if (!barcode) return

        try {
            // Barkod tipini belirle
            const barcodeType = detectBarcodeType(barcode)

            if (barcodeType === 'its') {
                // ITS barkod parse et
                const parsedData = parseITSBarcode(barcode)
                if (!parsedData) {
                    setMessage({ type: 'error', text: 'Geçersiz ITS karekod formatı' })
                    setBarcodeInput('')
                    return
                }

                // Silme modunda mı?
                if (deleteMode) {
                    // Seri no ile bul ve sil
                    const existingIndex = scannedItems.findIndex(item => item.seriNo === parsedData.serialNumber)
                    if (existingIndex !== -1) {
                        setScannedItems(prev => prev.filter((_, i) => i !== existingIndex))
                        setMessage({ type: 'success', text: `Silindi: ${parsedData.serialNumber}` })
                    } else {
                        setMessage({ type: 'error', text: `Kayıt bulunamadı: ${parsedData.serialNumber}` })
                    }
                } else {
                    // Mükerrer kontrol
                    const isDuplicate = scannedItems.some(item => item.seriNo === parsedData.serialNumber)
                    if (isDuplicate) {
                        setMessage({ type: 'error', text: `Mükerrer! Bu seri no zaten okutulmuş: ${parsedData.serialNumber}` })
                        setBarcodeInput('')
                        return
                    }

                    // Stok bilgisini API'den al
                    let stokBilgisi = { stokKodu: parsedData.gtin, stokAdi: '', turu: 'ITS' }
                    try {
                        const stockResult = await apiService.getStockByGtin(parsedData.gtin)
                        if (stockResult.success && stockResult.data) {
                            stokBilgisi = stockResult.data
                        }
                    } catch (err) {
                        console.warn('Stok bilgisi alınamadı:', err)
                    }

                    // Yeni kayıt ekle (localStorage detay formatı)
                    const newItem = {
                        id: Date.now(),
                        gtin: parsedData.gtin,
                        seriNo: parsedData.serialNumber,
                        miad: parsedData.expiryDate,
                        lotNo: parsedData.lotNumber,
                        bildirim: null,
                        okutmaZamani: new Date().toISOString(),
                        stokKodu: stokBilgisi.stokKodu,
                        stokAdi: stokBilgisi.stokAdi,
                        turu: stokBilgisi.turu || 'ITS'
                    }
                    setScannedItems(prev => [newItem, ...prev])
                    setMessage({ type: 'success', text: `Eklendi: ${stokBilgisi.stokAdi || parsedData.gtin}` })
                }
            } else {
                // Diğer barkod tipleri (şimdilik desteklenmiyor)
                setMessage({ type: 'error', text: 'Sadece ITS karekodları desteklenmektedir' })
            }
        } catch (error) {
            console.error('Barkod işleme hatası:', error)
            setMessage({ type: 'error', text: error.message || 'Barkod işlenirken hata oluştu' })
        }

        setBarcodeInput('')
        barcodeInputRef.current?.focus()
    }, [barcodeInput, deleteMode, scannedItems])

    // Tüm verileri temizle
    const handleClearAll = () => {
        if (confirm('Tüm okutulan veriler, belge no ve cari bilgileri silinecek. Emin misiniz?')) {
            setScannedItems([])
            setBelgeNo('')
            setSelectedCari(null)
            localStorage.removeItem(STORAGE_KEY_ITEMS)
            localStorage.removeItem(STORAGE_KEY_BELGE)
            localStorage.removeItem(STORAGE_KEY_CARI)
            setMessage({ type: 'success', text: 'Tüm veriler temizlendi' })
        }
    }

    // Yenile işlemi
    const handleRefresh = () => {
        barcodeInputRef.current?.focus()
    }

    // Detay modalından seçili kayıtları sil
    const handleDeleteDetailRecords = () => {
        if (selectedDetailRecords.length === 0) {
            setMessage({ type: 'error', text: 'Silinecek kayıt seçin' })
            return
        }
        if (!confirm(`${selectedDetailRecords.length} kayıt silinecek. Emin misiniz?`)) return

        const idsToDelete = selectedDetailRecords.map(r => r.id)
        setScannedItems(prev => prev.filter(item => !idsToDelete.includes(item.id)))
        setSelectedDetailRecords([])
        setMessage({ type: 'success', text: `${idsToDelete.length} kayıt silindi` })
    }

    // Detay karekodlarını text formatında oluştur
    const generateDetailBarcodeTexts = () => {
        return detailItems.map(item => {
            const gtinFormatted = String(item.gtin || '').padStart(14, '0')
            return `01${gtinFormatted}21${item.seriNo || ''}17${item.miad || ''}10${item.lotNo || ''}`
        }).join('\n')
    }

    // ITS Sorgulama işlemi
    const handleItsSorgula = async () => {
        if (itsItems.length === 0) {
            setItsMessage({ type: 'error', text: 'Sorgulanacak kayıt yok' })
            return
        }

        setItsActionLoading(true)
        setItsMessage(null)

        try {
            // Ayarları al
            const settingsResponse = await apiService.getSettings()
            const settings = settingsResponse.success ? settingsResponse.data : null

            // Ürün listesini hazırla
            const products = itsItems.map(r => ({
                gtin: r.gtin,
                seriNo: r.seriNo,
                miad: r.miad,
                lotNo: r.lotNo
            }))

            // itsSorgula çağrısı - document.id yerine null gönder (DB update yapmayacak)
            const result = await apiService.itsSorgula(null, products, settings)

            if (result.success && result.data?.length > 0) {
                // scannedItems'ı güncelle (DB'ye yazmadan, sadece memory)
                setScannedItems(prev => prev.map(item => {
                    if (item.turu !== 'ITS') return item
                    const sonuc = result.data.find(s => s.seriNo === item.seriNo)
                    if (sonuc) {
                        return {
                            ...item,
                            bildirim: sonuc.durum,
                            bildirimMesaji: sonuc.durumMesaji || `Kod: ${sonuc.durum}`,
                            gln1: sonuc.gln1,
                            gln2: sonuc.gln2,
                            gln1Adi: sonuc.gln1Adi,
                            gln2Adi: sonuc.gln2Adi
                        }
                    }
                    return item
                }))
                setItsMessage({ type: 'success', text: result.message || 'Sorgulama tamamlandı' })
            } else {
                setItsMessage({ type: 'error', text: result.message || 'Sorgulama sonucu bulunamadı' })
            }
        } catch (error) {
            console.error('ITS Sorgulama hatası:', error)
            setItsMessage({ type: 'error', text: error.message || 'Sorgulama başarısız' })
        } finally {
            setItsActionLoading(false)
        }
    }

    // Toplu karekod okutma işlemi
    const handleBulkScan = async () => {
        const lines = bulkBarcodeText.split('\n').filter(line => line.trim())

        if (lines.length === 0) {
            setBulkScanResults({ totalCount: 0, successCount: 0, errorCount: 0, errors: [{ line: 0, message: 'Lütfen en az bir karekod girin' }] })
            return
        }

        setBulkScanLoading(true)
        setBulkScanResults(null)

        const parsedBarcodes = []
        const parseErrors = []
        let successCount = 0

        for (let i = 0; i < lines.length; i++) {
            const barcode = lines[i].trim()
            const parsed = parseITSBarcode(barcode)

            if (!parsed) {
                parseErrors.push({
                    line: i + 1,
                    barcode: barcode.substring(0, 30) + '...',
                    message: 'Geçersiz ITS karekod formatı'
                })
                continue
            }

            parsedBarcodes.push({
                line: i + 1,
                rawBarcode: barcode,
                ...parsed
            })
        }

        // Önce tüm benzersiz GTIN'leri topla ve PARALEL olarak stok bilgilerini al
        const uniqueGtins = [...new Set(parsedBarcodes.map(p => p.gtin))]
        const stockCache = {}

        // Tüm GTIN'ler için paralel API çağrısı
        await Promise.all(uniqueGtins.map(async (gtin) => {
            try {
                const stockResult = await apiService.getStockByGtin(gtin)
                stockCache[gtin] = (stockResult?.success && stockResult?.data)
                    ? stockResult.data
                    : { stokKodu: gtin, stokAdi: '', turu: 'ITS' }
            } catch (error) {
                stockCache[gtin] = { stokKodu: gtin, stokAdi: '', turu: 'ITS' }
            }
        }))

        // Şimdi tüm barkodları hızlıca işle (cache hazır)
        const newItems = []
        const addedKeys = new Set()
        const existingKeys = new Set(scannedItems.map(item => `${item.gtin}|${item.seriNo}`))

        for (const parsed of parsedBarcodes) {
            // Mükerrer kontrolü
            const compositeKey = `${parsed.gtin}|${parsed.serialNumber}`
            if (existingKeys.has(compositeKey) || addedKeys.has(compositeKey)) {
                parseErrors.push({
                    line: parsed.line,
                    barcode: parsed.rawBarcode?.substring(0, 30) + '...',
                    message: `Mükerrer! Bu GTIN+SeriNo zaten mevcut: ${parsed.serialNumber}`
                })
                continue
            }

            const stockResponse = stockCache[parsed.gtin]
            const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

            newItems.push({
                id,
                gtin: parsed.gtin,
                seriNo: parsed.serialNumber,
                miad: parsed.expiryDate,
                lotNo: parsed.lotNumber,
                stokKodu: stockResponse?.stokKodu || parsed.gtin,
                stokAdi: stockResponse?.stokAdi || '',
                turu: stockResponse?.turu || 'ITS',
                okutmaZamani: new Date().toISOString(),
                rawBarcode: parsed.rawBarcode
            })
            addedKeys.add(compositeKey)
            successCount++
        }

        // scannedItems'a ekle (localStorage'a otomatik sync olacak)
        if (newItems.length > 0) {
            setScannedItems(prev => [...prev, ...newItems])
        }

        setBulkScanResults({
            totalCount: lines.length,
            successCount,
            errorCount: parseErrors.length,
            errors: parseErrors
        })

        setBulkScanLoading(false)
    }

    // AG Grid Column Definitions
    const columnDefs = useMemo(() => [
        {
            headerName: '#',
            width: 80,
            cellClass: 'text-center font-semibold text-gray-600',
            pinned: 'left',
            cellRenderer: (params) => {
                if (params.node.rowPinned) {
                    return <span className="font-bold text-gray-400">{gridData.length}</span>
                }
                return params.node.rowIndex + 1
            }
        },
        {
            headerName: 'Türü',
            field: 'turu',
            width: 90,
            cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
            cellRenderer: (params) => {
                if (params.node.rowPinned) return null
                if (params.value === 'ITS') {
                    return <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">ITS</span>
                }
                if (params.value === 'UTS') {
                    return <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">UTS</span>
                }
                return <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-500/20 text-slate-400 border border-slate-500/30">{params.value}</span>
            }
        },
        {
            headerName: 'Stok Kodu',
            field: 'stokKodu',
            width: 150,
            cellClass: 'font-mono',
            cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
            cellRenderer: (params) => {
                if (params.node.rowPinned) return null
                return params.value
            }
        },
        {
            headerName: 'Ürün Adı',
            field: 'stokAdi',
            flex: 1,
            minWidth: 300,
            cellClass: 'font-semibold',
            cellRenderer: (params) => {
                if (params.node.rowPinned) {
                    return <span className="block w-full text-right font-bold text-gray-400 pr-4">Toplam</span>
                }
                return params.value
            }
        },
        {
            headerName: 'Okutulan',
            field: 'okutulan',
            width: 110,
            cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
            cellRenderer: (params) => {
                if (params.node.rowPinned) {
                    return (
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-primary-500/20 text-primary-400 border border-primary-500/30">
                            {params.value || 0}
                        </span>
                    )
                }
                return (
                    <span
                        className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedStokForDetail(params.data)}
                    >
                        {params.value || 0}
                    </span>
                )
            }
        }
    ], [gridData.length])

    const defaultColDef = useMemo(() => ({
        sortable: true,
        resizable: true,
        filter: false
    }), [])

    return (
        <div className="flex flex-col h-screen bg-dark-950">
            {/* Header */}
            <div className="bg-dark-900/80 backdrop-blur-sm border-b border-dark-700 relative z-50 overflow-visible">
                <div className="px-4 py-2">
                    <div className="flex items-center gap-3">
                        {/* Left - Back Button & Page Info */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => navigate('/')}
                                className="w-8 h-8 bg-dark-700 rounded flex items-center justify-center hover:bg-dark-600 transition-colors border border-dark-600"
                                title="Ana Menü"
                            >
                                <Home className="w-5 h-5 text-slate-300" />
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-lg shadow-indigo-600/30">
                                    <FileText className="w-5 h-5 text-white" />
                                </div>
                                <div className="leading-tight">
                                    <p className="text-xs font-bold text-slate-100">Serbest</p>
                                    <p className="text-xs font-bold text-slate-100">Bildirim</p>
                                </div>
                            </div>
                            {/* Belge No Badge */}
                            <div className="px-2 h-9 flex flex-col justify-center rounded-lg border bg-indigo-600/30 border-indigo-500/50">
                                <p className="text-[9px] font-medium text-indigo-300 leading-none">Belge No</p>
                                <input
                                    type="text"
                                    maxLength={16}
                                    value={belgeNo}
                                    onChange={(e) => setBelgeNo(e.target.value)}
                                    placeholder="Belge No girin ..."
                                    className="w-[8.5rem] h-5 px-1 text-xs font-bold bg-dark-700/80 text-white placeholder-indigo-200/50 rounded border border-indigo-400/50 focus:outline-none focus:border-indigo-300"
                                />
                            </div>
                            {/* Cari Bilgisi Badge - DocumentDetailPage ile aynı stil */}
                            <div
                                className="bg-dark-800/80 px-2 h-9 w-72 flex items-center rounded-lg border border-dark-700 relative group cursor-pointer hover:bg-dark-700 hover:border-cyan-500/50 transition-all"
                                onClick={() => setShowCariModal(true)}
                            >
                                <div className="flex items-start gap-1.5 w-full">
                                    <User className="w-3 h-3 text-primary-400 shrink-0 mt-0.5" />
                                    {selectedCari ? (
                                        <p className="text-xs font-bold text-slate-200 leading-tight line-clamp-2 flex-1">{selectedCari.cariIsim}</p>
                                    ) : (
                                        <p className="text-xs font-medium text-cyan-400 flex-1">Cari seçiniz...</p>
                                    )}
                                    <Info className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                                </div>
                                {/* Tooltip */}
                                {selectedCari && (
                                    <div
                                        className="absolute left-0 top-full mt-1 hidden group-hover:block w-72 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl p-3 select-text cursor-text"
                                        style={{ zIndex: 99999 }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Hash className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                                                <span className="text-slate-400">Cari Kodu:</span>
                                                <span className="text-slate-200 font-semibold">{selectedCari.cariKodu}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                <span className="text-slate-400">Konum:</span>
                                                <span className="text-slate-200 font-semibold">
                                                    {selectedCari.ilce ? `${selectedCari.ilce} / ${selectedCari.il}` : selectedCari.il || '-'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                <span className="text-slate-400">GLN No:</span>
                                                <span className="text-slate-200 font-semibold">{selectedCari.glnNo || '-'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                <span className="text-slate-400">Telefon:</span>
                                                <span className="text-slate-200 font-semibold">{selectedCari.telefon || '-'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                <span className="text-slate-400">E-Posta:</span>
                                                <span className="text-slate-200 font-semibold">{selectedCari.email || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Center - Barcode Scanner */}
                        <form onSubmit={handleBarcodeScan} className="flex-1 flex items-center gap-2">
                            {/* Silme Modu Checkbox */}
                            <label className={`flex flex-col items-center justify-center cursor-pointer px-2 h-9 rounded transition-all border shrink-0 ${deleteMode
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 ring-2 ring-rose-500/30'
                                : 'bg-dark-700/50 text-slate-300 border-dark-600 hover:bg-dark-600/50'
                                }`}>
                                <span className="font-semibold text-[10px] leading-none mb-0.5">Sil</span>
                                <input
                                    type="checkbox"
                                    checked={deleteMode}
                                    onChange={(e) => {
                                        setDeleteMode(e.target.checked)
                                        setTimeout(() => barcodeInputRef.current?.focus(), 0)
                                    }}
                                    className="w-3.5 h-3.5 cursor-pointer accent-rose-500"
                                />
                            </label>

                            {/* Barkod Input */}
                            <div className="flex-1">
                                <input
                                    ref={barcodeInputRef}
                                    type="text"
                                    value={barcodeInput}
                                    onChange={(e) => setBarcodeInput(e.target.value)}
                                    placeholder={deleteMode ? "Silmek için karekod/barkod okutun..." : "Karekod veya barkod okutun..."}
                                    className={`w-full h-9 px-3 text-base font-mono font-bold rounded-lg focus:outline-none transition-all ${deleteMode
                                        ? 'bg-dark-800 text-rose-300 border-2 border-rose-500/50 placeholder-rose-500/50 focus:ring-2 focus:ring-rose-500/30'
                                        : 'bg-dark-800 text-slate-100 border-2 border-dark-600 placeholder-slate-500 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500'
                                        }`}
                                    autoComplete="off"
                                    autoFocus
                                />
                            </div>

                            {/* Hidden submit */}
                            <button type="submit" className="hidden" aria-hidden="true" />

                            {/* Action Buttons */}
                            {!deleteMode && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setShowBulkScanModal(true)}
                                        className="w-9 h-9 flex items-center justify-center rounded transition-all bg-dark-700 text-slate-200 hover:bg-dark-600 border border-dark-600"
                                        title="Toplu Karekod Okutma"
                                    >
                                        <QrCode className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRefresh}
                                        className="w-9 h-9 flex items-center justify-center rounded transition-all bg-dark-700 text-slate-200 hover:bg-dark-600 border border-dark-600"
                                        title="Yenile"
                                    >
                                        <RefreshCw className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClearAll}
                                        className="w-9 h-9 flex items-center justify-center rounded transition-all bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 border border-rose-500/50"
                                        title="Tümünü Temizle"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowITSModal(true)}
                                        disabled={scannedItems.length === 0}
                                        className="w-9 h-9 flex items-center justify-center rounded transition-all bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 hover:bg-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="ITS Bildirim"
                                    >
                                        ITS
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => console.log('PTS Gönderimi')}
                                        className="w-9 h-9 flex items-center justify-center rounded transition-all bg-dark-700 text-slate-200 border border-dark-600 hover:bg-dark-600"
                                        title="PTS Gönderimi"
                                    >
                                        PTS
                                    </button>
                                </>
                            )}
                        </form>
                    </div>
                </div>
            </div>

            {/* AG Grid */}
            <div className="flex-1 px-3 py-3 relative">
                <div className="ag-theme-alpine rounded-xl overflow-hidden border border-dark-700 h-full relative">
                    <AgGridReact
                        ref={gridRef}
                        rowData={gridData}
                        pinnedBottomRowData={footerData}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        getRowId={(params) => params.data.gtin || params.data.stokKodu}
                        enableCellTextSelection={true}
                        ensureDomOrder={true}
                        rowClass="cursor-pointer hover:bg-dark-700/50"
                        animateRows={false}
                        rowHeight={50}
                        headerHeight={48}
                        getRowClass={(params) => params.node.rowPinned ? 'bg-dark-700 font-bold' : ''}
                        localeText={{
                            noRowsToShow: 'Henüz karekod okutulmadı'
                        }}
                    />
                    {/* Message Overlay - Grid üzerinde */}
                    {message && (
                        <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg flex items-center gap-2 shadow-xl ${message.type === 'success'
                            ? 'bg-emerald-600/90 text-white'
                            : 'bg-rose-600/90 text-white'
                            }`}>
                            {message.type === 'success' ? (
                                <CheckCircle className="w-5 h-5 shrink-0" />
                            ) : (
                                <AlertCircle className="w-5 h-5 shrink-0" />
                            )}
                            <span className="text-sm font-semibold">{message.text}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Cari Seçim Modal */}
            {showCariModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-dark-800 rounded-2xl shadow-2xl border border-dark-700 w-full max-w-5xl max-h-[90vh] flex flex-col">
                        {/* Modal Header with Search */}
                        <div className="flex items-center gap-3 px-4 py-2 border-b border-dark-700">
                            <h2 className="text-base font-bold text-slate-100 shrink-0">Cari Seçimi</h2>
                            <div className="flex-1 flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        value={cariSearchText}
                                        onChange={(e) => setCariSearchText(e.target.value)}
                                        onKeyDown={handleCariSearch}
                                        placeholder="En az 3 karakter girin..."
                                        className="w-full pl-10 pr-4 py-1.5 bg-dark-700 border border-dark-600 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (cariSearchText.trim().length < 3) {
                                            alert('En az 3 karakter girmelisiniz')
                                            return
                                        }
                                        fetchCariler(cariSearchText)
                                    }}
                                    className="px-4 py-1.5 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-500 transition-colors shrink-0"
                                >
                                    Ara
                                </button>
                            </div>
                            <button
                                onClick={() => setShowCariModal(false)}
                                className="w-7 h-7 flex items-center justify-center rounded hover:bg-dark-700 transition-colors shrink-0"
                            >
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>
                        {/* Grid */}
                        <div className="flex-1 p-3 overflow-hidden">
                            <div className="ag-theme-alpine rounded-lg overflow-hidden border border-dark-700" style={{ height: '520px', width: '100%' }}>
                                <AgGridReact
                                    rowData={cariler}
                                    columnDefs={cariModalColumnDefs}
                                    defaultColDef={{
                                        sortable: true,
                                        resizable: true
                                    }}
                                    rowClass="cursor-pointer hover:bg-dark-700/50"
                                    rowHeight={45}
                                    headerHeight={40}
                                    onRowDoubleClicked={(event) => {
                                        setSelectedCari(event.data)
                                        setShowCariModal(false)
                                        setCariSearchText('')
                                    }}
                                    localeText={{
                                        noRowsToShow: 'Arama yapın (en az 3 karakter)'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Detay Modal - Okutulan karekodları göster */}
            {selectedStokForDetail && (
                <div
                    className="fixed inset-0 flex items-center justify-center"
                    style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
                    onClick={() => setSelectedStokForDetail(null)}
                >
                    <div
                        className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-5xl mx-4 shadow-2xl max-h-[80vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-primary-600/30 to-cyan-600/30 border-b border-primary-500/30 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-100">Okutulan Karekodlar</h2>
                                    <p className="text-sm text-primary-300">{selectedStokForDetail.stokAdi || selectedStokForDetail.stokKodu}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-xs text-slate-400">Toplam Okutulan</p>
                                        <p className="text-2xl font-bold text-primary-400">{detailItems.length}</p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedStokForDetail(null)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark-600 transition-colors text-slate-400 hover:text-slate-200"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 p-4 overflow-hidden bg-dark-800">
                            {detailModalView === 'grid' && (
                                <div className="ag-theme-alpine-dark h-full" style={{ height: '400px' }}>
                                    <AgGridReact
                                        rowData={detailItems}
                                        columnDefs={[
                                            {
                                                headerName: '',
                                                checkboxSelection: true,
                                                headerCheckboxSelection: true,
                                                width: 50,
                                                pinned: 'left',
                                                suppressMenu: true,
                                                cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
                                            },
                                            {
                                                headerName: '#',
                                                valueGetter: 'node.rowIndex + 1',
                                                width: 60,
                                                cellClass: 'text-center font-semibold text-slate-400'
                                            },
                                            {
                                                headerName: 'Barkod',
                                                field: 'gtin',
                                                width: 150,
                                                cellClass: 'font-mono'
                                            },
                                            {
                                                headerName: 'Seri No',
                                                field: 'seriNo',
                                                flex: 1,
                                                minWidth: 250,
                                                cellClass: 'font-mono font-bold text-primary-400'
                                            },
                                            {
                                                headerName: 'Miad',
                                                field: 'miad',
                                                width: 120,
                                                cellClass: 'text-center font-semibold',
                                                valueFormatter: (params) => {
                                                    if (!params.value || params.value.length !== 6) return params.value
                                                    const yy = params.value.substring(0, 2)
                                                    const mm = params.value.substring(2, 4)
                                                    const dd = params.value.substring(4, 6)
                                                    return `${dd}.${mm}.20${yy}`
                                                }
                                            },
                                            {
                                                headerName: 'Lot',
                                                field: 'lotNo',
                                                width: 150,
                                                cellClass: 'font-mono'
                                            },
                                            {
                                                headerName: 'Okutma Tarihi',
                                                field: 'okutmaZamani',
                                                width: 160,
                                                cellClass: 'text-slate-400',
                                                valueFormatter: (params) => {
                                                    if (!params.value) return ''
                                                    try {
                                                        return new Date(params.value).toLocaleString('tr-TR')
                                                    } catch {
                                                        return params.value
                                                    }
                                                }
                                            }
                                        ]}
                                        defaultColDef={{
                                            sortable: true,
                                            resizable: true,
                                            filter: true
                                        }}
                                        rowSelection="multiple"
                                        suppressRowClickSelection={true}
                                        onSelectionChanged={(event) => {
                                            setSelectedDetailRecords(event.api.getSelectedRows())
                                        }}
                                        animateRows={true}
                                        enableCellTextSelection={true}
                                    />
                                </div>
                            )}

                            {detailModalView === 'text' && (
                                <textarea
                                    readOnly
                                    value={generateDetailBarcodeTexts()}
                                    className="w-full font-mono text-sm p-4 bg-dark-900 border border-dark-600 rounded-lg resize-none focus:outline-none text-slate-200"
                                    style={{ height: '400px' }}
                                    placeholder="Karekod verisi yok..."
                                />
                            )}

                            {/* Action Bar */}
                            <div className="flex items-center gap-3 border-t border-dark-600 pt-4 mt-4">
                                {detailModalView === 'grid' ? (
                                    <>
                                        <button
                                            onClick={handleDeleteDetailRecords}
                                            disabled={selectedDetailRecords.length === 0}
                                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded shadow-lg transition-all bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            🗑️ Seçilenleri Sil ({selectedDetailRecords.length})
                                        </button>
                                        <button
                                            onClick={() => setDetailModalView('text')}
                                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded shadow-lg transition-all bg-indigo-600 text-white hover:bg-indigo-700"
                                        >
                                            📝 Karekodları Göster
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setDetailModalView('grid')}
                                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded shadow-lg transition-all bg-slate-600 text-white hover:bg-slate-700"
                                        >
                                            📊 Listeyi Göster
                                        </button>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(generateDetailBarcodeTexts())
                                                setMessage({ type: 'success', text: 'Karekodlar kopyalandı!' })
                                            }}
                                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded shadow-lg transition-all bg-emerald-600 text-white hover:bg-emerald-700"
                                        >
                                            📋 Tümünü Kopyala
                                        </button>
                                    </>
                                )}
                                <div className="flex-1" />
                                <span className="text-slate-400 text-sm">{detailItems.length} karekod</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ITS Bildirim Modal */}
            {showITSModal && (
                <div
                    className="fixed inset-0 flex items-center justify-center"
                    style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
                    onClick={() => setShowITSModal(false)}
                >
                    <div
                        className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-7xl mx-4 shadow-2xl max-h-[95vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Loading Overlay */}
                        {itsActionLoading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-xl">
                                <div className="bg-dark-800 rounded-xl p-6 border border-dark-600 flex flex-col items-center gap-3">
                                    <div className="animate-spin w-10 h-10 border-4 border-dark-600 border-t-indigo-500 rounded-full" />
                                    <p className="text-slate-200 font-medium">İşlem yapılıyor...</p>
                                    <p className="text-slate-400 text-sm">Lütfen bekleyin</p>
                                </div>
                            </div>
                        )}

                        {/* Mesaj */}
                        {itsMessage && (
                            <div className={`mx-3 mt-2 px-3 py-1.5 rounded-lg border text-sm ${itsMessage.type === 'error'
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                : itsMessage.type === 'success'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                }`}>
                                <p className="font-medium">{itsMessage.text}</p>
                            </div>
                        )}
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-3 border-b border-dark-700 shrink-0 bg-dark-800/50">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Package className="w-5 h-5 text-indigo-400" />
                                    <h2 className="text-lg font-bold text-slate-100">ITS Bildirim</h2>
                                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs font-semibold rounded">
                                        {filteredItsItems.length}/{itsItems.length}
                                    </span>
                                </div>
                                <div className="h-5 w-px bg-dark-600" />
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-slate-400">
                                        <FileText className="w-3.5 h-3.5 inline mr-1" />
                                        <span className="font-bold text-slate-100">{belgeNo || 'Belge No Yok'}</span>
                                    </span>
                                    <span className="text-slate-400">
                                        <User className="w-3.5 h-3.5 inline mr-1" />
                                        <span className="font-bold text-slate-100 max-w-[180px] truncate inline-block align-bottom">
                                            {selectedCari?.cariIsim || 'Cari Seçilmedi'}
                                        </span>
                                    </span>
                                    <span className="text-slate-400">
                                        <Hash className="w-3.5 h-3.5 inline mr-1" />
                                        <span className={`font-bold ${selectedCari?.glnNo ? 'text-indigo-400' : 'text-rose-400'}`}>
                                            {selectedCari?.glnNo || 'GLN Yok'}
                                        </span>
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowITSModal(false)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-dark-700 text-slate-300 hover:bg-rose-600 hover:text-white transition-all"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Grid */}
                        <div className="flex-1 p-3 overflow-hidden">
                            <div className="ag-theme-alpine-dark h-full" style={{ height: 'calc(95vh - 160px)', minHeight: '400px' }}>
                                {scannedItems.filter(i => i.turu === 'ITS').length === 0 ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center">
                                            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                                            <p className="text-slate-400">ITS kaydı bulunamadı</p>
                                        </div>
                                    </div>
                                ) : (
                                    <AgGridReact
                                        rowData={filteredItsItems}
                                        columnDefs={[
                                            {
                                                headerName: '#',
                                                field: 'siraNo',
                                                width: 60,
                                                cellClass: 'text-center font-mono text-slate-400'
                                            },
                                            {
                                                headerName: 'GTIN',
                                                field: 'gtin',
                                                width: 140,
                                                cellClass: 'font-mono text-sm text-indigo-400'
                                            },
                                            {
                                                headerName: 'Ürün Adı',
                                                field: 'stokAdi',
                                                flex: 1,
                                                minWidth: 200,
                                                cellClass: 'text-sm'
                                            },
                                            {
                                                headerName: 'Seri No',
                                                field: 'seriNo',
                                                width: 180,
                                                cellClass: 'font-mono text-sm'
                                            },
                                            {
                                                headerName: 'Miad',
                                                field: 'miad',
                                                width: 110,
                                                cellClass: 'font-mono text-center text-amber-400',
                                                valueFormatter: (params) => {
                                                    if (!params.value || params.value.length !== 6) return params.value || '-'
                                                    const yy = params.value.substring(0, 2)
                                                    const mm = params.value.substring(2, 4)
                                                    const dd = params.value.substring(4, 6)
                                                    return `${dd}.${mm}.20${yy}`
                                                }
                                            },
                                            {
                                                headerName: 'Lot No',
                                                field: 'lotNo',
                                                width: 110,
                                                cellClass: 'font-mono text-sm'
                                            },
                                            {
                                                headerName: 'Bildirim',
                                                field: 'bildirim',
                                                flex: 1,
                                                minWidth: 200,
                                                cellClass: 'text-left',
                                                cellRenderer: (params) => {
                                                    const bildirimKodu = params.value
                                                    const mesaj = params.data?.bildirimMesaji || bildirimKodu || 'Beklemede'
                                                    const isSuccess = bildirimKodu == 1 || String(mesaj).toLowerCase().includes('başarı')
                                                    const colorClass = isSuccess ? 'text-emerald-400' : bildirimKodu ? 'text-rose-400' : 'text-slate-400'

                                                    return (
                                                        <span className={`font-semibold text-xs ${colorClass}`} title={`Kod: ${bildirimKodu || '-'}`}>
                                                            {mesaj}
                                                        </span>
                                                    )
                                                }
                                            }
                                        ]}
                                        defaultColDef={{
                                            sortable: true,
                                            resizable: true,
                                            filter: true,
                                            cellStyle: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }
                                        }}
                                        getRowId={(params) => params.data.id}
                                        animateRows={true}
                                        enableCellTextSelection={true}
                                        suppressCellFocus={true}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 px-3 py-2 border-t border-dark-700 shrink-0 bg-dark-800/50 flex-wrap">
                            {/* Bildirim Türü Combobox */}
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400">Bildirim Türü:</span>
                                <select
                                    value={itsBildirimTuru}
                                    onChange={(e) => setItsBildirimTuru(e.target.value)}
                                    className="px-3 py-1.5 rounded-lg bg-dark-700 text-slate-200 border border-dark-600 text-sm font-medium focus:outline-none focus:border-indigo-500 min-w-[200px]"
                                >
                                    <option value="satis">Satış Bildirimi</option>
                                    <option value="satis-iptal">Satış İptal Bildirimi</option>
                                    <option value="alis">Alım Bildirimi</option>
                                    <option value="iade-alis">İade Alım Bildirimi</option>
                                    <option value="deaktivasyon">Deaktivasyon</option>
                                    <option value="deaktivasyon-iptal">Deaktivasyon İptal</option>
                                </select>
                            </div>

                            {/* Bildirim Yap Butonu */}
                            <button
                                onClick={() => {
                                    const bildirimAdlari = {
                                        'satis': 'Satış Bildirimi',
                                        'satis-iptal': 'Satış İptal Bildirimi',
                                        'alis': 'Alım Bildirimi',
                                        'iade-alis': 'İade Alım Bildirimi',
                                        'deaktivasyon': 'Deaktivasyon',
                                        'deaktivasyon-iptal': 'Deaktivasyon İptal'
                                    }
                                    alert(`${bildirimAdlari[itsBildirimTuru]} özelliği yakında eklenecek`)
                                }}
                                disabled={itsItems.length === 0 || (['satis', 'satis-iptal', 'iade-alis'].includes(itsBildirimTuru) && !selectedCari?.glnNo)}
                                className="px-3 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 transition-all font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                <Send className="w-4 h-4" />
                                Bildirim Yap
                            </button>

                            {/* Doğrulama Butonu */}
                            <button
                                onClick={() => {
                                    alert('Doğrulama özelliği yakında eklenecek')
                                }}
                                disabled={itsItems.length === 0}
                                className="px-3 py-1.5 rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-all font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Doğrulama
                            </button>

                            {/* Sorgulama Butonu */}
                            <button
                                onClick={handleItsSorgula}
                                disabled={itsItems.length === 0 || itsActionLoading}
                                className="px-3 py-1.5 rounded-lg text-white bg-sky-600 hover:bg-sky-500 transition-all font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                <Search className="w-4 h-4" />
                                Sorgula
                            </button>

                            <div className="flex-1" />

                            {/* Durum Filtresi - Multi Select Dropdown */}
                            <div className="relative its-durum-dropdown">
                                <button
                                    onClick={() => setItsDurumDropdownOpen(!itsDurumDropdownOpen)}
                                    disabled={itsUniqueDurumlar.length === 0}
                                    className="px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 transition-all text-sm flex items-center gap-2 border border-dark-600 min-w-[180px] disabled:opacity-50"
                                >
                                    <span className="text-slate-300 truncate flex-1 text-left">
                                        {itsSelectedDurumlar.length === 0
                                            ? 'Tüm Durumlar'
                                            : `${itsSelectedDurumlar.length} durum seçili`}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${itsDurumDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {itsDurumDropdownOpen && itsUniqueDurumlar.length > 0 && (
                                    <div className="absolute bottom-full mb-1 right-0 w-72 bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-50 max-h-64 overflow-auto">
                                        {/* Tümünü Seç */}
                                        <div
                                            className="px-3 py-2 border-b border-dark-600 hover:bg-dark-700 cursor-pointer flex items-center gap-2"
                                            onClick={() => {
                                                if (itsSelectedDurumlar.length === itsUniqueDurumlar.length) {
                                                    setItsSelectedDurumlar([])
                                                } else {
                                                    setItsSelectedDurumlar(itsUniqueDurumlar.map(d => d.bildirim ?? 'null'))
                                                }
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={itsSelectedDurumlar.length === itsUniqueDurumlar.length && itsUniqueDurumlar.length > 0}
                                                onChange={() => { }}
                                                className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-slate-200">Tümünü Seç/Kaldır</span>
                                        </div>

                                        {/* Bildirim durum listesi */}
                                        {itsUniqueDurumlar.map((d) => {
                                            const key = d.bildirim ?? 'null'
                                            const isSelected = itsSelectedDurumlar.includes(key)
                                            const isSuccess = d.bildirim == 1 || String(d.mesaj).toLowerCase().includes('başarı')
                                            const isPending = !d.bildirim || d.bildirim === 0 || d.bildirim === '0'

                                            return (
                                                <div
                                                    key={key}
                                                    className="px-3 py-2 hover:bg-dark-700 cursor-pointer flex items-center gap-2"
                                                    onClick={() => {
                                                        setItsSelectedDurumlar(prev =>
                                                            prev.includes(key)
                                                                ? prev.filter(d => d !== key)
                                                                : [...prev, key]
                                                        )
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => { }}
                                                        className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-indigo-500"
                                                    />
                                                    <span className={`text-sm flex-1 truncate ${isSuccess ? 'text-emerald-400' : isPending ? 'text-slate-400' : 'text-rose-400'}`}>
                                                        {d.mesaj}
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-mono">{d.count}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            <span className="text-slate-400 text-sm">
                                {filteredItsItems.length} ITS kaydı
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Toplu Karekod Okutma Modal */}
            {showBulkScanModal && (
                <div
                    className="fixed inset-0 flex items-center justify-center p-4"
                    style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
                    onClick={() => {
                        if (!bulkScanLoading) {
                            setShowBulkScanModal(false)
                            setBulkBarcodeText('')
                            setBulkScanResults(null)
                        }
                    }}
                >
                    <div
                        className="bg-dark-800 rounded-2xl shadow-dark-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-primary-500/30 flex items-center justify-between bg-gradient-to-r from-primary-600/30 to-cyan-600/30 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary-500/20 border border-primary-500/30 rounded-lg flex items-center justify-center">
                                    <QrCode className="w-6 h-6 text-primary-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-100">Toplu ITS Karekod Okutma</h2>
                                    <p className="text-xs text-slate-400">Her satıra bir ITS karekod (2D) yazın</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowBulkScanModal(false)
                                    setBulkBarcodeText('')
                                    setBulkScanResults(null)
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark-600 transition-colors text-slate-400 hover:text-slate-200"
                                disabled={bulkScanLoading}
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
                            {/* Textarea with Line Numbers */}
                            <div className="flex-1">
                                <label className="block text-sm font-semibold text-slate-300 mb-2">
                                    ITS Karekod Listesi
                                    <span className="text-slate-500 font-normal ml-2">(Her satıra bir ITS karekod)</span>
                                </label>
                                <div className="flex border border-dark-600 rounded-lg focus-within:border-primary-500 overflow-hidden" style={{ height: '256px' }}>
                                    {/* Line Numbers */}
                                    <div
                                        className="w-10 bg-dark-700 text-dark-400 text-right pr-2 py-2 font-mono text-sm overflow-hidden select-none"
                                        style={{ lineHeight: '1.5', whiteSpace: 'pre-line' }}
                                    >
                                        {Array.from({ length: Math.max(bulkBarcodeText.split('\n').length, 10) }, (_, i) => i + 1).join('\n')}
                                    </div>
                                    {/* Textarea */}
                                    <textarea
                                        value={bulkBarcodeText}
                                        onChange={(e) => setBulkBarcodeText(e.target.value)}
                                        placeholder="ITS karekodları buraya yapıştırın...&#10;&#10;Örnek:&#10;01086992937002582110020832004322217280831102509178&#10;01086992937002582110020832004322217280831102509179"
                                        className="flex-1 p-2 font-mono text-sm resize-none focus:outline-none bg-dark-900 text-slate-100 placeholder-slate-600"
                                        style={{ lineHeight: '1.5' }}
                                        disabled={bulkScanLoading}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Results */}
                            {bulkScanResults && (
                                <div className="p-4 rounded-lg bg-dark-700 border border-dark-600">
                                    <h3 className="font-bold mb-3 text-slate-200">📊 Sonuçlar</h3>
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div className="p-3 bg-primary-500/20 border border-primary-500/30 rounded-lg">
                                            <p className="text-2xl font-bold text-primary-400">{bulkScanResults.totalCount}</p>
                                            <p className="text-xs text-primary-300">Toplam</p>
                                        </div>
                                        <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
                                            <p className="text-2xl font-bold text-emerald-400">{bulkScanResults.successCount}</p>
                                            <p className="text-xs text-emerald-300">Başarılı</p>
                                        </div>
                                        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                                            <p className="text-2xl font-bold text-red-400">{bulkScanResults.errorCount}</p>
                                            <p className="text-xs text-red-300">Hatalı</p>
                                        </div>
                                    </div>

                                    {/* Error Details */}
                                    {bulkScanResults.errors && bulkScanResults.errors.length > 0 && (
                                        <div className="mt-4">
                                            <h4 className="text-sm font-semibold text-red-400 mb-2">❌ Hatalar:</h4>
                                            <div className="max-h-32 overflow-y-auto bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                                                {bulkScanResults.errors.map((error, index) => (
                                                    <p key={index} className="text-xs text-red-300 font-mono py-0.5">
                                                        Satır {error.line}: {error.message}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-dark-700 flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowBulkScanModal(false)
                                    setBulkBarcodeText('')
                                    setBulkScanResults(null)
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded transition-all border border-dark-600 text-slate-300 hover:bg-dark-600"
                                disabled={bulkScanLoading}
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleBulkScan}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded transition-all bg-primary-600 text-white hover:bg-primary-500 shadow-lg shadow-primary-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={bulkScanLoading || !bulkBarcodeText.trim()}
                            >
                                {bulkScanLoading ? (
                                    <>
                                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                        <span>İşleniyor...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-5 h-5" />
                                        <span>Kaydet ({bulkBarcodeText.split('\n').filter(l => l.trim()).length} satır)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default SerbestBildirimPage
