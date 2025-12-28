import { useState, useEffect } from 'react'
import {
    XCircle, FileText, User, Hash, Package,
    CheckCircle, AlertTriangle
} from 'lucide-react'
import apiService from '../../services/apiService'

/**
 * PTS Gönderimi Modal Componenti
 */
const PTSModal = ({
    isOpen,
    onClose,
    document,
    playSuccessSound,
    playErrorSound,
    onSuccess
}) => {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [note, setNote] = useState('')
    const [xmlPreview, setXmlPreview] = useState(null)

    // Modal kapandığında state'leri temizle
    useEffect(() => {
        if (!isOpen) {
            setResult(null)
            setXmlPreview(null)
            setNote('')
            setLoading(false)
        }
    }, [isOpen])

    // GLN kontrolü
    const hasGLN = !!(document?.glnNo || document?.email)

    // Modal kapatma
    const handleClose = () => {
        setResult(null)
        setXmlPreview(null)
        setNote('')
        onClose()
    }

    // XML Önizleme
    const handlePreviewXML = async () => {
        setLoading(true)
        setXmlPreview(null)
        setResult(null)

        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}')
            const kullanici = user.username || 'USER'

            // Ayarları al
            const settingsResponse = await apiService.getSettings()
            const settings = settingsResponse.success ? settingsResponse.data : null

            // XML önizleme endpoint'ini çağır
            const response = await apiService.previewPTSNotification(document.id, kullanici, note, settings)

            if (response.success) {
                setXmlPreview(response.xmlContent)
                playSuccessSound?.()
            } else {
                setResult({ success: false, message: response.message })
                playErrorSound?.()
            }
        } catch (error) {
            console.error('PTS XML Önizleme hatası:', error)
            setResult({
                success: false,
                message: error.message || 'XML oluşturulamadı'
            })
            playErrorSound?.()
        } finally {
            setLoading(false)
        }
    }

    // PTS Gönder
    const handleSend = async () => {
        if (!confirm('Bu belge için PTS bildirimi gönderilecek. Devam etmek istiyor musunuz?')) {
            return
        }

        setLoading(true)
        setResult(null)

        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}')
            const kullanici = user.username || 'USER'

            // Ayarları al
            const settingsResponse = await apiService.getSettings()
            const settings = settingsResponse.success ? settingsResponse.data : null

            const response = await apiService.sendPTSNotification(document.id, kullanici, settings)

            setResult(response)

            if (response.success) {
                playSuccessSound?.()
                onSuccess?.()
            } else {
                playErrorSound?.()
            }
        } catch (error) {
            console.error('PTS Bildirimi hatası:', error)
            setResult({
                success: false,
                message: error.message || 'PTS bildirimi gönderilemedi'
            })
            playErrorSound?.()
        } finally {
            setLoading(false)
        }
    }

    // XML Kopyala
    const handleCopyXML = () => {
        if (xmlPreview) {
            navigator.clipboard.writeText(xmlPreview)
            playSuccessSound?.()
            alert('XML kopyalandı!')
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center" style={{ zIndex: 9999 }}>
            <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-dark-700 shrink-0">
                    <h2 className="text-xl font-bold text-slate-100">PTS Gönderimi</h2>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-dark-700 text-slate-300 hover:bg-dark-600 transition-all"
                    >
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {/* Belge Bilgileri */}
                    <div className="bg-dark-800 rounded-lg p-3 mb-4 border border-dark-600">
                        <div className="flex items-center gap-2 text-slate-300">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="text-sm">Belge No:</span>
                            <span className="font-bold text-slate-100">{document?.documentNo}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300 mt-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="text-sm">Alıcı:</span>
                            <span className="font-bold text-slate-100">{document?.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300 mt-2">
                            <Hash className="w-4 h-4 text-slate-400" />
                            <span className="text-sm">GLN:</span>
                            <span className={`font-bold ${hasGLN ? 'text-indigo-400' : 'text-rose-400'}`}>
                                {document?.glnNo || document?.email || 'Tanımsız'}
                            </span>
                        </div>
                    </div>

                    {/* GLN Boş Uyarısı */}
                    {!hasGLN && (
                        <div className="bg-rose-500/10 rounded-lg p-3 mb-4 border border-rose-500/30">
                            <div className="flex items-center gap-2 text-rose-400 font-bold">
                                <XCircle className="w-4 h-4" />
                                GLN Numarası Tanımlı Değil!
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                                PTS gönderimi için carinin GLN numarası tanımlı olmalıdır.
                            </p>
                        </div>
                    )}

                    {/* Önceki PTS Gönderim Bilgileri */}
                    {document?.ptsId && (
                        <div className="bg-amber-500/10 rounded-lg p-3 mb-4 border border-amber-500/30">
                            <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
                                <AlertTriangle className="w-4 h-4" />
                                Daha Önce PTS Gönderilmiş
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                                <div>
                                    <span className="text-slate-400">PTS ID:</span>
                                    <span className="ml-2 font-bold text-slate-100">{document.ptsId}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400">Tarih:</span>
                                    <span className="ml-2 font-bold text-slate-100">
                                        {document.ptsTarih ? new Date(document.ptsTarih).toLocaleString('tr-TR') : '-'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-400">Kullanıcı:</span>
                                    <span className="ml-2 font-bold text-slate-100">{document.ptsKullanici || '-'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Açıklama (Not) Input */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Açıklama (Opsiyonel)
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Bildirime eklenecek not..."
                            className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                            rows={2}
                        />
                    </div>

                    {/* XML Önizleme */}
                    {xmlPreview && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-emerald-400">
                                    XML Önizleme
                                </label>
                                <button
                                    onClick={handleCopyXML}
                                    className="text-xs px-2 py-1 bg-dark-700 text-slate-300 rounded hover:bg-dark-600"
                                >
                                    Kopyala
                                </button>
                            </div>
                            <textarea
                                value={xmlPreview}
                                readOnly
                                className="w-full px-3 py-2 bg-dark-950 border border-dark-600 rounded-lg text-emerald-300 font-mono text-xs resize-none"
                                rows={12}
                            />
                        </div>
                    )}

                    {/* Hata Mesajı */}
                    {result && !result.success && (
                        <div className="rounded-lg p-4 bg-rose-500/20 border border-rose-500/30">
                            <div className="flex items-center gap-2 text-rose-400 font-bold mb-2">
                                <XCircle className="w-5 h-5" />
                                Hata
                            </div>
                            <p className="text-slate-300 text-sm">{result.message}</p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-dark-700 shrink-0">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 rounded-lg text-slate-300 bg-dark-700 hover:bg-dark-600 transition-all"
                    >
                        Kapat
                    </button>
                    <button
                        onClick={handlePreviewXML}
                        disabled={loading || !hasGLN}
                        className="px-4 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-all font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                İşleniyor...
                            </>
                        ) : (
                            <>
                                <FileText className="w-4 h-4" />
                                XML Göster
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={loading || result?.success || !hasGLN}
                        className="px-4 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 transition-all font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                Gönderiliyor...
                            </>
                        ) : result?.success ? (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Gönderildi
                            </>
                        ) : (
                            <>
                                <Package className="w-4 h-4" />
                                Gönder
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PTSModal

