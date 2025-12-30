import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, Building2, Check, X, RefreshCw, Save } from 'lucide-react'
import apiService from '../services/apiService'
import { useAuth } from '../context/AuthContext'
import usePageTitle from '../hooks/usePageTitle'

const CompanySettingsPage = () => {
    usePageTitle('Şirket Ayarları')
    const navigate = useNavigate()
    const { user } = useAuth()
    const [companies, setCompanies] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(null)
    const [message, setMessage] = useState(null)

    // Şirketleri yükle
    const fetchCompanies = async () => {
        setLoading(true)
        try {
            const result = await apiService.getCompanySettings()
            if (result.success) {
                setCompanies(result.data || [])
            } else {
                setMessage({ type: 'error', text: result.error || 'Şirketler alınamadı' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Şirketler yüklenirken hata oluştu' })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCompanies()
    }, [])

    // Şirket durumunu değiştir
    const toggleCompany = async (sirket, currentStatus) => {
        setSaving(sirket)
        try {
            const result = await apiService.updateCompanyStatus(sirket, !currentStatus)
            if (result.success) {
                setCompanies(prev => prev.map(c =>
                    c.sirket === sirket ? { ...c, aktif: !currentStatus } : c
                ))
                setMessage({ type: 'success', text: `${sirket} ${!currentStatus ? 'aktif' : 'pasif'} yapıldı` })
            } else {
                setMessage({ type: 'error', text: result.error || 'Güncelleme başarısız' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Güncelleme sırasında hata oluştu' })
        } finally {
            setSaving(null)
        }
    }

    // Mesaj otomatik temizleme
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [message])

    // Admin değilse yönlendir
    if (user?.role !== 'admin') {
        navigate('/dashboard')
        return null
    }

    return (
        <div className="flex flex-col h-screen bg-dark-950">
            {/* Header */}
            <div className="bg-dark-900/80 backdrop-blur-sm border-b border-dark-700">
                <div className="px-6 py-3">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-dark-700 rounded-lg transition-colors"
                            >
                                <Home className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-cyan-400" />
                                <h1 className="text-lg font-semibold text-slate-100">Şirket Ayarları</h1>
                            </div>
                        </div>
                        <button
                            onClick={fetchCompanies}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:bg-dark-700 rounded-lg transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Yenile
                        </button>
                    </div>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`mx-6 mt-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {message.text}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-2xl mx-auto">
                    <p className="text-slate-400 text-sm mb-4">
                        Aşağıdaki şirketlerden hangilerinin FastITS'de aktif olacağını seçin.
                        Sadece aktif şirketler login ekranında görünür.
                    </p>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-8 h-8 text-primary-400 animate-spin" />
                        </div>
                    ) : companies.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            Şirket bulunamadı
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {companies.map(company => (
                                <div
                                    key={company.sirket}
                                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${company.aktif
                                            ? 'bg-emerald-500/10 border-emerald-500/30'
                                            : 'bg-dark-800/60 border-dark-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Building2 className={`w-5 h-5 ${company.aktif ? 'text-emerald-400' : 'text-slate-500'}`} />
                                        <span className={`font-medium ${company.aktif ? 'text-emerald-300' : 'text-slate-400'}`}>
                                            {company.sirket}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => toggleCompany(company.sirket, company.aktif)}
                                        disabled={saving === company.sirket}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${company.aktif
                                                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                                                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                            } disabled:opacity-50`}
                                    >
                                        {saving === company.sirket ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : company.aktif ? (
                                            <>
                                                <X className="w-4 h-4" />
                                                Pasif Yap
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Aktif Yap
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Summary */}
                    <div className="mt-6 p-4 bg-dark-800/60 rounded-lg border border-dark-700">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Toplam Şirket:</span>
                            <span className="text-slate-200">{companies.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-2">
                            <span className="text-slate-400">Aktif Şirket:</span>
                            <span className="text-emerald-400">{companies.filter(c => c.aktif).length}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CompanySettingsPage
