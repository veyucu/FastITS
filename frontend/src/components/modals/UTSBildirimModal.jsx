import { useState, useEffect, useMemo, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
    XCircle, FileText, User, Hash, Package,
    Send, AlertTriangle, CheckCircle, X, Loader2
} from 'lucide-react'
import apiService from '../../services/apiService'

/**
 * UTS Bildirim Modal Componenti
 * Belgedeki tüm UTS kayıtlarını gösterir ve bildirim işlemleri yapar
 */
const UTSBildirimModal = ({
    isOpen,
    onClose,
    document,
    playSuccessSound,
    playErrorSound
}) => {
    const gridRef = useRef(null)
    const [loading, setLoading] = useState(false)
    const [records, setRecords] = useState([])
    const [selectedRows, setSelectedRows] = useState([])
    const [message, setMessage] = useState(null)
    const [actionLoading, setActionLoading] = useState(false)

    // Modal açıldığında kayıtları getir
    useEffect(() => {
        if (isOpen && document?.id) {
            fetchRecords()
        }
    }, [isOpen, document?.id])

    // Kayıtları getir
    const fetchRecords = async () => {
        setLoading(true)
        setMessage(null)
        try {
            const response = await apiService.getAllUTSRecordsForDocument(document.id, document.customerCode)
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
            console.error('UTS kayıtları getirme hatası:', error)
            setMessage({ type: 'error', text: 'Kayıtlar yüklenirken hata oluştu' })
        } finally {
            setLoading(false)
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
            headerName: 'Stok Kodu',
            field: 'stokKodu',
            width: 140,
            cellClass: 'font-mono text-sm text-rose-400'
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
            headerName: 'Lot No',
            field: 'lotNo',
            width: 110,
            cellClass: 'font-mono text-sm'
        },
        {
            headerName: 'Miktar',
            field: 'miktar',
            width: 100,
            cellClass: 'text-center font-bold'
        },
        {
            headerName: 'Durum',
            field: 'durum',
            width: 150,
            cellClass: 'text-center',
            cellRenderer: (params) => {
                const durum = params.value
                const isSuccess = durum == 1 || String(durum).toLowerCase().includes('başarı')
                const colorClass = isSuccess ? 'text-emerald-400' : durum ? 'text-rose-400' : 'text-slate-400'

                return (
                    <span className={`font-semibold text-xs ${colorClass}`}>
                        {durum || 'Beklemede'}
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
            'verme': 'UTS Verme Bildirimi',
            'verme-iptal': 'UTS Verme İptal Bildirimi'
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
                stokKodu: r.stokKodu,
                seriNo: r.seriNo,
                lotNo: r.lotNo,
                miktar: r.miktar
            }))

            let result

            switch (actionType) {
                case 'verme':
                    // UTS Verme bildirimi - TODO: Backend API'si eklenince güncellenecek
                    result = await apiService.utsVermeBildirimi(document.id, products, settings)
                    break

                case 'verme-iptal':
                    // UTS Verme iptal bildirimi - TODO: Backend API'si eklenince güncellenecek
                    result = await apiService.utsVermeIptalBildirimi(document.id, products, settings)
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
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center" style={{ zIndex: 9999 }}>
            {/* Loading Overlay */}
            {actionLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-dark-800 rounded-xl p-6 border border-dark-600 flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-rose-400 animate-spin" />
                        <p className="text-slate-200 font-medium">İşlem yapılıyor...</p>
                        <p className="text-slate-400 text-sm">Lütfen bekleyin</p>
                    </div>
                </div>
            )}

            <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-6xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
                {/* Header - Kompakt */}
                <div className="flex items-center justify-between p-3 border-b border-dark-700 shrink-0 bg-dark-800/50">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-rose-400" />
                            <h2 className="text-lg font-bold text-slate-100">UTS Bildirim</h2>
                            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 text-xs font-semibold rounded">
                                {records.length}
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
                    <div className="ag-theme-alpine-dark h-full" style={{ height: 'calc(90vh - 160px)', minHeight: '400px' }}>
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <div className="animate-spin w-8 h-8 border-3 border-dark-600 border-t-rose-500 rounded-full mx-auto mb-2" />
                                    <p className="text-slate-400 text-sm">Kayıtlar yükleniyor...</p>
                                </div>
                            </div>
                        ) : records.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                                    <p className="text-slate-400">Bu belgede UTS kaydı bulunamadı</p>
                                </div>
                            </div>
                        ) : (
                            <AgGridReact
                                ref={gridRef}
                                rowData={records}
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
                    {/* UTS Bildirim Butonları */}
                    <button
                        onClick={() => handleAction('verme')}
                        disabled={actionLoading || records.length === 0}
                        className="px-3 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 transition-all font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        <Send className="w-4 h-4" />
                        UTS Verme Bildirimi
                    </button>
                    <button
                        onClick={() => handleAction('verme-iptal')}
                        disabled={actionLoading || records.length === 0}
                        className="px-3 py-1.5 rounded-lg text-white bg-rose-600 hover:bg-rose-500 transition-all font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        <X className="w-4 h-4" />
                        UTS Verme İptal
                    </button>
                </div>
            </div>
        </div>
    )
}

export default UTSBildirimModal

