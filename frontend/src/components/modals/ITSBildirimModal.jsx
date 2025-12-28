import { useState, useEffect, useMemo, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
    XCircle, FileText, User, Hash, Package,
    Send, AlertTriangle, CheckCircle, Search, X, Loader2, ChevronDown
} from 'lucide-react'
import apiService from '../../services/apiService'

/**
 * ITS Bildirim Modal Componenti
 * Belgedeki tüm ITS kayıtlarını gösterir ve bildirim işlemleri yapar
 */
const ITSBildirimModal = ({
    isOpen,
    onClose,
    document,
    docType,
    playSuccessSound,
    playErrorSound
}) => {
    const gridRef = useRef(null)
    const [loading, setLoading] = useState(false)
    const [records, setRecords] = useState([])
    const [selectedRows, setSelectedRows] = useState([])
    const [message, setMessage] = useState(null)
    const [actionLoading, setActionLoading] = useState(false)
    const [selectedDurumlar, setSelectedDurumlar] = useState([])
    const [durumDropdownOpen, setDurumDropdownOpen] = useState(false)

    // Belge tipi kontrolü - Satış Faturası mı?
    const isSatisFaturasi = document?.docType === '1' && String(document?.tipi || '').toLowerCase().includes('sat')

    // Modal açıldığında kayıtları getir
    useEffect(() => {
        if (isOpen && document?.id) {
            fetchRecords()
            setSelectedDurumlar([])
        }
    }, [isOpen, document?.id])

    // Dışarı tıklayınca dropdown'ı kapat
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.durum-dropdown')) {
                setDurumDropdownOpen(false)
            }
        }
        window.document.addEventListener('click', handleClickOutside)
        return () => window.document.removeEventListener('click', handleClickOutside)
    }, [])

    // Kayıtları getir
    const fetchRecords = async () => {
        setLoading(true)
        setMessage(null)
        try {
            const response = await apiService.getAllITSRecordsForDocument(document.id, document.customerCode)
            if (response.success) {
                // Grid için sıra numarası ekle
                const enrichedRecords = (response.data || []).map((r, index) => ({
                    ...r,
                    siraNo: index + 1,
                    id: r.recNo || `${r.seriNo}-${index}`
                }))
                setRecords(enrichedRecords)
            } else {
                setMessage({ type: 'error', text: response.message || 'Kayıtlar alınamadı' })
            }
        } catch (error) {
            console.error('ITS kayıtları getirme hatası:', error)
            setMessage({ type: 'error', text: 'Kayıtlar yüklenirken hata oluştu' })
        } finally {
            setLoading(false)
        }
    }

    // Benzersiz bildirim durumları listesi
    const uniqueDurumlar = useMemo(() => {
        const durumMap = new Map()
        records.forEach(r => {
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
    }, [records])

    // Filtrelenmiş kayıtlar
    const filteredRecords = useMemo(() => {
        if (selectedDurumlar.length === 0) return records
        return records.filter(r => {
            const key = r.bildirim ?? 'null'
            return selectedDurumlar.includes(key)
        })
    }, [records, selectedDurumlar])

    // Durum seçimi toggle
    const toggleDurum = (durumKey) => {
        setSelectedDurumlar(prev =>
            prev.includes(durumKey)
                ? prev.filter(d => d !== durumKey)
                : [...prev, durumKey]
        )
    }

    // Tümünü seç/kaldır
    const toggleAllDurumlar = () => {
        if (selectedDurumlar.length === uniqueDurumlar.length) {
            setSelectedDurumlar([])
        } else {
            setSelectedDurumlar(uniqueDurumlar.map(d => d.bildirim ?? 'null'))
        }
    }

    // Grid Column Definitions
    const columnDefs = useMemo(() => [
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
            headerName: 'Stok Adı',
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
                if (!params.value) return '-'
                try {
                    const date = new Date(params.value)
                    if (isNaN(date.getTime())) return params.value
                    return date.toLocaleDateString('tr-TR')
                } catch {
                    return params.value
                }
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
            minWidth: 300,
            cellClass: 'text-left',
            cellRenderer: (params) => {
                const bildirimKodu = params.value
                // Backend'den join ile gelen mesajı kullan
                const mesaj = params.data?.bildirimMesaji || bildirimKodu || '-'

                // Bildirim koduna göre renklendirme
                // 1 = Başarılı, diğerleri hata
                const isSuccess = bildirimKodu == 1 || String(mesaj).toLowerCase().includes('başarı')
                const colorClass = isSuccess ? 'text-emerald-400' : bildirimKodu ? 'text-rose-400' : 'text-slate-400'

                return (
                    <span className={`font-semibold text-xs ${colorClass}`} title={`Kod: ${bildirimKodu || '-'}`}>
                        {mesaj}
                    </span>
                )
            }
        }
    ], [])

    // Default Column Definitions
    const defaultColDef = useMemo(() => ({
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
    }), [])

    // Bildirim işlemi yap
    const handleAction = async (actionType) => {
        const actionNames = {
            'satis': 'Satış Bildirimi',
            'satis-iptal': 'Satış İptal Bildirimi',
            'alis': 'Alış Bildirimi',
            'iade-alis': 'İade Alış Bildirimi',
            'dogrulama': 'Doğrulama',
            'sorgula': 'Sorgula',
            'basarisiz-sorgula': 'Başarısız Ürün Sorgulama'
        }

        if (!confirm(`${actionNames[actionType]} işlemi yapılacak. Devam etmek istiyor musunuz?`)) {
            return
        }

        setActionLoading(true)
        setMessage(null)

        try {
            // Ayarları al
            const settingsResponse = await apiService.getSettings()
            const settings = settingsResponse.success ? settingsResponse.data : null

            // Ürün listesini hazırla
            const products = records.map(r => ({
                recNo: r.recNo,
                gtin: r.gtin,
                seriNo: r.seriNo,
                miad: r.miad,
                lotNo: r.lotNo
            }))

            // Belge bilgilerini hazırla (ITS durumunu güncellemek için)
            const belgeInfo = {
                subeKodu: document?.subeKodu,
                fatirsNo: document?.documentNo,
                ftirsip: document?.docType || docType,
                cariKodu: document?.customerCode,
                kullanici: localStorage.getItem('username') || 'SYSTEM'
            }

            let result

            switch (actionType) {
                case 'satis':
                    // GLN kontrolü
                    const glnNo = document?.glnNo
                    if (!glnNo) {
                        setMessage({ type: 'error', text: 'Alıcı GLN numarası tanımlı değil!' })
                        playErrorSound?.()
                        return
                    }
                    result = await apiService.itsSatisBildirimi(document.id, glnNo, products, settings, belgeInfo)
                    break

                case 'satis-iptal':
                    const glnNoIptal = document?.glnNo
                    if (!glnNoIptal) {
                        setMessage({ type: 'error', text: 'Alıcı GLN numarası tanımlı değil!' })
                        playErrorSound?.()
                        return
                    }
                    result = await apiService.itsSatisIptalBildirimi(document.id, glnNoIptal, products, settings, belgeInfo)
                    break

                case 'alis':
                    // Alış bildirimi (Mal Alım) - GLN gerekmez, sadece productList gönderilir
                    result = await apiService.itsAlisBildirimi(document.id, products, settings, belgeInfo)
                    break

                case 'iade-alis':
                    // İade Alış bildirimi (Mal İade) - Karşı taraf GLN kontrolü
                    const karsiGlnNo = document?.glnNo
                    if (!karsiGlnNo) {
                        setMessage({ type: 'error', text: 'Karşı taraf GLN numarası tanımlı değil!' })
                        playErrorSound?.()
                        return
                    }
                    result = await apiService.itsIadeAlisBildirimi(document.id, karsiGlnNo, products, settings, belgeInfo)
                    break

                case 'dogrulama':
                    result = await apiService.itsDogrulama(document.id, products, settings)
                    // Doğrulama sonuçlarını grid'de göster (DB'ye yazma)
                    if (result.success && result.data?.length > 0) {
                        // Mesaj kodlarını tekilleştir ve getir
                        const mesajKodlariResponse = await apiService.getMesajKodlari()
                        const mesajMap = {}
                        if (mesajKodlariResponse.success) {
                            mesajKodlariResponse.data.forEach(m => {
                                mesajMap[m.id] = m.mesaj
                            })
                        }

                        // Grid kayıtlarını güncelle
                        const updatedRecords = records.map(r => {
                            const sonuc = result.data.find(s => s.seriNo === r.seriNo)
                            if (sonuc) {
                                return {
                                    ...r,
                                    bildirim: sonuc.durum,
                                    bildirimMesaji: mesajMap[sonuc.durum] || `Kod: ${sonuc.durum}`
                                }
                            }
                            return r
                        })
                        setRecords(updatedRecords)
                        setMessage({ type: 'success', text: result.message })
                        playSuccessSound?.()
                        return
                    }
                    break

                case 'sorgula':
                    result = await apiService.itsSorgula(document.id, products, settings)
                    // Sorgulama sonuçlarını grid'de göster (DB'ye yazma)
                    if (result.success && result.data?.length > 0) {
                        // Grid kayıtlarını güncelle
                        const updatedRecords = records.map(r => {
                            const sonuc = result.data.find(s => s.seriNo === r.seriNo)
                            if (sonuc) {
                                return {
                                    ...r,
                                    bildirim: sonuc.durum,
                                    bildirimMesaji: sonuc.durumMesaji || `Kod: ${sonuc.durum}`,
                                    gln1: sonuc.gln1,
                                    gln2: sonuc.gln2,
                                    gln1Adi: sonuc.gln1Adi,  // Kaynak GLN adı (BİZİM veya Cari İsim)
                                    gln2Adi: sonuc.gln2Adi   // Hedef GLN adı (BİZİM veya Cari İsim)
                                }
                            }
                            return r
                        })
                        setRecords(updatedRecords)
                        setMessage({ type: 'success', text: result.message })
                        playSuccessSound?.()
                        return
                    }
                    break

                case 'basarisiz-sorgula':
                    result = await apiService.itsBasarisizSorgula(document.id, products, settings)
                    // Başarısız sorgulama sonuçlarını grid'de göster (DB'ye yazma)
                    if (result.success && result.data?.length > 0) {
                        // Mesaj kodlarını tekilleştir ve getir
                        const mesajKodlariResponse = await apiService.getMesajKodlari()
                        const mesajMap = {}
                        if (mesajKodlariResponse.success) {
                            mesajKodlariResponse.data.forEach(m => {
                                mesajMap[m.id] = m.mesaj
                            })
                        }

                        // Grid kayıtlarını güncelle
                        const updatedRecords = records.map(r => {
                            const sonuc = result.data.find(s => s.seriNo === r.seriNo)
                            if (sonuc) {
                                return {
                                    ...r,
                                    bildirim: sonuc.durum,
                                    bildirimMesaji: mesajMap[sonuc.durum] || sonuc.hataMesaji || `Kod: ${sonuc.durum}`
                                }
                            }
                            return r
                        })
                        setRecords(updatedRecords)
                        setMessage({ type: 'success', text: result.message })
                        playSuccessSound?.()
                        return
                    }
                    break

                default:
                    result = { success: false, message: 'Bilinmeyen işlem tipi' }
            }

            if (result.success) {
                setMessage({ type: 'success', text: result.message })
                playSuccessSound?.()
                // Kayıtları yenile
                await fetchRecords()
            } else {
                setMessage({ type: 'error', text: result.message })
                playErrorSound?.()
            }

        } catch (error) {
            console.error(`${actionType} hatası:`, error)
            setMessage({ type: 'error', text: error.message || 'İşlem başarısız' })
            playErrorSound?.()
        } finally {
            setActionLoading(false)
        }
    }

    // Modal kapatma
    const handleClose = () => {
        setRecords([])
        setSelectedRows([])
        setMessage(null)
        setSelectedDurumlar([])
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center" style={{ zIndex: 9999 }}>
            {/* Loading Overlay */}
            {actionLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-dark-800 rounded-xl p-6 border border-dark-600 flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                        <p className="text-slate-200 font-medium">İşlem yapılıyor...</p>
                        <p className="text-slate-400 text-sm">Lütfen bekleyin</p>
                    </div>
                </div>
            )}

            <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-7xl mx-4 shadow-2xl max-h-[95vh] flex flex-col">
                {/* Header - Kompakt */}
                <div className="flex items-center justify-between p-3 border-b border-dark-700 shrink-0 bg-dark-800/50">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-indigo-400" />
                            <h2 className="text-lg font-bold text-slate-100">ITS Bildirim</h2>
                            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs font-semibold rounded">
                                {filteredRecords.length}/{records.length}
                            </span>
                        </div>
                        <div className="h-5 w-px bg-dark-600" />
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-400">
                                <FileText className="w-3.5 h-3.5 inline mr-1" />
                                <span className="font-bold text-slate-100">{document?.documentNo}</span>
                            </span>
                            <span className="text-slate-400" title={document?.customerName}>
                                <User className="w-3.5 h-3.5 inline mr-1" />
                                <span className="font-bold text-slate-100 max-w-[180px] truncate inline-block align-bottom">{document?.customerName}</span>
                            </span>
                            <span className="text-slate-400">
                                <Hash className="w-3.5 h-3.5 inline mr-1" />
                                <span className={`font-bold ${(document?.glnNo || document?.email) ? 'text-indigo-400' : 'text-rose-400'}`}>
                                    {document?.glnNo || document?.email || 'GLN Yok'}
                                </span>
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-dark-700 text-slate-300 hover:bg-rose-600 hover:text-white transition-all"
                    >
                        <XCircle className="w-4 h-4" />
                    </button>
                </div>

                {/* Mesaj */}
                {message && (
                    <div className={`mx-3 mt-2 px-3 py-1.5 rounded-lg border text-sm ${message.type === 'error'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        : message.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}>
                        <p className="font-medium">{message.text}</p>
                    </div>
                )}

                {/* Grid */}
                <div className="flex-1 p-3 overflow-hidden">
                    <div className="ag-theme-alpine-dark h-full" style={{ height: 'calc(95vh - 160px)', minHeight: '400px' }}>
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <div className="animate-spin w-8 h-8 border-3 border-dark-600 border-t-indigo-500 rounded-full mx-auto mb-2" />
                                    <p className="text-slate-400 text-sm">Kayıtlar yükleniyor...</p>
                                </div>
                            </div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                                    <p className="text-slate-400">
                                        {selectedDurumlar.length > 0 ? 'Seçilen durumda kayıt bulunamadı' : 'Bu belgede ITS kaydı bulunamadı'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <AgGridReact
                                ref={gridRef}
                                rowData={filteredRecords}
                                columnDefs={columnDefs}
                                defaultColDef={defaultColDef}
                                getRowId={(params) => params.data.id}
                                rowSelection="multiple"
                                suppressRowClickSelection={true}
                                onSelectionChanged={(event) => {
                                    setSelectedRows(event.api.getSelectedRows())
                                }}
                                animateRows={true}
                                enableCellTextSelection={true}
                                suppressCellFocus={true}
                            />
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 px-3 py-2 border-t border-dark-700 shrink-0 bg-dark-800/50 flex-wrap">
                    {/* Satış Faturasurı için Satış Butonları */}
                    {docType !== '2' && (
                        <>
                            <button
                                onClick={() => handleAction('satis')}
                                disabled={actionLoading || records.length === 0}
                                className="px-3 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 transition-all font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                <Send className="w-4 h-4" />
                                Satış Bildirimi
                            </button>
                            <button
                                onClick={() => handleAction('satis-iptal')}
                                disabled={actionLoading || records.length === 0}
                                className="px-3 py-1.5 rounded-lg text-white bg-rose-600 hover:bg-rose-500 transition-all font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                <X className="w-4 h-4" />
                                Satış İptal
                            </button>
                        </>
                    )}
                    {/* Alış Faturası için Alış Butonları */}
                    {docType === '2' && (
                        <>
                            <button
                                onClick={() => handleAction('alis')}
                                disabled={actionLoading || records.length === 0}
                                className="px-3 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 transition-all font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                <Send className="w-4 h-4" />
                                Alım Bildirimi
                            </button>
                            <button
                                onClick={() => handleAction('iade-alis')}
                                disabled={actionLoading || records.length === 0}
                                className="px-3 py-1.5 rounded-lg text-white bg-orange-600 hover:bg-orange-500 transition-all font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                <X className="w-4 h-4" />
                                İade Alım Bildirimi
                            </button>
                        </>
                    )}
                    {/* Ortak Butonlar */}
                    <button
                        onClick={() => handleAction('dogrulama')}
                        disabled={actionLoading || records.length === 0}
                        className="px-3 py-1.5 rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-all font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        <CheckCircle className="w-4 h-4" />
                        Doğrulama
                    </button>
                    <button
                        onClick={() => handleAction('sorgula')}
                        disabled={actionLoading || records.length === 0}
                        className="px-3 py-1.5 rounded-lg text-white bg-sky-600 hover:bg-sky-500 transition-all font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        <Search className="w-4 h-4" />
                        Sorgula
                    </button>

                    {/* Durum Filtresi - Multi Select Dropdown */}
                    <div className="relative durum-dropdown ml-auto">
                        <button
                            onClick={() => setDurumDropdownOpen(!durumDropdownOpen)}
                            disabled={uniqueDurumlar.length === 0}
                            className="px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 transition-all text-sm flex items-center gap-2 border border-dark-600 min-w-[180px] disabled:opacity-50"
                        >
                            <span className="text-slate-300 truncate flex-1 text-left">
                                {selectedDurumlar.length === 0
                                    ? 'Tüm Durumlar'
                                    : `${selectedDurumlar.length} durum seçili`}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${durumDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {durumDropdownOpen && uniqueDurumlar.length > 0 && (
                            <div className="absolute bottom-full mb-1 right-0 w-72 bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-50 max-h-64 overflow-auto">
                                {/* Tümünü Seç */}
                                <div
                                    className="px-3 py-2 border-b border-dark-600 hover:bg-dark-700 cursor-pointer flex items-center gap-2"
                                    onClick={toggleAllDurumlar}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedDurumlar.length === uniqueDurumlar.length && uniqueDurumlar.length > 0}
                                        onChange={() => { }}
                                        className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-slate-200">Tümünü Seç/Kaldır</span>
                                </div>

                                {/* Bildirim durum listesi */}
                                {uniqueDurumlar.map((d) => {
                                    const key = d.bildirim ?? 'null'
                                    const isSelected = selectedDurumlar.includes(key)
                                    const isSuccess = d.bildirim == 1 || String(d.mesaj).toLowerCase().includes('başarı')
                                    const isPending = !d.bildirim || d.bildirim === 0 || d.bildirim === '0'

                                    return (
                                        <div
                                            key={key}
                                            className="px-3 py-2 hover:bg-dark-700 cursor-pointer flex items-center gap-2"
                                            onClick={() => toggleDurum(key)}
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
                </div>
            </div>
        </div>
    )
}

export default ITSBildirimModal

