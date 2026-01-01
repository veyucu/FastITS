import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import {
  ArrowLeft, Package, CheckCircle, XCircle, Barcode,
  AlertTriangle, User, MapPin, Calendar, Hash, FileText,
  RefreshCw, QrCode, Info
} from 'lucide-react'
import apiService from '../services/apiService'
import { log } from '../utils/debug'
import { useSound } from '../hooks/useSound'
import { parseITSBarcode } from '../utils/barcodeParser'
import { decodeDocumentId, isEncodedId } from '../utils/documentIdUtils'
import PTSModal from '../components/modals/PTSModal'
import ITSModal from '../components/modals/ITSModal'
import UTSModal from '../components/modals/UTSModal'
import BulkScanModal from '../components/modals/BulkScanModal'
import ITSBildirimModal from '../components/modals/ITSBildirimModal'
import UTSBildirimModal from '../components/modals/UTSBildirimModal'
import usePageTitle from '../hooks/usePageTitle'

const DocumentDetailPage = () => {
  usePageTitle('Belge Detay')
  const { id: rawId } = useParams()
  const navigate = useNavigate()
  const barcodeInputRef = useRef(null)
  const utsGridRef = useRef(null)
  const itsGridRef = useRef(null)

  // Decode document ID - Base64 veya eski format desteği
  const documentInfo = useMemo(() => {
    if (!rawId) return null

    // Base64 encoded mi kontrol et
    if (isEncodedId(rawId)) {
      return decodeDocumentId(rawId)
    }

    // Eski format: SUBE_KODU-FTIRSIP-FATIRS_NO
    return decodeDocumentId(rawId)
  }, [rawId])

  // API çağrıları için compositeId
  const id = documentInfo?.compositeId || rawId

  // Custom Hooks
  const { playSuccessSound, playErrorSound, playWarningSound } = useSound()

  // Belge türü adını FTIRSIP + TIPI kombinasyonuna göre döndür
  const getDocumentTypeName = (ftirsip, tipi) => {
    const isIade = tipi === 4 || tipi === '4'

    if (ftirsip === '1') {
      return isIade ? 'Satış Faturası (İade)' : 'Satış Faturası'
    } else if (ftirsip === '2') {
      return isIade ? 'Alış Faturası (İade)' : 'Alış Faturası'
    } else if (ftirsip === '4') {
      return isIade ? 'Alış İrsaliyesi (İade)' : 'Alış İrsaliyesi'
    } else if (ftirsip === '6') {
      return 'Sipariş'
    }
    return 'Bilinmeyen'
  }

  // Belge türü stilini FTIRSIP + TIPI kombinasyonuna göre döndür
  const getDocTypeStyle = (ftirsip, tipi) => {
    const isIade = tipi === 4 || tipi === '4'

    if (ftirsip === '6') {
      return { bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400', title: 'text-violet-300' }
    } else if (ftirsip === '1') {
      if (isIade) {
        return { bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-400', title: 'text-rose-300' }
      }
      return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', title: 'text-emerald-300' }
    } else if (ftirsip === '2') {
      if (isIade) {
        return { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', title: 'text-orange-300' }
      }
      return { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', title: 'text-amber-300' }
    } else if (ftirsip === '4') {
      if (isIade) {
        return { bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400', title: 'text-pink-300' }
      }
      return { bg: 'bg-sky-500/20', border: 'border-sky-500/30', text: 'text-sky-400', title: 'text-sky-300' }
    }
    return { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-400', title: 'text-slate-300' }
  }

  const [document, setDocument] = useState(null)
  const [items, setItems] = useState([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [messages, setMessages] = useState([])
  const [stats, setStats] = useState({ total: 0, prepared: 0, remaining: 0 })
  const [loading, setLoading] = useState(true)
  const [showITSModal, setShowITSModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [itsRecords, setItsRecords] = useState([])
  const [selectedRecords, setSelectedRecords] = useState([])
  const [itsLoading, setItsLoading] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false) // Silme modu
  const [koliMode, setKoliMode] = useState(false) // Koli barkodu modu
  const [itsModalView, setItsModalView] = useState('grid') // 'grid' veya 'text'

  // UTS Popup State'leri

  // UTS Modal State'leri (Grid görünümü için)
  const [showUTSModal, setShowUTSModal] = useState(false)
  const [selectedUTSItem, setSelectedUTSItem] = useState(null)
  const [utsRecords, setUtsRecords] = useState([])
  const [originalUtsRecords, setOriginalUtsRecords] = useState([]) // DB'den gelen orijinal kayıtlar
  const [selectedUTSRecords, setSelectedUTSRecords] = useState([])
  const [utsLoading, setUtsLoading] = useState(false)
  const [utsModalMessage, setUtsModalMessage] = useState(null) // Modal içi mesajlar için
  const [utsHasChanges, setUtsHasChanges] = useState(false) // Grid'de değişiklik var mı?

  // Toplu Okutma Modal State
  const [showBulkScanModal, setShowBulkScanModal] = useState(false)

  // PTS Bildirimi Modal State'leri
  const [showPTSModal, setShowPTSModal] = useState(false)

  // ITS Bildirim Modal State'i
  const [showITSBildirimModal, setShowITSBildirimModal] = useState(false)

  // UTS Bildirim Modal State'i
  const [showUTSBildirimModal, setShowUTSBildirimModal] = useState(false)

  // Belgeyi Tamamla Modal State'i
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completeCheckboxes, setCompleteCheckboxes] = useState({
    its: false,
    pts: false,
    uts: false,
    dgr: false
  })
  // Belgeyi Tamamla İşlem State'leri
  const [completeProcessing, setCompleteProcessing] = useState(false)
  const [completePhase, setCompletePhase] = useState(null) // 'its', 'pts', 'uts', null
  const [completeResults, setCompleteResults] = useState({ its: null, pts: null, uts: null })

  // Mesaj ekleme yardımcı fonksiyonu
  const addMessage = useCallback((text, type = 'info') => {
    const newMessage = { id: Date.now(), text, type }
    setMessages(prev => [...prev, newMessage])
    // 3 saniye sonra otomatik kaldır
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== newMessage.id))
    }, 3000)
  }, [])

  // Update statistics
  const updateStats = useCallback((currentItems) => {
    const total = currentItems.length
    const prepared = currentItems.filter(item => item.isPrepared).length
    const remaining = total - prepared
    setStats({ total, prepared, remaining })
  }, [])

  // Fetch document function - reusable
  const fetchDocument = useCallback(async () => {
    try {
      setLoading(true)
      log('Fetching document with ID:', id)
      const response = await apiService.getDocumentById(id)
      log('API Response:', response)

      if (response.success && response.data) {
        const doc = response.data
        log('Document data:', doc)
        setDocument(doc)
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
  }, [id, updateStats])

  // Load document and items from API
  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  // Belgeyi Tamamla - Sıralı işlem akışı
  const handleCompleteDocument = async () => {
    setCompleteProcessing(true)
    setCompleteResults({ its: null, pts: null, uts: null })

    let allSuccess = true
    const results = { its: null, pts: null, uts: null }

    // Adım 1: ITS Bildirimi
    if (completeCheckboxes.its && (document?.itsCount || 0) > 0) {
      setCompletePhase('its')
      setShowCompleteModal(false) // Ana modal'ı kapat

      // ITS action type'ı belge tipine göre belirle
      const itsAction = document?.docType === '2' ? 'alis' : 'satis'

      // Modal'ı aç ve Promise ile bekle
      const itsResult = await new Promise((resolve) => {
        setShowITSBildirimModal(true)
        // Modal'dan sonuç gelince çözülecek
        window._itsCompleteCallback = (success) => {
          resolve(success)
        }
      })

      results.its = itsResult
      if (!itsResult) allSuccess = false

      setShowITSBildirimModal(false)
      await new Promise(r => setTimeout(r, 500)) // Kısa bekleme
    }

    // Adım 2: PTS Bildirimi
    if (completeCheckboxes.pts && (document?.itsCount || 0) > 0 && !document?.ptsId) {
      setCompletePhase('pts')

      // Modal'ı aç ve Promise ile bekle
      const ptsResult = await new Promise((resolve) => {
        setShowPTSModal(true)
        window._ptsCompleteCallback = (success) => {
          resolve(success)
        }
      })

      results.pts = ptsResult
      if (!ptsResult) allSuccess = false

      setShowPTSModal(false)
      await new Promise(r => setTimeout(r, 500)) // Kısa bekleme
    }

    // Adım 3: UTS Bildirimi
    if (completeCheckboxes.uts && (document?.utsCount || 0) > 0) {
      setCompletePhase('uts')

      // Modal'ı aç ve Promise ile bekle
      const utsResult = await new Promise((resolve) => {
        setShowUTSBildirimModal(true)
        window._utsCompleteCallback = (success) => {
          resolve(success)
        }
      })

      results.uts = utsResult
      if (!utsResult) allSuccess = false

      setShowUTSBildirimModal(false)
      await new Promise(r => setTimeout(r, 500)) // Kısa bekleme
    }

    // Sonuçları kaydet
    setCompleteResults(results)

    // FAST_DURUM güncelle (kullanıcı backend'de context'ten alınıyor)
    try {
      await apiService.updateFastDurum(document.id, allSuccess ? 'OK' : 'NOK')

      if (allSuccess) {
        playSuccessSound()
        addMessage('✅ Belge tamamlandı!', 'success')
      } else {
        playWarningSound()
        addMessage('⚠️ Belge tamamlandı (bazı işlemler başarısız)', 'warning')
      }

      // Belgeyi yenile
      await fetchDocument()
    } catch (error) {
      console.error('FAST_DURUM güncelleme hatası:', error)
      playErrorSound()
      addMessage('❌ Belge durumu güncellenemedi', 'error')
    }

    setCompletePhase(null)
    setCompleteProcessing(false)
  }

  // Modal completion callbacks
  const handleITSBildirimComplete = async (success) => {
    // Belge verilerini yenile (ITS durumu değişmiş olabilir)
    if (success) {
      try {
        const response = await apiService.getDocumentById(document.id)
        if (response.success && response.data) {
          setDocument(response.data)
          setItems(response.data.items || [])
          updateStats(response.data.items || [])
        }
      } catch (error) {
        console.error('Belge yenileme hatası:', error)
      }
    }

    if (window._itsCompleteCallback) {
      window._itsCompleteCallback(success)
      delete window._itsCompleteCallback
    }
  }

  const handlePTSComplete = (success) => {
    if (window._ptsCompleteCallback) {
      window._ptsCompleteCallback(success)
      delete window._ptsCompleteCallback
    }
  }

  const handleUTSBildirimComplete = (success) => {
    if (window._utsCompleteCallback) {
      window._utsCompleteCallback(success)
      delete window._utsCompleteCallback
    }
  }

  // Auto focus barcode input - sayfa yüklendiğinde ve her state değiştiğinde
  useEffect(() => {
    const timer = setTimeout(() => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [items, messages])

  // Otomatik barkod okutma: Herhangi bir tuşa basıldığında barkod input'una focus et
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Modal açıksa iptal et
      if (showITSModal || showUTSModal) return

      // Input/textarea aktifse iptal et (zaten bir yerde yazıyoruz)
      const activeElement = document.activeElement
      if (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable) {
        return
      }

      // Özel tuşlar için iptal et (Ctrl, Alt, F1-F12, Arrow keys, vb.)
      if (e.ctrlKey || e.altKey || e.metaKey ||
        e.key === 'Escape' || e.key === 'Tab' ||
        e.key.startsWith('F') || e.key.startsWith('Arrow')) {
        return
      }

      // Barkod input'una focus et (karakter girişi yapılacak)
      if (barcodeInputRef.current && !barcodeInputRef.current.contains(activeElement)) {
        barcodeInputRef.current.focus()
        // Tuşu barkod input'una iletmek için event'i yeniden tetiklemiyoruz,
        // tarayıcı otomatik olarak focused element'e yazacak
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showITSModal, showUTSModal])

  // ITS Modal ESC tuşu desteği
  useEffect(() => {
    if (!showITSModal) return

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleCloseITSModal()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showITSModal])

  // Calculate totals for footer
  const totals = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0)
    const totalOkutulan = items.reduce((sum, item) => sum + (item.okutulan || 0), 0)
    const totalKalan = totalQuantity - totalOkutulan
    const completionPercent = totalQuantity > 0 ? Math.round((totalOkutulan / totalQuantity) * 100) : 0

    return {
      rowNumber: items.length,
      turu: null, // Footer'da türü boş olacak
      barcode: '',
      productName: 'Toplam',
      quantity: totalQuantity,
      okutulan: totalOkutulan,
      kalan: totalKalan,
      completionPercent
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
      colSpan: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return 3 // #, Türü ve Stok Kodu sütunlarını birleştir
        }
        return 1
      },
      cellStyle: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return { borderLeft: 'none' }
        }
        return { borderLeft: 'none' }
      },
      cellRenderer: (params) => {
        if (params.node.rowPinned === 'bottom') {
          const percent = params.data?.completionPercent || 0
          const bgColor = percent >= 100 ? '#10b981' : percent >= 50 ? '#f59e0b' : '#ef4444'
          const textColor = percent >= 100 ? '#10b981' : percent >= 50 ? '#f59e0b' : '#ef4444'

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '230px', height: '100%', padding: '0 8px' }}>
              <div style={{ flex: 1, height: '12px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(percent, 100)}%`,
                    backgroundColor: bgColor,
                    borderRadius: '999px',
                    transition: 'width 0.5s ease',
                    boxShadow: `0 0 10px ${bgColor}44`
                  }}
                />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: textColor, minWidth: '45px' }}>
                %{percent}
              </span>
            </div>
          )
        }
        return params.value
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
      pinned: 'left',
      cellStyle: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return { justifyContent: 'center' }
        }
        return { justifyContent: 'center' }
      },
      cellRenderer: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return '' // colSpan ile birleştirildi
        }
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
      field: 'barcode',
      width: 150,
      cellClass: 'font-mono',
      pinned: 'left',
      cellStyle: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return {}
        }
        return {}
      }
    },
    {
      headerName: 'Ürün Adı',
      field: 'productName',
      flex: 1,
      minWidth: 300,
      cellRenderer: (params) => {
        if (params.node.rowPinned === 'bottom') {
          const fastDurum = document?.fastDurum?.toString().trim().toUpperCase()
          const fastTarih = document?.fastTarih
          const fastKullanici = document?.fastKullanici

          // Tarih formatı
          const tarihStr = fastTarih ? new Date(fastTarih).toLocaleString('tr-TR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          }) : ''

          // Buton metni
          let buttonText = 'BELGEYİ TAMAMLA'
          if (fastDurum === 'OK') {
            buttonText = `BELGE TAMAMLANMIŞTIR${tarihStr ? ` - ${tarihStr}` : ''}${fastKullanici ? ` - ${fastKullanici}` : ''}`
          } else if (fastDurum === 'NOK') {
            buttonText = `BELGE HATALIDIR${tarihStr ? ` - ${tarihStr}` : ''}${fastKullanici ? ` - ${fastKullanici}` : ''}`
          }

          // Buton sınıfı - ITS butonu gibi
          const buttonClass = fastDurum === 'OK'
            ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30'
            : fastDurum === 'NOK'
              ? 'bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600/30'
              : 'bg-dark-700 text-slate-200 border-dark-600 hover:bg-dark-600'

          return (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'stretch',
              padding: '2px 0'
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  // Belgeyi Tamamla Modal aç
                  const hasITS = (document?.itsCount || 0) > 0
                  const hasUTS = (document?.utsCount || 0) > 0
                  const hasDGR = (document?.dgrCount || 0) > 0
                  const itsSuccess = document?.itsBildirim?.toString().trim().toUpperCase() === 'OK'
                  const utsSuccess = document?.utsBildirim?.toString().trim().toUpperCase() === 'OK'
                  const ptsExists = !!document?.ptsId
                  setCompleteCheckboxes({
                    its: hasITS && !itsSuccess, // ITS varsa ve başarılı değilse işaretli
                    pts: hasITS && !ptsExists, // ITS varsa ve PTS yapılmamışsa işaretli
                    uts: hasUTS && !utsSuccess, // UTS varsa ve başarılı değilse işaretli
                    dgr: hasDGR
                  })
                  setShowCompleteModal(true)
                }}
                style={{ width: 'calc(100% - 70px)' }}
                className={`flex items-center justify-center rounded transition-all border text-sm font-bold py-2 ${buttonClass}`}
              >
                {buttonText}
              </button>
              <span style={{ width: '70px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px' }}>{params.value}</span>
            </div>
          )
        }
        return <div style={{ fontWeight: 'bold' }}>{params.value}</div>
      },
      cellStyle: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return { padding: '0' }
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
          return { backgroundColor: '#f9fafb', justifyContent: 'center' }
        }
        return { justifyContent: 'center' }
      },
      cellRenderer: (params) => {
        if (params.node.rowPinned === 'bottom') {
          return (
            <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-primary-500/20 text-primary-400 border border-primary-500/30">
              {params.value}
            </span>
          )
        }
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-primary-500/20 text-primary-400 border border-primary-500/30">
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
          return { backgroundColor: '#f9fafb', justifyContent: 'center' }
        }
        return { justifyContent: 'center' }
      },
      cellRenderer: (params) => {
        if (params.node.rowPinned === 'bottom') {
          const val = params.value || 0
          if (val > 0) {
            return (
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {val}
              </span>
            )
          }
          return (
            <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">
              {val}
            </span>
          )
        }
        const okutulan = params.value || 0
        const item = params.data

        // ITS ürünleri için tıklanabilir badge (0'dan büyükse)
        if (item.turu === 'ITS' && okutulan > 0) {
          return (
            <button
              onClick={() => handleOpenITSModal(item)}
              className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors cursor-pointer"
              title="ITS karekod detaylarını görüntüle"
            >
              {okutulan}
            </button>
          )
        }

        // UTS ürünleri için tıklanabilir badge (0 da olsa tıklanabilir!)
        if (item.turu === 'UTS') {
          return (
            <button
              onClick={() => handleOpenUTSModal(item)}
              className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold transition-colors cursor-pointer ${okutulan > 0
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                : 'bg-slate-500/20 text-slate-400 border border-slate-500/30 hover:bg-slate-500/30'
                }`}
              title="UTS kayıtlarını görüntüle / Manuel kayıt ekle"
            >
              {okutulan}
            </button>
          )
        }

        // Diğer ürünler için normal badge
        if (okutulan > 0) {
          return (
            <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {okutulan}
            </span>
          )
        }
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">
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
          return { backgroundColor: '#f9fafb', justifyContent: 'center' }
        }
        return { justifyContent: 'center' }
      },
      cellRenderer: (params) => {
        if (params.node.rowPinned === 'bottom') {
          const val = params.value || 0
          if (val > 0) {
            return (
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {val}
              </span>
            )
          }
          if (val < 0) {
            return (
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                {val}
              </span>
            )
          }
          return (
            <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              0
            </span>
          )
        }
        const kalan = params.value || 0
        if (kalan > 0) {
          return (
            <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {kalan}
            </span>
          )
        }
        if (kalan < 0) {
          return (
            <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
              {kalan}
            </span>
          )
        }
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            0
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

  // UTS Modal Grid Column Definitions - EDITABLE
  const utsModalColumnDefs = useMemo(() => [
    {
      headerName: '',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 50,
      pinned: 'left',
      suppressMenu: true,
      editable: false,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      headerClass: 'ag-header-cell-center'
    },
    {
      headerName: '#',
      valueGetter: 'node.rowIndex + 1',
      width: 60,
      cellClass: 'text-center font-semibold text-gray-600',
      editable: false
    },
    {
      headerName: 'Seri No',
      field: 'seriNo',
      flex: 1,
      minWidth: 150,
      cellClass: 'font-mono font-bold text-red-600',
      editable: true,
      valueSetter: (params) => {
        const newValue = params.newValue ? params.newValue.trim() : ''
        params.data.seriNo = newValue

        // Seri No girildiğinde miktar otomatik 1 olmalı
        if (newValue) {
          params.data.miktar = 1
        }

        // Grid'i güncelle
        return true
      }
    },
    {
      headerName: 'Lot No',
      field: 'lot',
      width: 150,
      cellClass: 'font-mono',
      editable: true
    },
    {
      headerName: 'Üretim Tarihi',
      field: 'uretimTarihi',
      width: 150,
      cellClass: 'text-center font-semibold',
      editable: true,
      cellEditor: 'agTextCellEditor',  // agDateStringCellEditor yerine text editor kullan
      valueGetter: (params) => {
        // Grid'e YYYY-MM-DD formatında göster (edit için)
        const data = params.data
        if (!data) return ''

        // Eğer uretimTarihiDisplay varsa onu kullan
        if (data.uretimTarihiDisplay) {
          return data.uretimTarihiDisplay
        }

        // YYMMDD formatını YYYY-MM-DD'ye çevir
        if (data.uretimTarihi && data.uretimTarihi.length === 6) {
          const yy = data.uretimTarihi.substring(0, 2)
          const mm = data.uretimTarihi.substring(2, 4)
          const dd = data.uretimTarihi.substring(4, 6)
          const yyyy = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`
          return `${yyyy}-${mm}-${dd}`
        }
        return ''
      },
      valueSetter: (params) => {
        // Edit sonrası değeri kaydet
        const newValue = params.newValue
        if (!newValue) return false

        params.data.uretimTarihiDisplay = newValue

        // YYYY-MM-DD -> YYMMDD formatına çevir
        if (newValue.includes('-')) {
          const [yyyy, mm, dd] = newValue.split('-')
          const yy = yyyy.substring(2, 4)
          params.data.uretimTarihi = `${yy}${mm}${dd}`
        }
        return true
      },
      valueFormatter: (params) => {
        // Görüntüleme için DD.MM.YYYY formatı
        if (!params.value) return ''

        if (params.value.includes('-')) {
          const [yyyy, mm, dd] = params.value.split('-')
          return `${dd}.${mm}.${yyyy}`
        }
        return params.value
      }
    },
    {
      headerName: 'Miktar',
      field: 'miktar',
      width: 120,
      cellClass: (params) => {
        // Seri No varsa disabled görünümü
        if (params.data && params.data.seriNo) {
          return 'text-center font-bold bg-gray-100 text-gray-500'
        }
        return 'text-center font-bold'
      },
      editable: (params) => {
        // Sadece Seri No yoksa miktar düzenlenebilir
        return !params.data.seriNo
      },
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        min: 1,
        max: 9999,
        precision: 0
      },
      valueGetter: (params) => {
        // Seri No varsa miktar her zaman 1
        if (params.data && params.data.seriNo) {
          return 1
        }
        // Seri No yoksa miktar değerini döndür (boş olabilir)
        return params.data ? params.data.miktar : ''
      },
      valueSetter: (params) => {
        // Seri No yoksa miktarı güncelle
        if (!params.data.seriNo) {
          const val = Number(params.newValue)
          params.data.miktar = val > 0 ? val : ''
        } else {
          // Seri No varsa her zaman 1
          params.data.miktar = 1
        }
        return true
      }
    }
  ], [])

  const utsModalDefaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: true
  }), [])

  // ITS Modal Grid Column Definitions
  const itsModalColumnDefs = useMemo(() => [
    {
      headerName: '',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 50,
      pinned: 'left',
      suppressMenu: true,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      headerClass: 'ag-header-cell-center'
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
      cellClass: 'text-center font-semibold',
      valueFormatter: (params) => {
        if (!params.value) return ''
        // DATE tipinden gelen tarih (ISO string)
        const date = new Date(params.value)
        if (!isNaN(date.getTime())) {
          const dd = String(date.getDate()).padStart(2, '0')
          const mm = String(date.getMonth() + 1).padStart(2, '0')
          const yyyy = date.getFullYear()
          return `${dd}.${mm}.${yyyy}`
        }
        return ''
      }
    },
    {
      headerName: 'Lot',
      field: 'lot',
      width: 150,
      cellClass: 'font-mono'
    },
    {
      headerName: 'Koli Barkodu',
      field: 'carrierLabel',
      width: 180,
      cellClass: 'font-mono text-blue-600'
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

    // Koli barkodu otomatik algılama (00 ile başlıyorsa koli barkodudur)
    const isCarrierBarcode = scannedBarcode.startsWith('00')

    // Hem Sil hem Koli modu aktifse VEYA otomatik koli algılandıysa - Koli barkoduna göre sil
    if (deleteMode && (koliMode || isCarrierBarcode)) {
      await handleDeleteCarrierBarcode(scannedBarcode)
      setBarcodeInput('')
      return
    }

    // Sadece Koli modu aktifse VEYA otomatik koli algılandıysa - Koli barkodunu kaydet
    if (koliMode || isCarrierBarcode) {
      await handleCarrierBarcode(scannedBarcode)
      setBarcodeInput('')
      return
    }

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

  // ITS barkod işlemi (toplu okutma için)
  const handleITSBarcodeProcess = async (itsBarcode) => {
    const parsedData = parseITSBarcode(itsBarcode)
    if (!parsedData) {
      throw new Error('Geçersiz ITS karekod formatı')
    }

    const itemIndex = items.findIndex(item => {
      const normalizedGtin = item.barcode?.replace(/^0+/, '')
      const normalizedParsedGtin = parsedData.gtin?.replace(/^0+/, '')
      return normalizedGtin === normalizedParsedGtin || item.stokKodu === parsedData.gtin
    })

    if (itemIndex === -1) {
      throw new Error(`Ürün bulunamadı: ${parsedData.gtin}`)
    }

    const item = items[itemIndex]

    if (item.turu !== 'ITS') {
      throw new Error(`${item.productName} - ITS ürünü değil!`)
    }

    let belgeTarihiFormatted
    if (document.documentDate) {
      const date = new Date(document.documentDate)
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

    const result = await apiService.saveITSBarcode({
      barcode: itsBarcode,
      documentId: document.id,
      itemId: item.itemId,
      stokKodu: item.stokKodu,
      belgeTip: item.stharHtur,
      gckod: item.stharGckod || '',
      belgeNo: document.documentNo,
      belgeTarihi: belgeTarihiFormatted,
      docType: document.docType,
      expectedQuantity: item.quantity,
      cariKodu: document.customerCode
      // kullanici artık context'ten alınıyor
    })

    if (!result.success) {
      // Backend'den gelen detaylı hata mesajını kullan
      const errorMessage = result.message || result.error || 'Kayıt başarısız!'
      throw new Error(errorMessage)
    }
  }

  // Normal barkod işlemi (toplu okutma için)
  const handleNormalBarcodeProcess = async (scannedBarcode) => {
    let quantity = 1
    let actualBarcode = scannedBarcode

    if (scannedBarcode.includes('*')) {
      const parts = scannedBarcode.split('*')
      if (parts.length === 2 && !isNaN(parts[0])) {
        quantity = parseInt(parts[0])
        actualBarcode = parts[1]
      }
    }

    const itemIndex = items.findIndex(item => item.barcode === actualBarcode || item.stokKodu === actualBarcode)

    if (itemIndex === -1) {
      throw new Error(`Ürün bulunamadı: ${actualBarcode}`)
    }

    const item = items[itemIndex]

    if (item.turu === 'ITS') {
      throw new Error(`${item.productName} - ITS ürünüdür! Karekod gerekli!`)
    }

    if (item.turu === 'UTS') {
      throw new Error(`${item.productName} - UTS ürünü için manuel giriş gerekli!`)
    }

    let belgeTarihiFormatted
    if (document.documentDate) {
      const date = new Date(document.documentDate)
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

    for (let i = 0; i < quantity; i++) {
      const result = await apiService.saveDGRBarcode({
        barcode: actualBarcode,
        documentId: document.id,
        itemId: item.itemId,
        stokKodu: item.stokKodu,
        belgeTip: item.stharHtur,
        gckod: item.stharGckod || '',
        belgeNo: document.documentNo,
        belgeTarihi: belgeTarihiFormatted,
        docType: document.docType,
        expectedQuantity: item.quantity,
        cariKodu: document.customerCode
        // kullanıcı artık context'ten alınıyor
      })

      if (!result.success) {
        // Backend'den gelen detaylı hata mesajını kullan
        const errorMessage = result.message || result.error || 'Kayıt başarısız!'
        throw new Error(errorMessage)
      }
    }
  }

  // Koli Barkodu İşlemi (ITS için)
  const handleCarrierBarcode = async (carrierLabel) => {
    try {
      log('📦 Koli barkodu okutuldu:', carrierLabel)
      showMessage('📦 Koli işleniyor...', 'info')

      // kullanıcı artık backend'de context'ten alınıyor
      const result = await apiService.saveCarrierBarcode({
        carrierLabel,
        docId: id, // Belge KAYITNO
        ftirsip: document.docType,
        cariKodu: document.customerCode
        // kullanıcı artık context'ten alınıyor
      })

      if (result.success) {
        playSuccessSound()
        showMessage(`✅ ${result.message}`, 'success')

        // Local state'i güncelle (ekranı yenileme)
        const updatedItems = [...items]
        let hasChanges = false

        // Backend'den dönen GTIN'lere göre okutulan miktarlarını artır
        if (result.affectedGtins && result.affectedGtins.length > 0) {
          result.affectedGtins.forEach(gtin => {
            // Her GTIN için kaç adet ürün eklendi?
            const addedCount = result.savedCount ? Math.floor(result.savedCount / result.affectedGtins.length) : 1

            // GTIN veya STOK_KODU ile eşleşen item'ı bul
            const itemIndex = updatedItems.findIndex(item =>
              item.gtin === gtin ||
              item.stokKodu === gtin ||
              item.barcode === gtin
            )

            if (itemIndex !== -1) {
              updatedItems[itemIndex].okutulan = (updatedItems[itemIndex].okutulan || 0) + addedCount
              updatedItems[itemIndex].isPrepared = updatedItems[itemIndex].okutulan >= updatedItems[itemIndex].quantity
              hasChanges = true
            }
          })
        }

        if (hasChanges) {
          setItems(updatedItems)
          updateStats(updatedItems)
        }
      } else {
        playErrorSound()
        showMessage(`❌ ${result.message}`, 'error')
      }
    } catch (error) {
      console.error('❌ Koli barkodu işleme hatası:', error)
      playErrorSound()
      showMessage(`❌ ${error.response?.data?.message || error.message || 'Koli barkodu işlenemedi'}`, 'error')
    }
  }

  // Koli Barkodu Silme İşlemi (ITS için)
  const handleDeleteCarrierBarcode = async (carrierLabel) => {
    try {
      log('🗑️ Koli barkodu siliniyor:', carrierLabel)
      showMessage('🗑️ Koli siliniyor...', 'info')

      const result = await apiService.deleteCarrierBarcode({
        carrierLabel,
        docId: id // Belge KAYITNO
      })

      if (result.success) {
        playSuccessSound()
        showMessage(`✅ ${result.message || `${result.deletedCount} ürün koliden silindi`}`, 'success')

        // Local state'i güncelle (ekranı yenileme)
        const updatedItems = [...items]
        let hasChanges = false

        // Backend'den dönen GTIN'lere göre okutulan miktarlarını azalt
        if (result.affectedGtins && result.affectedGtins.length > 0) {
          result.affectedGtins.forEach(gtin => {
            // Her GTIN için kaç adet ürün silindi?
            const deletedCount = result.gtinCounts ? result.gtinCounts[gtin] : 0

            if (deletedCount > 0) {
              // GTIN veya STOK_KODU ile eşleşen item'ı bul
              const itemIndex = updatedItems.findIndex(item =>
                item.gtin === gtin ||
                item.stokKodu === gtin ||
                item.barcode === gtin
              )

              if (itemIndex !== -1) {
                // Okutulan miktarı azalt (negatif olmasın)
                updatedItems[itemIndex].okutulan = Math.max(0, (updatedItems[itemIndex].okutulan || 0) - deletedCount)
                updatedItems[itemIndex].isPrepared = updatedItems[itemIndex].okutulan >= updatedItems[itemIndex].quantity
                hasChanges = true
              }
            }
          })
        }

        if (hasChanges) {
          setItems(updatedItems)
          updateStats(updatedItems)
        }
      } else {
        playErrorSound()
        showMessage(`❌ ${result.message}`, 'error')
      }
    } catch (error) {
      console.error('❌ Koli barkodu silme hatası:', error)
      playErrorSound()
      showMessage(`❌ ${error.response?.data?.message || error.message || 'Koli barkodu silinemedi'}`, 'error')
    }
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

    // UTS ürünü kontrolü - UTS ürünlerinde direkt modal aç!
    if (item.turu === 'UTS') {
      handleOpenUTSModal(item)
      return
    }

    // Belge tarihini saat bilgisi olmadan formatla (YYYY-MM-DD) - Local time
    let belgeTarihiFormatted
    if (document.documentDate) {
      const date = new Date(document.documentDate)
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
        documentId: document.id,
        itemId: item.itemId,
        stokKodu: item.stokKodu,
        belgeTip: item.stharHtur,     // STHAR_HTUR
        gckod: item.stharGckod || '', // STHAR_GCKOD
        belgeNo: document.documentNo,
        belgeTarihi: belgeTarihiFormatted, // Belge tarihi (saat yok)
        docType: document.docType,
        expectedQuantity: item.quantity, // Miktar kontrolü için
        cariKodu: document.customerCode    // Belgedeki CARI_KODU
        // kullanıcı artık context'ten alınıyor
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
    const docResponse = await apiService.getDocumentById(document.id)
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
      log('🗑️ ITS Barkod siliniyor:', itsBarcode.substring(0, 50) + '...')
      showMessage('🗑️ Siliniyor...', 'info')

      // Karekodu parse et (aynı fonksiyonu kullan!)
      const parsedData = parseITSBarcode(itsBarcode)

      if (!parsedData || !parsedData.serialNumber) {
        showMessage(`❌ Seri numarası okunamadı!`, 'error')
        playErrorSound()
        return
      }

      log('✅ Parse edildi:', parsedData)

      // Ürünü bul
      const itemIndex = items.findIndex(item => {
        const normalizedGtin = item.barcode?.replace(/^0+/, '')
        const normalizedParsedGtin = parsedData.gtin?.replace(/^0+/, '')
        return normalizedGtin === normalizedParsedGtin || item.stokKodu === parsedData.gtin || item.barcode === parsedData.gtin.substring(1)
      })

      if (itemIndex === -1) {
        showMessage(`❌ Ürün bulunamadı: ${parsedData.gtin}`, 'error')
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

      const seriNo = parsedData.serialNumber

      // Backend'e silme isteği gönder
      const result = await apiService.deleteITSBarcodeRecords(
        document.id,
        item.itemId,
        [seriNo]
      )

      if (result.success) {
        log('✅ ITS Barkod silindi!')

        // Grid'i yenile
        const docResponse = await apiService.getDocumentById(document.id)
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
      log('🗑️ DGR/UTS Barkod siliniyor:', scannedBarcode)

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
        document.id,
        item.itemId,
        [item.stokKodu],  // DGR için SERI_NO = STOK_KODU
        item.turu  // 'DGR' veya 'UTS'
      )

      if (result.success) {
        log('✅ DGR Barkod silindi!')

        // Grid'i yenile
        const docResponse = await apiService.getDocumentById(document.id)
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
      log('🔍 ITS Karekod okutuldu:', itsBarcode.substring(0, 50) + '...')

      // Frontend'de parse et ve validasyon yap
      const parsedData = parseITSBarcode(itsBarcode)

      if (!parsedData) {
        showMessage('❌ Geçersiz karekod formatı!', 'error')
        playErrorSound()
        return
      }

      if (!parsedData.gtin || !parsedData.serialNumber) {
        showMessage('❌ Karekodda GTIN veya Seri No bulunamadı!', 'error')
        playErrorSound()
        return
      }

      log('📦 Parse edildi:', parsedData)

      // Ürünü bul (baştaki sıfırları kaldırarak karşılaştır)
      const itemIndex = items.findIndex(item => {
        const normalizedGtin = item.barcode?.replace(/^0+/, '')
        const normalizedParsedGtin = parsedData.gtin?.replace(/^0+/, '')
        return normalizedGtin === normalizedParsedGtin ||
          item.stokKodu === parsedData.gtin ||
          item.barcode === parsedData.gtinRaw?.substring(1)
      })

      if (itemIndex === -1) {
        showMessage(`❌ Ürün bulunamadı: ${parsedData.gtin}`, 'error')
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
      if (document.documentDate) {
        const date = new Date(document.documentDate)
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
        documentId: document.id,
        itemId: item.itemId,
        stokKodu: item.stokKodu,
        belgeTip: item.stharHtur, // STHAR_HTUR
        gckod: item.stharGckod || '', // STHAR_GCKOD
        belgeNo: document.documentNo,
        belgeTarihi: belgeTarihiFormatted, // Belge tarihi (saat yok)
        docType: document.docType,
        expectedQuantity: item.quantity, // Miktar kontrolü için
        cariKodu: document.customerCode    // Belgedeki CARI_KODU
        // kullanıcı artık context'ten alınıyor
      })

      if (result.success) {
        log('✅ ITS Karekod başarıyla kaydedildi!')
        log('Ürün:', item.productName)
        log('Seri No:', result.data.seriNo)
        log('Miad:', result.data.miad)
        log('Lot:', result.data.lot)

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

  // Show message - add to messages array for stacking
  const showMessage = (text, type) => {
    const id = Date.now()
    setMessages(prev => [...prev, { id, text, type }])
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== id))
    }, 5000)
  }

  // UTS Modal içi mesajlar için özel fonksiyon
  const showUTSMessage = (text, type) => {
    setUtsModalMessage({ text, type })
    setTimeout(() => setUtsModalMessage(null), 4000)
  }

  // UTS Modal Aç
  const handleOpenUTSModal = async (item) => {
    try {
      setSelectedUTSItem(item)
      setShowUTSModal(true)
      setUtsLoading(true)
      setUtsHasChanges(false) // Temiz başlangıç

      // UTS kayıtlarını getir
      const response = await apiService.getUTSBarcodeRecords(document.id, item.itemId)

      if (response.success) {
        // Kayıtlara uretimTarihiDisplay ve benzersiz id ekle
        const enrichedRecords = (response.data || []).map((record, index) => {
          let uretimTarihiDisplay = ''

          if (record.uretimTarihi) {
            const ut = record.uretimTarihi

            // ISO date string formatı (2025-12-31T00:00:00.000Z veya benzeri)
            if (typeof ut === 'string' && ut.includes('T')) {
              const date = new Date(ut)
              if (!isNaN(date.getTime())) {
                const yyyy = date.getFullYear()
                const mm = String(date.getMonth() + 1).padStart(2, '0')
                const dd = String(date.getDate()).padStart(2, '0')
                uretimTarihiDisplay = `${yyyy}-${mm}-${dd}`
              }
            }
            // YYMMDD formatı (6 karakter)
            else if (typeof ut === 'string' && ut.length === 6 && /^\d{6}$/.test(ut)) {
              const yy = ut.substring(0, 2)
              const mm = ut.substring(2, 4)
              const dd = ut.substring(4, 6)
              const yyyy = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`
              uretimTarihiDisplay = `${yyyy}-${mm}-${dd}`
            }
            // YYYY-MM-DD formatı (zaten doğru format)
            else if (typeof ut === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ut)) {
              uretimTarihiDisplay = ut
            }
            // Date objesi
            else if (ut instanceof Date && !isNaN(ut.getTime())) {
              const yyyy = ut.getFullYear()
              const mm = String(ut.getMonth() + 1).padStart(2, '0')
              const dd = String(ut.getDate()).padStart(2, '0')
              uretimTarihiDisplay = `${yyyy}-${mm}-${dd}`
            }
          }

          return {
            ...record,
            id: record.siraNo || `existing-${Date.now()}-${index}`, // Benzersiz ID ekle
            uretimTarihiDisplay
          }
        })
        setUtsRecords(enrichedRecords)
        setOriginalUtsRecords(JSON.parse(JSON.stringify(enrichedRecords))) // Deep copy
      } else {
        console.error('UTS kayıtları yüklenemedi')
      }
    } catch (error) {
      console.error('UTS kayıtları yükleme hatası:', error)
    } finally {
      setUtsLoading(false)
    }
  }

  // UTS Modal Kapat
  const handleCloseUTSModal = (skipWarning = false) => {
    // Eğer skipWarning bir event ise (onClick'ten geliyorsa), false olarak ayarla
    const shouldSkipWarning = typeof skipWarning === 'boolean' ? skipWarning : false;

    // Kaydedilmemiş değişiklik varsa uyar (ama kaydet butonundan geliyorsa uyarma)
    if (!shouldSkipWarning && utsHasChanges) {
      const confirmClose = confirm('⚠️ Ekrandaki veriler kaydedilmemiştir. Modal kapatılsın mı?\n\nEmin misiniz?');
      if (!confirmClose) {
        return; // Modal'ı kapatma
      }
    }

    setShowUTSModal(false);
    setSelectedUTSItem(null);
    setUtsRecords([]);
    setSelectedUTSRecords([]);
    setUtsModalMessage(null); // Modal mesajını temizle
    setUtsHasChanges(false); // Değişiklik flag'ini temizle
  };

  // UTS Kayıtlarını Sil
  const handleDeleteUTSRecords = () => {
    if (selectedUTSRecords.length === 0) {
      showUTSMessage('⚠️ Lütfen silinecek kayıtları seçin', 'warning')
      playErrorSound()
      return
    }

    if (!confirm(`${selectedUTSRecords.length} kayıt grid'den kaldırılacak. "Kaydet" butonuna basınca veri tabanından silinecek. Emin misiniz?`)) {
      return
    }

    // Seçili kayıtların ID'lerini al
    const selectedIds = selectedUTSRecords.map(r => r.id)

    // Sadece grid'den kaldır - ID'ye göre filtrele
    const filteredRecords = utsRecords.filter(record => !selectedIds.includes(record.id))

    setUtsRecords(filteredRecords)
    setSelectedUTSRecords([])
    setUtsHasChanges(true) // Değişiklik yapıldı
    showUTSMessage(`✅ ${selectedUTSRecords.length} kayıt grid'den kaldırıldı. "Kaydet" butonuna basın.`, 'success')
    playSuccessSound()
  }

  // UTS Grid'e Yeni Boş Satır Ekle
  const handleAddNewUTSRow = () => {
    const newRow = {
      id: `new-${Date.now()}`,
      seriNo: '',
      lot: '',
      uretimTarihi: '',
      uretimTarihiDisplay: '',
      miktar: '', // Boş başlasın, kullanıcı girecek (seri no girilirse otomatik 1 olur)
      isNew: true
    }
    setUtsRecords([...utsRecords, newRow])
    setUtsHasChanges(true) // Değişiklik yapıldı

    // Grid'i scroll et yeni satıra
    setTimeout(() => {
      if (utsGridRef.current) {
        utsGridRef.current.api.ensureIndexVisible(utsRecords.length, 'bottom')
      }
    }, 100)
  }

  // Tüm UTS Kayıtlarını Kaydet
  const handleSaveAllUTSRecords = async () => {
    try {
      // Grid'den tüm satırları al
      const allRows = []
      utsGridRef.current.api.forEachNode(node => allRows.push(node.data))

      // Boş satırları filtrele
      const validRows = allRows.filter(row => row.seriNo || row.lot)

      // Eğer grid boşsa ama originalRecords varsa, silme işlemi yapılacak
      if (validRows.length === 0 && originalUtsRecords.length === 0) {
        showUTSMessage('❌ Kaydedilecek satır yok!', 'error')
        playErrorSound()
        return
      }

      // Eğer sadece silme işlemi yapılacaksa (grid boş, orijinalde kayıt var)
      if (validRows.length === 0 && originalUtsRecords.length > 0) {
        if (!confirm(`Tüm kayıtlar silinecek (${originalUtsRecords.length} kayıt). Emin misiniz?`)) {
          return
        }
      }

      // Validasyonlar (sadece kayıt varsa)
      if (validRows.length > 0) {
        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i]
          const rowNum = i + 1

          // Seri No veya Lot No zorunlu
          if (!row.seriNo && !row.lot) {
            showUTSMessage(`❌ Satır ${rowNum}: Seri No veya Lot No girilmeli!`, 'error')
            playErrorSound()
            return
          }

          // Seri No varsa Lot No da zorunlu
          if (row.seriNo && !row.lot) {
            showUTSMessage(`❌ Satır ${rowNum}: Seri No girildiğinde Lot No da girilmelidir!`, 'error')
            playErrorSound()
            return
          }

          // Üretim Tarihi her zaman zorunlu
          if (!row.uretimTarihi && !row.uretimTarihiDisplay) {
            showUTSMessage(`❌ Satır ${rowNum}: Üretim Tarihi zorunludur!`, 'error')
            playErrorSound()
            return
          }

          // Tarih formatı kontrolü (YYMMDD veya YYYY-MM-DD)
          let uretimTarihiYYMMDD = row.uretimTarihi
          if (row.uretimTarihiDisplay && row.uretimTarihiDisplay.includes('-')) {
            // YYYY-MM-DD -> YYMMDD
            const [yyyy, mm, dd] = row.uretimTarihiDisplay.split('-')
            uretimTarihiYYMMDD = `${yyyy.substring(2, 4)}${mm}${dd}`
          }

          if (uretimTarihiYYMMDD.length !== 6) {
            showUTSMessage(`❌ Satır ${rowNum}: Üretim Tarihi geçersiz format!`, 'error')
            playErrorSound()
            return
          }

          // Miktar kontrolü
          if (!row.miktar || row.miktar <= 0) {
            showUTSMessage(`❌ Satır ${rowNum}: Miktar boş olamaz ve 0'dan büyük olmalı!`, 'error')
            playErrorSound()
            return
          }

          // Seri no varsa miktar 1 olmalı
          if (row.seriNo && row.miktar !== 1) {
            showUTSMessage(`❌ Satır ${rowNum}: Seri No girildiğinde miktar 1 olmalı!`, 'error')
            playErrorSound()
            return
          }
        }

        // Seri No teklik kontrolü
        const serialNumbers = validRows.filter(r => r.seriNo).map(r => r.seriNo.trim().toLowerCase())
        const serialCounts = {}
        serialNumbers.forEach(sn => {
          serialCounts[sn] = (serialCounts[sn] || 0) + 1
        })
        const duplicateSerials = Object.keys(serialCounts).filter(sn => serialCounts[sn] > 1)
        if (duplicateSerials.length > 0) {
          showUTSMessage(`❌ Aynı Seri No birden fazla satırda kullanılamaz: ${duplicateSerials.join(', ')}`, 'error')
          playErrorSound()
          return
        }

        // Lot No teklik kontrolü
        const lotNumbers = validRows.filter(r => r.lot).map(r => r.lot.trim().toLowerCase())
        const lotCounts = {}
        lotNumbers.forEach(lot => {
          lotCounts[lot] = (lotCounts[lot] || 0) + 1
        })
        const duplicateLots = Object.keys(lotCounts).filter(lot => lotCounts[lot] > 1)
        if (duplicateLots.length > 0) {
          showUTSMessage(`❌ Aynı Lot numarası birden fazla satırda kullanılamaz: ${duplicateLots.join(', ')}`, 'error')
          playErrorSound()
          return
        }

        // Toplam miktar kontrolü
        const totalMiktar = validRows.reduce((sum, row) => sum + (row.miktar || 0), 0)
        if (totalMiktar > selectedUTSItem.quantity) {
          showUTSMessage(`❌ Toplam miktar (${totalMiktar}) belge kalemindeki miktarı (${selectedUTSItem.quantity}) geçemez!`, 'error')
          playErrorSound()
          return
        }
      } // Validasyonlar sonu

      // Belge tarihini formatla
      let belgeTarihiFormatted
      if (document.documentDate) {
        const date = new Date(document.documentDate)
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

      // Bulk save API'yi çağır (toplu kaydet/güncelle/sil)
      const result = await apiService.saveUTSRecords({
        records: validRows,
        originalRecords: originalUtsRecords,
        documentId: document.id,
        itemId: selectedUTSItem.itemId,
        stokKodu: selectedUTSItem.stokKodu,
        belgeTip: selectedUTSItem.stharHtur,
        gckod: selectedUTSItem.stharGckod || '',
        belgeNo: document.documentNo,
        belgeTarihi: belgeTarihiFormatted,
        docType: document.docType,
        expectedQuantity: selectedUTSItem.quantity,
        barcode: selectedUTSItem.barcode || selectedUTSItem.stokKodu,
        cariKodu: document.customerCode    // Belgedeki CARI_KODU
        // kullanıcı artık context'ten alınıyor
      })

      if (result.success) {
        showUTSMessage(`✅ ${result.message}`, 'success')
        playSuccessSound()
        setUtsHasChanges(false) // Değişiklikler kaydedildi
      } else {
        showUTSMessage(`❌ ${result.message}`, 'error')
        playErrorSound()
        return
      }

      // Grid'i yenile
      const response = await apiService.getUTSBarcodeRecords(document.id, selectedUTSItem.itemId)
      if (response.success) {
        // Kayıtlara uretimTarihiDisplay ekle (YYMMDD -> YYYY-MM-DD)
        const enrichedRecords = (response.data || []).map(record => {
          let uretimTarihiDisplay = ''
          if (record.uretimTarihi && record.uretimTarihi.length === 6) {
            const yy = record.uretimTarihi.substring(0, 2)
            const mm = record.uretimTarihi.substring(2, 4)
            const dd = record.uretimTarihi.substring(4, 6)
            const yyyy = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`
            uretimTarihiDisplay = `${yyyy}-${mm}-${dd}`
          }
          return {
            ...record,
            uretimTarihiDisplay
          }
        })
        setUtsRecords(enrichedRecords)
        setOriginalUtsRecords(JSON.parse(JSON.stringify(enrichedRecords))) // Yeni orijinal
      }

      // Ana grid'i güncelle
      const docResponse = await apiService.getDocumentById(document.id)
      if (docResponse.success && docResponse.data) {
        setItems(docResponse.data.items || [])
        updateStats(docResponse.data.items || [])
      }

      // Başarılı kayıt sonrası modal'ı kapat (uyarı gösterme)
      setTimeout(() => {
        handleCloseUTSModal(true) // skipWarning = true
      }, 1000) // 1 saniye sonra kapat (başarı mesajını göster)

    } catch (error) {
      console.error('UTS toplu kayıt hatası:', error)
      showUTSMessage('❌ Kayıt sırasında hata oluştu', 'error')
      playErrorSound()
    }
  }


  // ITS Modal Aç
  const handleOpenITSModal = async (item) => {
    try {
      setSelectedItem(item)
      setShowITSModal(true)
      setItsLoading(true)

      // ITS kayıtlarını getir
      const response = await apiService.getITSBarcodeRecords(document.id, item.itemId)

      if (response.success) {
        setItsRecords(response.data || [])
      } else {
        console.error('ITS kayıtları yüklenemedi')
      }
    } catch (error) {
      console.error('ITS kayıtları yükleme hatası:', error)
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
      // MIAD'ı YYMMDD formatına çevir (yerel saat dilimine göre)
      let miadFormatted = ''
      if (record.miad) {
        const date = new Date(record.miad)
        if (!isNaN(date.getTime())) {
          const yy = String(date.getFullYear()).slice(-2)
          const mm = String(date.getMonth() + 1).padStart(2, '0')
          const dd = String(date.getDate()).padStart(2, '0')
          miadFormatted = `${yy}${mm}${dd}`
        }
      }

      // Format: 01 + ILC_GTIN + 21 + SERI_NO + 17 + MIAD + 10 + LOT
      const barcodeText = [
        '01',
        record.barkod || '',
        '21',
        record.seriNo || '',
        '17',
        miadFormatted,
        '10',
        record.lot || ''
      ]
      return barcodeText.join('')
    }).join('\n')
  }

  // Tüm Karekodları Kopyala
  const handleCopyAllBarcodes = () => {
    const text = generateITSBarcodeTexts()
    navigator.clipboard.writeText(text).then(() => {
      log('✅ Karekodlar kopyalandı!')
      playSuccessSound()
      alert('✅ Karekodlar panoya kopyalandı!')
    }).catch(err => {
      console.error('Kopyalama hatası:', err)
      playErrorSound()
      alert('❌ Kopyalama başarısız!')
    })
  }


  // ITS Kayıtlarını Sil
  const handleDeleteITSRecords = async () => {
    if (selectedRecords.length === 0) {
      alert('⚠️ Lütfen silinecek kayıtları seçin')
      return
    }

    // Seçili kayıtlarda koli barkodu var mı kontrol et
    const recordsWithCarrier = selectedRecords.filter(record => {
      const fullRecord = itsRecords.find(r => r.seriNo === record)
      return fullRecord && fullRecord.carrierLabel
    })

    // Koli barkodu varsa ve tüm kayıtlar seçili değilse uyar
    if (recordsWithCarrier.length > 0) {
      // Her bir koli barkodu için o koliden kaç kayıt olduğunu ve kaçının seçildiğini kontrol et
      const carrierLabels = new Set()
      recordsWithCarrier.forEach(record => {
        const fullRecord = itsRecords.find(r => r.seriNo === record)
        if (fullRecord && fullRecord.carrierLabel) {
          carrierLabels.add(fullRecord.carrierLabel)
        }
      })

      // Her koli için kontrol yap
      let hasPartialSelection = false
      for (const carrierLabel of carrierLabels) {
        const totalWithCarrier = itsRecords.filter(r => r.carrierLabel === carrierLabel).length
        const selectedWithCarrier = recordsWithCarrier.filter(record => {
          const fullRecord = itsRecords.find(r => r.seriNo === record)
          return fullRecord && fullRecord.carrierLabel === carrierLabel
        }).length

        if (selectedWithCarrier < totalWithCarrier) {
          hasPartialSelection = true
          break
        }
      }

      // Kullanıcıya uyarı göster
      let confirmMessage = hasPartialSelection
        ? `⚠️ UYARI: Seçili kayıtlardan bazıları koli ile okutulmuştur.\n\nBu satırları silerseniz koli bütünlüğü bozulacak ve aynı koli barkoduna sahip diğer kayıtların da koli bilgisi silinecektir.\n\n${selectedRecords.length} kayıt silinecek. Emin misiniz?`
        : `${selectedRecords.length} kayıt silinecek (koli bilgileri de silinecek). Emin misiniz?`

      if (!confirm(confirmMessage)) {
        return
      }
    } else {
      if (!confirm(`${selectedRecords.length} kayıt silinecek. Emin misiniz?`)) {
        return
      }
    }

    try {
      const result = await apiService.deleteITSBarcodeRecords(
        document.id,
        selectedItem.itemId,
        selectedRecords
      )

      if (result.success) {
        log('✅ ITS kayıtlar silindi:', result.deletedCount)
        // Kayıtları yeniden yükle
        const response = await apiService.getITSBarcodeRecords(document.id, selectedItem.itemId)
        if (response.success) {
          setItsRecords(response.data || [])
          setSelectedRecords([])
        }

        // Ana grid'i yenile
        const docResponse = await apiService.getDocumentById(document.id)
        if (docResponse.success && docResponse.data) {
          setItems(docResponse.data.items || [])
        }
      } else {
        alert('❌ Kayıtlar silinemedi: ' + result.message)
      }
    } catch (error) {
      console.error('ITS kayıt silme hatası:', error)
      alert('❌ Kayıtlar silinemedi')
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
    const kalan = quantity - okutulan

    // FAZLA OKUTULAN (Kalan < 0) → KIRMIZI
    if (kalan < 0) {
      return {
        backgroundColor: '#fee2e2',
        color: '#991b1b',
        fontWeight: 'bold'
      }
    }

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

  if (!document) {
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
    <div className="flex flex-col h-screen bg-dark-950">
      {/* Compact Header - Dark Theme */}
      <div className="bg-dark-900/80 backdrop-blur-sm border-b border-dark-700 relative z-50 overflow-visible">
        <div className="px-4 py-2">
          <div className="flex items-center gap-3">
            {/* Left - Back Button & Document Info */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/documents')}
                className="w-8 h-8 flex items-center justify-center rounded bg-dark-700 hover:bg-dark-600 transition-all border border-dark-600"
                title="Geri Dön"
              >
                <ArrowLeft className="w-5 h-5 text-slate-300" />
              </button>
              {(() => {
                const style = getDocTypeStyle(document.docType, document.tipi)
                return (
                  <div className={`px-2 h-9 flex flex-col justify-center rounded-lg border ${style.bg} ${style.border}`}>
                    <div className="flex items-center gap-1.5">
                      <p className={`text-[9px] font-medium leading-none ${style.text}`}>
                        {getDocumentTypeName(document.docType, document.tipi)}
                      </p>
                      <span className="text-slate-600 text-[9px]">•</span>
                      <p className="text-[9px] text-slate-400 leading-none">
                        {document.documentDate ? new Date(document.documentDate).toLocaleDateString('tr-TR') : '-'}
                      </p>
                    </div>
                    <h1 className={`text-xs font-bold leading-none ${style.title}`}>{document.documentNo}</h1>
                  </div>
                )
              })()}

              {/* Cari İsim - Tooltip ile detaylı bilgi */}
              <div className="bg-dark-800/80 px-2 h-9 w-72 flex items-center rounded-lg border border-dark-700 relative group cursor-help">
                <div className="flex items-start gap-1.5 w-full">
                  <User className="w-3 h-3 text-primary-400 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-slate-200 leading-tight line-clamp-2 flex-1">{document.customerName}</p>
                  <Info className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                </div>
                {/* Tooltip */}
                <div className="absolute left-0 top-full mt-1 hidden group-hover:block w-72 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl p-3" style={{ zIndex: 99999 }}>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      <span className="text-slate-400">Cari Kodu:</span>
                      <span className="text-slate-200 font-semibold">{document.customerCode}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-slate-400">Konum:</span>
                      <span className="text-slate-200 font-semibold">
                        {document.district ? `${document.district} / ${document.city}` : document.city || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-slate-400">GLN No:</span>
                      <span className="text-slate-200 font-semibold">{document.glnNo || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="text-slate-400">UTS No:</span>
                      <span className="text-slate-200 font-semibold">{document.utsNo || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="text-slate-400">Telefon:</span>
                      <span className="text-slate-200 font-semibold">{document.phone || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-slate-400">ePosta:</span>
                      <span className="text-slate-200 font-semibold">{document.eposta || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Center - Barcode Scanner (inline) */}
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
                    onClick={fetchDocument}
                    className="w-9 h-9 flex items-center justify-center rounded transition-all bg-dark-700 text-slate-200 hover:bg-dark-600 border border-dark-600"
                    title="Yenile"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowITSBildirimModal(true)}
                    disabled={(document?.itsCount || 0) === 0}
                    className={`w-9 h-9 flex items-center justify-center rounded transition-all border ${(document?.itsCount || 0) === 0
                      ? 'bg-dark-800 text-slate-600 border-dark-700 cursor-not-allowed opacity-50'
                      : document?.itsBildirim?.toString().trim().toUpperCase() === 'OK'
                        ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30'
                        : document?.itsBildirim?.toString().trim().toUpperCase() === 'NOK'
                          ? 'bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600/30'
                          : 'bg-dark-700 text-slate-200 border-dark-600 hover:bg-dark-600'
                      }`}
                    title={(document?.itsCount || 0) === 0 ? 'Bu belgede ITS ürünü yok' : `ITS Bildirim${document?.itsTarih ? `\n${new Date(document.itsTarih).toLocaleString('tr-TR')}` : ''}${document?.itsKullanici ? ` - ${document.itsKullanici}` : ''}`}
                  >
                    ITS
                  </button>
                  {/* PTS butonu sadece Satış Faturası için (Alış Faturası'nda gizli) */}
                  {document?.docType !== '2' && (
                    <button
                      type="button"
                      onClick={() => setShowPTSModal(true)}
                      disabled={(document?.itsCount || 0) === 0}
                      className={`w-9 h-9 flex items-center justify-center rounded transition-all border ${(document?.itsCount || 0) === 0
                        ? 'bg-dark-800 text-slate-600 border-dark-700 cursor-not-allowed opacity-50'
                        : document?.ptsId
                          ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30'
                          : 'bg-dark-700 text-slate-200 border-dark-600 hover:bg-dark-600'
                        }`}
                      title={(document?.itsCount || 0) === 0 ? 'Bu belgede ITS ürünü yok' : `PTS Gönderimi${document?.ptsId ? `\nID: ${document.ptsId}` : ''}${document?.ptsTarih ? `\n${new Date(document.ptsTarih).toLocaleString('tr-TR')}` : ''}${document?.ptsKullanici ? ` - ${document.ptsKullanici}` : ''}`}
                    >
                      PTS
                    </button>
                  )}
                  {/* UTS butonu sadece Satış Faturası için */}
                  {document?.docType === '1' && (
                    <button
                      type="button"
                      onClick={() => setShowUTSBildirimModal(true)}
                      disabled={(document?.utsCount || 0) === 0}
                      className={`w-9 h-9 flex items-center justify-center rounded transition-all border ${(document?.utsCount || 0) === 0
                        ? 'bg-dark-800 text-slate-600 border-dark-700 cursor-not-allowed opacity-50'
                        : document?.utsBildirim?.toString().trim().toUpperCase() === 'OK'
                          ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30'
                          : document?.utsBildirim?.toString().trim().toUpperCase() === 'NOK'
                            ? 'bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600/30'
                            : 'bg-dark-700 text-slate-200 border-dark-600 hover:bg-dark-600'
                        }`}
                      title={(document?.utsCount || 0) === 0 ? 'Bu belgede UTS ürünü yok' : `UTS Bildirim${document?.utsTarih ? `\n${new Date(document.utsTarih).toLocaleString('tr-TR')}` : ''}${document?.utsKullanici ? ` - ${document.utsKullanici}` : ''}`}
                    >
                      UTS
                    </button>
                  )}
                </>
              )}
            </form>


          </div>
        </div>
      </div>

      {/* AG Grid - Dark Theme */}
      <div className="flex-1 px-6 py-4 relative">
        {/* Stacked Messages Overlay - Bottom to Top */}
        {messages.length > 0 && (
          <div className="absolute inset-x-0 bottom-4 top-0 flex flex-col-reverse items-center justify-start gap-2 z-50 overflow-hidden px-4">
            {messages.slice(-8).map((msg, index) => (
              <div
                key={msg.id}
                className={`
                  flex items-center gap-3 px-6 py-3 rounded-xl shadow-2xl text-lg font-bold
                  transform transition-all duration-300 ease-out pointer-events-auto
                  ${msg.type === 'success' ? 'bg-emerald-600 text-white border-2 border-emerald-400' :
                    msg.type === 'error' ? 'bg-rose-600 text-white border-2 border-rose-400' :
                      msg.type === 'warning' ? 'bg-amber-600 text-white border-2 border-amber-400' :
                        'bg-primary-600 text-white border-2 border-primary-400'}
                `}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span>{msg.text}</span>
                <button
                  onClick={() => setMessages(prev => prev.filter(m => m.id !== msg.id))}
                  className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors"
                  title="Kapat"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="ag-theme-alpine h-full rounded-xl shadow-dark-lg overflow-hidden border border-dark-700">
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
            domLayout='normal'
            suppressPaginationPanel={true}
            getRowClass={(params) => {
              if (params.node.rowPinned === 'bottom') {
                return 'footer-row-no-hover'
              }
              // Kalan = 0 ise satırı yeşile boya
              const kalan = (params.data?.quantity || 0) - (params.data?.okutulan || 0)
              if (kalan === 0 && params.data?.quantity > 0) {
                return 'row-completed'
              }
              return ''
            }}
          />
        </div>
      </div>

      {/* UTS Kayıtları Modal - uses component */}
      <UTSModal
        isOpen={showUTSModal}
        onClose={handleCloseUTSModal}
        selectedItem={selectedUTSItem}
        document={document}
        records={utsRecords}
        setRecords={setUtsRecords}
        originalRecords={originalUtsRecords}
        setOriginalRecords={setOriginalUtsRecords}
        loading={utsLoading}
      />

      {/* ITS Karekod Modal - uses component */}
      <ITSModal
        isOpen={showITSModal}
        onClose={handleCloseITSModal}
        selectedItem={selectedItem}
        documentId={id}
        records={itsRecords}
        setRecords={setItsRecords}
        loading={itsLoading}
      />

      {/* PTS Modal */}
      <PTSModal
        isOpen={showPTSModal}
        onClose={() => setShowPTSModal(false)}
        document={document}
        playSuccessSound={playSuccessSound}
        playErrorSound={playErrorSound}
        onSuccess={fetchDocument}
        autoSend={completePhase === 'pts'}
        onComplete={handlePTSComplete}
      />

      {/* ITS Bildirim Modal */}
      <ITSBildirimModal
        isOpen={showITSBildirimModal}
        onClose={() => setShowITSBildirimModal(false)}
        document={document}
        docType={document?.docType}
        playSuccessSound={playSuccessSound}
        playErrorSound={playErrorSound}
        autoAction={completePhase === 'its' ? (document?.docType === '2' ? 'alis' : 'satis') : null}
        onComplete={handleITSBildirimComplete}
      />

      {/* UTS Bildirim Modal */}
      <UTSBildirimModal
        isOpen={showUTSBildirimModal}
        onClose={() => setShowUTSBildirimModal(false)}
        document={document}
        playSuccessSound={playSuccessSound}
        playErrorSound={playErrorSound}
        autoAction={completePhase === 'uts' ? 'verme' : null}
      />


      {/* UTS Kayıtları Modal - Okutulan sütununa tıklandığında açılır */}
      <UTSModal
        isOpen={showUTSModal}
        onClose={(skipWarning) => handleCloseUTSModal(skipWarning)}
        selectedItem={selectedItem}
        document={document}
        records={utsRecords}
        setRecords={setUtsRecords}
        originalRecords={originalUtsRecords}
        setOriginalRecords={setOriginalUtsRecords}
        loading={utsLoading}
        onRecordsChange={fetchDocument}
        playSuccessSound={playSuccessSound}
        playErrorSound={playErrorSound}
      />

      {/* Toplu ITS Okutma Modal */}
      <BulkScanModal
        isOpen={showBulkScanModal}
        onClose={() => setShowBulkScanModal(false)}
        documentId={document?.id}
        documentNo={document?.documentNo}
        docType={document?.docType}
        ftirsip={document?.docType}
        cariKodu={document?.customerCode}
        subeKodu={document?.subeKodu}
        items={items}
        onSuccess={fetchDocument}
        playSuccessSound={playSuccessSound}
        playErrorSound={playErrorSound}
      />

      {/* Belgeyi Tamamla Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCompleteModal(false)}>
          <div className="bg-dark-800 rounded-xl shadow-dark-xl border border-dark-700 w-[500px] max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-primary-600/30 to-cyan-600/30 border-b border-primary-500/30 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-100">Belgeyi Tamamla</h2>
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark-600 transition-colors text-slate-400 hover:text-slate-200"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* ITS Checkbox */}
              <div
                className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors ${(document?.itsCount || 0) > 0 ? 'bg-dark-900/50 border-dark-700 hover:bg-dark-800/70' : 'bg-dark-900/30 border-dark-800 opacity-50 cursor-not-allowed'}`}
                onClick={() => (document?.itsCount || 0) > 0 && setCompleteCheckboxes(prev => ({ ...prev, its: !prev.its }))}
              >
                <input
                  type="checkbox"
                  checked={completeCheckboxes.its}
                  onChange={(e) => setCompleteCheckboxes(prev => ({ ...prev, its: e.target.checked }))}
                  onClick={(e) => e.stopPropagation()}
                  disabled={(document?.itsCount || 0) === 0}
                  className="w-5 h-5 accent-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
                />
                <span className={`font-bold w-12 ${(document?.itsCount || 0) > 0 ? 'text-slate-200' : 'text-slate-500'}`}>ITS</span>
                <div className="flex items-center gap-2 flex-1">
                  {document?.itsBildirim?.toString().trim().toUpperCase() === 'OK' ? (
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                  ) : document?.itsBildirim?.toString().trim().toUpperCase() === 'NOK' ? (
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-red-500/20 border border-red-500/40">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-700/50 border border-slate-600">
                      <div className="w-3 h-3 rounded-full border-2 border-slate-500" />
                    </div>
                  )}
                  <span className="text-sm text-slate-400">
                    {(document?.itsCount || 0) === 0 ? 'Bu belgede ITS ürünü yok' : (
                      <>
                        {document?.itsTarih ? new Date(document.itsTarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        {document?.itsKullanici ? ` - ${document.itsKullanici}` : ''}
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* PTS Checkbox */}
              <div
                className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors ${(document?.itsCount || 0) > 0 ? 'bg-dark-900/50 border-dark-700 hover:bg-dark-800/70' : 'bg-dark-900/30 border-dark-800 opacity-50 cursor-not-allowed'}`}
                onClick={() => (document?.itsCount || 0) > 0 && setCompleteCheckboxes(prev => ({ ...prev, pts: !prev.pts }))}
              >
                <input
                  type="checkbox"
                  checked={completeCheckboxes.pts}
                  onChange={(e) => setCompleteCheckboxes(prev => ({ ...prev, pts: e.target.checked }))}
                  onClick={(e) => e.stopPropagation()}
                  disabled={(document?.itsCount || 0) === 0}
                  className="w-5 h-5 accent-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
                />
                <span className={`font-bold w-12 ${(document?.itsCount || 0) > 0 ? 'text-slate-200' : 'text-slate-500'}`}>PTS</span>
                <div className="flex items-center gap-2 flex-1">
                  {document?.ptsId ? (
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-700/50 border border-slate-600">
                      <div className="w-3 h-3 rounded-full border-2 border-slate-500" />
                    </div>
                  )}
                  <span className="text-sm text-slate-400">
                    {(document?.itsCount || 0) === 0 ? 'Bu belgede ITS ürünü yok' : (
                      <>
                        {document?.ptsId ? `ID: ${document.ptsId.substring(0, 20)}...` : '-'}
                        {document?.ptsTarih ? ` - ${new Date(document.ptsTarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                        {document?.ptsKullanici ? ` - ${document.ptsKullanici}` : ''}
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* UTS Checkbox */}
              <div
                className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors ${(document?.utsCount || 0) > 0 ? 'bg-dark-900/50 border-dark-700 hover:bg-dark-800/70' : 'bg-dark-900/30 border-dark-800 opacity-50 cursor-not-allowed'}`}
                onClick={() => (document?.utsCount || 0) > 0 && setCompleteCheckboxes(prev => ({ ...prev, uts: !prev.uts }))}
              >
                <input
                  type="checkbox"
                  checked={completeCheckboxes.uts}
                  onChange={(e) => setCompleteCheckboxes(prev => ({ ...prev, uts: e.target.checked }))}
                  onClick={(e) => e.stopPropagation()}
                  disabled={(document?.utsCount || 0) === 0}
                  className="w-5 h-5 accent-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
                />
                <span className={`font-bold w-12 ${(document?.utsCount || 0) > 0 ? 'text-slate-200' : 'text-slate-500'}`}>UTS</span>
                <div className="flex items-center gap-2 flex-1">
                  {document?.utsBildirim?.toString().trim().toUpperCase() === 'OK' ? (
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                  ) : document?.utsBildirim?.toString().trim().toUpperCase() === 'NOK' ? (
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-red-500/20 border border-red-500/40">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-700/50 border border-slate-600">
                      <div className="w-3 h-3 rounded-full border-2 border-slate-500" />
                    </div>
                  )}
                  <span className="text-sm text-slate-400">
                    {(document?.utsCount || 0) === 0 ? 'Bu belgede UTS ürünü yok' : (
                      <>
                        {document?.utsTarih ? new Date(document.utsTarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        {document?.utsKullanici ? ` - ${document.utsKullanici}` : ''}
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* DGR Checkbox */}
              <div
                className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors ${(document?.dgrCount || 0) > 0 ? 'bg-dark-900/50 border-dark-700 hover:bg-dark-800/70' : 'bg-dark-900/30 border-dark-800 opacity-50 cursor-not-allowed'}`}
                onClick={() => (document?.dgrCount || 0) > 0 && setCompleteCheckboxes(prev => ({ ...prev, dgr: !prev.dgr }))}
              >
                <input
                  type="checkbox"
                  checked={completeCheckboxes.dgr}
                  onChange={(e) => setCompleteCheckboxes(prev => ({ ...prev, dgr: e.target.checked }))}
                  onClick={(e) => e.stopPropagation()}
                  disabled={(document?.dgrCount || 0) === 0}
                  className="w-5 h-5 accent-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
                />
                <span className={`font-bold w-12 ${(document?.dgrCount || 0) > 0 ? 'text-slate-200' : 'text-slate-500'}`}>DGR</span>
                <div className="flex items-center gap-2 flex-1">
                  {document?.fastDurum?.toString().trim().toUpperCase() === 'OK' ? (
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                  ) : document?.fastDurum?.toString().trim().toUpperCase() === 'NOK' ? (
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-red-500/20 border border-red-500/40">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-700/50 border border-slate-600">
                      <div className="w-3 h-3 rounded-full border-2 border-slate-500" />
                    </div>
                  )}
                  <span className="text-sm text-slate-400">
                    {(document?.dgrCount || 0) === 0 ? 'Bu belgede DGR ürünü yok' : (
                      <>
                        {document?.fastTarih ? new Date(document.fastTarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        {document?.fastKullanici ? ` - ${document.fastKullanici}` : ''}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-dark-700 flex justify-end gap-3">
              <button
                onClick={() => setShowCompleteModal(false)}
                disabled={completeProcessing}
                className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-dark-700 text-slate-300 hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                İptal
              </button>
              <button
                onClick={handleCompleteDocument}
                disabled={completeProcessing || (!completeCheckboxes.its && !completeCheckboxes.pts && !completeCheckboxes.uts && !completeCheckboxes.dgr)}
                className="px-6 py-2 text-sm font-bold rounded-lg transition-all bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {completeProcessing ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    İşleniyor...
                  </>
                ) : (
                  'BELGEYİ TAMAMLA'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default DocumentDetailPage













