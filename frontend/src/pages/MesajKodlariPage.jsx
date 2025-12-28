import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import {
    ArrowLeft, RefreshCw, Download, MessageSquare, AlertTriangle
} from 'lucide-react'
import apiService from '../services/apiService'
import usePageTitle from '../hooks/usePageTitle'

/**
 * Mesaj Kodları Sayfası
 * ITS cevap kodlarını listeler ve günceller
 */
const MesajKodlariPage = () => {
    usePageTitle('Mesaj Kodları')
    const navigate = useNavigate()
    const gridRef = useRef(null)
    const [loading, setLoading] = useState(false)
    const [updateLoading, setUpdateLoading] = useState(false)
    const [records, setRecords] = useState([])
    const [message, setMessage] = useState(null)

    // Sayfa yüklendiğinde verileri getir
    useEffect(() => {
        fetchRecords()
    }, [])

    // Verileri getir
    const fetchRecords = async () => {
        setLoading(true)
        setMessage(null)
        try {
            const response = await apiService.getMesajKodlari()
            if (response.success) {
                setRecords(response.data || [])
            } else {
                setMessage({ type: 'error', text: response.message || 'Veriler alınamadı' })
            }
        } catch (error) {
            console.error('Mesaj kodları getirme hatası:', error)
            setMessage({ type: 'error', text: 'Veriler yüklenirken hata oluştu' })
        } finally {
            setLoading(false)
        }
    }

    // ITS'den mesaj kodlarını güncelle
    const handleUpdate = async () => {
        if (!confirm('ITS\'den mesaj kodları güncellenecek. Devam etmek istiyor musunuz?')) {
            return
        }

        setUpdateLoading(true)
        setMessage(null)
        try {
            const response = await apiService.guncellemMesajKodlari()
            if (response.success) {
                setMessage({ type: 'success', text: response.message })
                // Listeyi yenile
                await fetchRecords()
            } else {
                setMessage({ type: 'error', text: response.message || 'Güncelleme başarısız' })
            }
        } catch (error) {
            console.error('Mesaj kodları güncelleme hatası:', error)
            setMessage({ type: 'error', text: 'Güncelleme sırasında hata oluştu' })
        } finally {
            setUpdateLoading(false)
        }
    }

    // Grid Column Definitions
    const columnDefs = useMemo(() => [
        {
            headerName: 'ID',
            field: 'id',
            width: 100,
            cellClass: 'font-mono text-center font-bold text-indigo-400',
            cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
        },
        {
            headerName: 'Mesaj',
            field: 'mesaj',
            flex: 1,
            minWidth: 400,
            cellStyle: { display: 'flex', alignItems: 'center' },
            wrapText: true,
            autoHeight: true
        }
    ], [])

    // Default Column Definitions
    const defaultColDef = useMemo(() => ({
        sortable: true,
        resizable: true,
        filter: true
    }), [])

    return (
        <div className="min-h-screen bg-dark-950 p-6">
            {/* Header */}
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="w-10 h-10 flex items-center justify-center rounded-lg bg-dark-800 text-slate-300 hover:bg-dark-700 border border-dark-600 transition-all"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <MessageSquare className="w-7 h-7 text-indigo-400" />
                            <h1 className="text-2xl font-bold text-slate-100">Mesaj Kodları</h1>
                            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs font-semibold rounded">
                                {records.length} Kayıt
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchRecords}
                            disabled={loading}
                            className="px-4 py-2 rounded-lg text-slate-300 bg-dark-700 hover:bg-dark-600 border border-dark-600 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Yenile
                        </button>
                        <button
                            onClick={handleUpdate}
                            disabled={updateLoading}
                            className="px-4 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center gap-2 disabled:opacity-50 font-semibold"
                        >
                            <Download className={`w-4 h-4 ${updateLoading ? 'animate-spin' : ''}`} />
                            {updateLoading ? 'Güncelleniyor...' : 'Mesajları Güncelle'}
                        </button>
                    </div>
                </div>

                {/* Mesaj */}
                {message && (
                    <div className={`mb-4 px-4 py-3 rounded-lg border ${message.type === 'error'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}>
                        <p className="font-medium">{message.text}</p>
                    </div>
                )}

                {/* Grid */}
                <div className="bg-dark-900 rounded-xl border border-dark-700 p-4">
                    <div className="ag-theme-alpine-dark" style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}>
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <div className="animate-spin w-8 h-8 border-3 border-dark-600 border-t-indigo-500 rounded-full mx-auto mb-2" />
                                    <p className="text-slate-400 text-sm">Kayıtlar yükleniyor...</p>
                                </div>
                            </div>
                        ) : records.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                                    <p className="text-slate-400">Mesaj kodu bulunamadı</p>
                                    <p className="text-slate-500 text-sm mt-1">
                                        ITS'den mesaj kodlarını çekmek için "Mesajları Güncelle" butonuna tıklayın.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <AgGridReact
                                ref={gridRef}
                                rowData={records}
                                columnDefs={columnDefs}
                                defaultColDef={defaultColDef}
                                getRowId={(params) => String(params.data.id)}
                                animateRows={true}
                                enableCellTextSelection={true}
                                suppressCellFocus={true}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MesajKodlariPage
