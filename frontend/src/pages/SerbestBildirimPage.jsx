import { useState, useRef, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { FileText, Home, QrCode, RefreshCw, User, X, Search, Hash, MapPin, Info } from 'lucide-react'
import usePageTitle from '../hooks/usePageTitle'
import apiService from '../services/apiService'

const SerbestBildirimPage = () => {
    usePageTitle('Serbest Bildirim')
    const navigate = useNavigate()
    const barcodeInputRef = useRef(null)

    // State'ler
    const [barcodeInput, setBarcodeInput] = useState('')
    const [deleteMode, setDeleteMode] = useState(false)
    const [showBulkScanModal, setShowBulkScanModal] = useState(false)
    const [items, setItems] = useState([]) // Boş grid verisi

    // Cari Seçimi State'leri
    const [selectedCari, setSelectedCari] = useState(null)
    const [showCariModal, setShowCariModal] = useState(false)
    const [cariSearchText, setCariSearchText] = useState('')
    const [cariler, setCariler] = useState([])
    const [cariLoading, setCariLoading] = useState(false)

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

    // Barkod okutma işlemi (placeholder)
    const handleBarcodeScan = (e) => {
        e.preventDefault()
        if (!barcodeInput.trim()) return
        // TODO: Barkod işleme mantığı
        console.log('Karekod okutuldu:', barcodeInput)
        setBarcodeInput('')
    }

    // Yenile işlemi (placeholder)
    const handleRefresh = () => {
        // TODO: Veri yenileme
        console.log('Yenileme')
    }

    // AG Grid Column Definitions
    const columnDefs = useMemo(() => [
        {
            headerName: '#',
            valueGetter: 'node.rowIndex + 1',
            width: 60,
            cellClass: 'text-center font-semibold text-gray-600',
            pinned: 'left'
        },
        {
            headerName: 'Türü',
            field: 'turu',
            width: 90,
            cellClass: 'text-center',
            cellRenderer: (params) => {
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
            headerName: 'Karekod / Barkod',
            field: 'barcode',
            flex: 1,
            minWidth: 300,
            cellClass: 'font-mono font-bold'
        },
        {
            headerName: 'GTIN',
            field: 'gtin',
            width: 180,
            cellClass: 'font-mono'
        },
        {
            headerName: 'Parti No',
            field: 'lot',
            width: 120,
            cellClass: 'font-mono'
        },
        {
            headerName: 'Seri No',
            field: 'seriNo',
            width: 120,
            cellClass: 'font-mono'
        },
        {
            headerName: 'S.K.T',
            field: 'skt',
            width: 100,
            cellClass: 'text-center'
        },
        {
            headerName: 'Adet',
            field: 'miktar',
            width: 90,
            cellClass: 'text-center',
            cellRenderer: (params) => (
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-base font-bold bg-primary-500/20 text-primary-400 border border-primary-500/30">
                    {params.value || 1}
                </span>
            )
        }
    ], [])

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
                                        onClick={() => console.log('ITS Bildirim')}
                                        className="w-9 h-9 flex items-center justify-center rounded transition-all bg-dark-700 text-slate-200 border border-dark-600 hover:bg-dark-600"
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
                <div className="ag-theme-alpine rounded-xl overflow-hidden border border-dark-700 h-full">
                    <AgGridReact
                        rowData={items}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        enableCellTextSelection={true}
                        ensureDomOrder={true}
                        rowClass="cursor-pointer hover:bg-dark-700/50"
                        animateRows={true}
                        rowHeight={50}
                        headerHeight={48}
                        localeText={{
                            noRowsToShow: 'Henüz karekod okutulmadı'
                        }}
                    />
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
        </div>
    )
}

export default SerbestBildirimPage
