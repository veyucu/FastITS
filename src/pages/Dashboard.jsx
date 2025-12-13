import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  Package, 
  FileText, 
  LogOut, 
  User, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight
} from 'lucide-react'
import apiService from '../services/apiService'

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    preparing: 0,
    completed: 0
  })
  const [recentDocuments, setRecentDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await apiService.getDocuments()
      
      if (response.success && response.data) {
        const docs = response.data
        
        // İstatistikleri hesapla
        setStats({
          total: docs.length,
          pending: docs.filter(d => d.status === 'pending').length,
          preparing: docs.filter(d => d.status === 'preparing').length,
          completed: docs.filter(d => d.status === 'completed').length
        })

        // Son 5 dökümanı al
        setRecentDocuments(docs.slice(0, 5))
      }
    } catch (error) {
      console.error('Dashboard data fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getStatusBadge = (status) => {
    const config = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: 'Bekliyor' },
      preparing: { bg: 'bg-blue-100', text: 'text-blue-800', icon: AlertCircle, label: 'Hazırlanıyor' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle, label: 'Tamamlandı' }
    }
    const { bg, text, icon: Icon, label } = config[status] || config.pending
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AtakodITS</h1>
                <p className="text-sm text-gray-500">Ürün Hazırlama Sistemi</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                <User className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.role}</p>
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Çıkış
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <TrendingUp className="w-5 h-5 text-white/70" />
            </div>
            <p className="text-sm text-blue-100 mb-1">Toplam Döküman</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm text-yellow-100 mb-1">Bekleyen</p>
            <p className="text-3xl font-bold">{stats.pending}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm text-purple-100 mb-1">Hazırlanıyor</p>
            <p className="text-3xl font-bold">{stats.preparing}</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm text-green-100 mb-1">Tamamlanan</p>
            <p className="text-3xl font-bold">{stats.completed}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => navigate('/documents')}
            className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all p-6 text-left group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  <FileText className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Dökümanlar</h3>
                  <p className="text-sm text-gray-500">Tüm dökümanları görüntüle ve yönet</p>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
          </button>

          <button
            onClick={() => navigate('/documents')}
            className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all p-6 text-left group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-600 transition-colors">
                  <Package className="w-7 h-7 text-purple-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Ürün Hazırlama</h3>
                  <p className="text-sm text-gray-500">Ürün hazırlama işlemlerini başlat</p>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </div>
          </button>
        </div>

        {/* Recent Documents */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Son Dökümanlar</h2>
            <button
              onClick={() => navigate('/documents')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Tümünü Gör →
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-3 border-gray-200 border-t-blue-600 rounded-full mx-auto" />
            </div>
          ) : recentDocuments.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Henüz döküman yok</p>
          ) : (
            <div className="space-y-3">
              {recentDocuments.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{doc.orderNo}</p>
                      <p className="text-sm text-gray-500">{doc.customerName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-900 font-medium">
                        {doc.preparedItems}/{doc.totalItems} Kalem
                      </p>
                      <p className="text-xs text-gray-500">{doc.city}</p>
                    </div>
                    {getStatusBadge(doc.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default Dashboard
