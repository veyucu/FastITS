import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  Package, 
  LogOut, 
  User, 
  ArrowRight,
  Truck,
  Settings
} from 'lucide-react'

const Dashboard = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative bg-dark-900/80 backdrop-blur-sm border-b border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-600/30">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-100">Atakod<span className="text-primary-400">ITS</span></h1>
                <p className="text-sm text-slate-500">Ürün Hazırlama Sistemi</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-dark-800/80 rounded-lg border border-dark-700">
                <User className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-200">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.role}</p>
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-rose-500/30"
              >
                <LogOut className="w-4 h-4" />
                Çıkış
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <button
            onClick={() => navigate('/documents')}
            className="bg-dark-800/60 backdrop-blur-sm rounded-xl shadow-dark-lg transition-all p-8 text-left group border border-dark-700 hover:border-violet-500/50 hover:shadow-violet-500/10"
          >
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="w-16 h-16 bg-violet-500/20 rounded-xl flex items-center justify-center group-hover:bg-violet-600 transition-colors border border-violet-500/30">
                  <Package className="w-8 h-8 text-violet-400 group-hover:text-white transition-colors" />
                </div>
                <ArrowRight className="w-6 h-6 text-slate-600 group-hover:text-violet-400 transition-colors" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100 mb-1">Ürün Hazırlama</h3>
                <p className="text-sm text-slate-500">Ürün hazırlama işlemlerini başlat</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/pts')}
            className="bg-dark-800/60 backdrop-blur-sm rounded-xl shadow-dark-lg transition-all p-8 text-left group border border-dark-700 hover:border-primary-500/50 hover:shadow-primary-500/10"
          >
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="w-16 h-16 bg-primary-500/20 rounded-xl flex items-center justify-center group-hover:bg-primary-600 transition-colors border border-primary-500/30">
                  <Truck className="w-8 h-8 text-primary-400 group-hover:text-white transition-colors" />
                </div>
                <ArrowRight className="w-6 h-6 text-slate-600 group-hover:text-primary-400 transition-colors" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100 mb-1">PTS</h3>
                <p className="text-sm text-slate-500">Paket Transfer Sistemi</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="bg-dark-800/60 backdrop-blur-sm rounded-xl shadow-dark-lg transition-all p-8 text-left group border border-dark-700 hover:border-amber-500/50 hover:shadow-amber-500/10"
          >
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="w-16 h-16 bg-amber-500/20 rounded-xl flex items-center justify-center group-hover:bg-amber-600 transition-colors border border-amber-500/30">
                  <Settings className="w-8 h-8 text-amber-400 group-hover:text-white transition-colors" />
                </div>
                <ArrowRight className="w-6 h-6 text-slate-600 group-hover:text-amber-400 transition-colors" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100 mb-1">Ayarlar</h3>
                <p className="text-sm text-slate-500">ITS ve ERP entegrasyon ayarları</p>
              </div>
            </div>
          </button>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
