import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { Users, Home, Plus, Trash2, Edit, Save, X, RefreshCw, Key, Check } from 'lucide-react'
import apiService from '../services/apiService'
import { useAuth } from '../context/AuthContext'
import usePageTitle from '../hooks/usePageTitle'

const UsersPage = () => {
    usePageTitle('Kullanıcılar')
    const navigate = useNavigate()
    const { user } = useAuth()
    const gridRef = useRef(null)
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState(null)
    const [editingUser, setEditingUser] = useState(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(null)

    // Form states
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        name: '',
        email: '',
        department: '',
        role: 'user',
        permissions: {
            urunHazirlama: true,
            pts: true,
            mesajKodlari: false,
            ayarlar: false,
            kullanicilar: false
        }
    })

    const [newPassword, setNewPassword] = useState('')

    // Kullanıcıları yükle
    const fetchUsers = async () => {
        setLoading(true)
        try {
            const result = await apiService.getUsers()
            if (result.success) {
                setUsers(result.data || [])
            } else {
                setMessage({ type: 'error', text: result.error || 'Kullanıcılar alınamadı' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Kullanıcılar yüklenirken hata oluştu' })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    // Grid Column Definitions
    const columnDefs = useMemo(() => [
        { headerName: 'ID', field: 'id', width: 70 },
        { headerName: 'Kullanıcı Adı', field: 'username', width: 130 },
        { headerName: 'Ad Soyad', field: 'name', flex: 1 },
        { headerName: 'Email', field: 'email', width: 200 },
        { headerName: 'Departman', field: 'department', width: 120 },
        { headerName: 'Rol', field: 'role', width: 80 },
        {
            headerName: 'Durum',
            field: 'aktif',
            width: 90,
            cellRenderer: (params) => (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${params.value ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {params.value ? 'Aktif' : 'Pasif'}
                </span>
            )
        },
        {
            headerName: 'Yetkiler',
            width: 200,
            cellRenderer: (params) => {
                const p = params.data.permissions || {}
                const perms = []
                if (p.urunHazirlama) perms.push('ÜH')
                if (p.pts) perms.push('PTS')
                if (p.mesajKodlari) perms.push('MK')
                if (p.ayarlar) perms.push('AY')
                if (p.kullanicilar) perms.push('KL')
                return (
                    <div className="flex gap-1 flex-wrap">
                        {perms.map((p, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded text-xs">{p}</span>
                        ))}
                    </div>
                )
            }
        },
        {
            headerName: 'İşlemler',
            width: 140,
            cellRenderer: (params) => (
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => handleEdit(params.data)}
                        className="p-1.5 hover:bg-primary-500/20 rounded transition-colors"
                        title="Düzenle"
                    >
                        <Edit className="w-4 h-4 text-primary-400" />
                    </button>
                    <button
                        onClick={() => setShowPasswordModal(params.data)}
                        className="p-1.5 hover:bg-amber-500/20 rounded transition-colors"
                        title="Şifre Değiştir"
                    >
                        <Key className="w-4 h-4 text-amber-400" />
                    </button>
                    {params.data.username !== 'admin' && (
                        <button
                            onClick={() => handleDelete(params.data)}
                            className="p-1.5 hover:bg-rose-500/20 rounded transition-colors"
                            title="Sil"
                        >
                            <Trash2 className="w-4 h-4 text-rose-400" />
                        </button>
                    )}
                </div>
            )
        }
    ], [])

    const defaultColDef = useMemo(() => ({
        sortable: true,
        resizable: true
    }), [])

    // Handlers
    const handleEdit = (user) => {
        setEditingUser(user)
        setFormData({
            username: user.username,
            password: '',
            name: user.name || '',
            email: user.email || '',
            department: user.department || '',
            role: user.role || 'user',
            permissions: user.permissions || {
                urunHazirlama: true,
                pts: true,
                mesajKodlari: false,
                ayarlar: false,
                kullanicilar: false
            }
        })
        setShowAddModal(true)
    }

    const handleDelete = async (userData) => {
        if (userData.username === 'admin') {
            setMessage({ type: 'error', text: 'Admin kullanıcısı silinemez!' })
            return
        }

        if (!confirm(`${userData.name || userData.username} kullanıcısını silmek istediğinize emin misiniz?`)) {
            return
        }

        try {
            const result = await apiService.deleteUser(userData.id)
            if (result.success) {
                setMessage({ type: 'success', text: 'Kullanıcı silindi' })
                fetchUsers()
            } else {
                setMessage({ type: 'error', text: result.error || 'Silme başarısız' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Silme sırasında hata oluştu' })
        }
    }

    const handleSave = async () => {
        try {
            if (editingUser) {
                // Güncelle
                const result = await apiService.updateUser(editingUser.id, formData)
                if (result.success) {
                    setMessage({ type: 'success', text: 'Kullanıcı güncellendi' })
                    fetchUsers()
                    closeModal()
                } else {
                    setMessage({ type: 'error', text: result.error || 'Güncelleme başarısız' })
                }
            } else {
                // Yeni ekle
                if (!formData.username || !formData.password) {
                    setMessage({ type: 'error', text: 'Kullanıcı adı ve şifre gerekli' })
                    return
                }
                const result = await apiService.createUser(formData)
                if (result.success) {
                    setMessage({ type: 'success', text: 'Kullanıcı eklendi' })
                    fetchUsers()
                    closeModal()
                } else {
                    setMessage({ type: 'error', text: result.error || 'Ekleme başarısız' })
                }
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'İşlem sırasında hata oluştu' })
        }
    }

    const handlePasswordChange = async () => {
        if (!newPassword) {
            setMessage({ type: 'error', text: 'Yeni şifre gerekli' })
            return
        }

        try {
            const result = await apiService.changeUserPassword(showPasswordModal.id, newPassword)
            if (result.success) {
                setMessage({ type: 'success', text: 'Şifre değiştirildi' })
                setShowPasswordModal(null)
                setNewPassword('')
            } else {
                setMessage({ type: 'error', text: result.error || 'Şifre değiştirilemedi' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Şifre değiştirme hatası' })
        }
    }

    const closeModal = () => {
        setShowAddModal(false)
        setEditingUser(null)
        setFormData({
            username: '',
            password: '',
            name: '',
            email: '',
            department: '',
            role: 'user',
            permissions: {
                urunHazirlama: true,
                pts: true,
                mesajKodlari: false,
                ayarlar: false,
                kullanicilar: false
            }
        })
    }

    const togglePermission = (key) => {
        setFormData(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [key]: !prev.permissions[key]
            }
        }))
    }

    return (
        <div className="flex flex-col h-screen bg-dark-950">
            {/* Header */}
            <div className="bg-dark-900/80 backdrop-blur-sm border-b border-dark-700">
                <div className="px-6 py-3">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate('/')}
                                className="w-8 h-8 bg-dark-700 rounded flex items-center justify-center hover:bg-dark-600 transition-colors border border-dark-600"
                                title="Ana Menü"
                            >
                                <Home className="w-5 h-5 text-slate-300" />
                            </button>
                            <div className="w-8 h-8 bg-rose-600 rounded flex items-center justify-center shadow-lg shadow-rose-600/30">
                                <Users className="w-5 h-5 text-white" />
                            </div>
                            <h1 className="text-lg font-bold text-slate-100">Kullanıcı Yönetimi</h1>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchUsers}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-dark-700 text-slate-300 rounded-lg hover:bg-dark-600 transition-colors border border-dark-600"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                Yenile
                            </button>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg shadow-lg shadow-primary-600/30 hover:bg-primary-500 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Yeni Kullanıcı
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages */}
            {message && (
                <div className={`mx-6 mt-4 p-3 rounded-lg ${message.type === 'error' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} className="float-right">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Grid */}
            <div className="flex-1 px-6 py-4">
                <div className="ag-theme-alpine h-full rounded-xl shadow-dark-lg overflow-hidden border border-dark-700">
                    <AgGridReact
                        ref={gridRef}
                        rowData={users}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        animateRows={true}
                        onGridReady={(params) => params.api.sizeColumnsToFit()}
                    />
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 w-[500px] max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-slate-100 mb-4">
                            {editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Kullanıcı Adı</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    disabled={!!editingUser}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-slate-100 disabled:opacity-50"
                                />
                            </div>

                            {!editingUser && (
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Şifre</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-slate-100"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Ad Soyad</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Departman</label>
                                <input
                                    type="text"
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Rol</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-slate-100"
                                >
                                    <option value="user">Kullanıcı</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            {/* Yetkiler */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Menü Yetkileri</label>
                                <div className="space-y-2">
                                    {[
                                        { key: 'urunHazirlama', label: 'Ürün Hazırlama' },
                                        { key: 'pts', label: 'PTS Yönetimi' },
                                        { key: 'mesajKodlari', label: 'Mesaj Kodları' },
                                        { key: 'ayarlar', label: 'Ayarlar' },
                                        { key: 'kullanicilar', label: 'Kullanıcılar' }
                                    ].map(({ key, label }) => (
                                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.permissions[key]}
                                                onChange={() => togglePermission(key)}
                                                className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-600"
                                            />
                                            <span className="text-slate-300">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-dark-700 text-slate-300 rounded-lg hover:bg-dark-600 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-500 transition-colors"
                            >
                                <Save className="w-4 h-4" />
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 w-[400px]">
                        <h2 className="text-xl font-bold text-slate-100 mb-4">
                            Şifre Değiştir: {showPasswordModal.name || showPasswordModal.username}
                        </h2>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Yeni Şifre</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-slate-100"
                            />
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => { setShowPasswordModal(null); setNewPassword('') }}
                                className="px-4 py-2 bg-dark-700 text-slate-300 rounded-lg hover:bg-dark-600 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handlePasswordChange}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors"
                            >
                                <Key className="w-4 h-4" />
                                Değiştir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default UsersPage
