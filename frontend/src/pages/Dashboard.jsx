import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  Package,
  LogOut,
  User,
  ArrowRight,
  Truck,
  Settings,
  Users,
  FileText,
  Stethoscope
} from 'lucide-react'
import usePageTitle from '../hooks/usePageTitle'

const Dashboard = () => {
  usePageTitle('Ana Menü')
  const navigate = useNavigate()
  const { user, logout, selectedCompany } = useAuth()

  // Şirket seçilmediyse login sayfasına yönlendir (yeni sekme açılınca)
  useEffect(() => {
    if (!selectedCompany) {
      navigate('/login', { replace: true })
    }
  }, [selectedCompany, navigate])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Yetki kontrolü
  const hasPermission = (permKey) => {
    if (!user?.permissions) return true // Eski kullanıcılar için varsayılan
    return user.permissions[permKey] === true
  }

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Background Effects - Mobilde gizli */}
      <div className="hidden md:block fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header - Mobile Responsive */}
      <header className="relative bg-dark-900/80 backdrop-blur-sm border-b border-dark-700">
        <div className="px-4 py-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded flex items-center justify-center shadow-lg shadow-primary-600/30">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-slate-100">
                Fast<span className="text-primary-400">ITS</span>
                {selectedCompany && (
                  <span className="ml-2 text-base font-semibold text-cyan-400">• {selectedCompany.sirket}</span>
                )}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 rounded-lg transition-colors border border-dark-600">
                <User className="w-4 h-4 text-slate-400" />
                <span>{user?.username}</span>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-rose-500/30"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Çıkış</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Compact for Mobile */}
      <main className="relative max-w-7xl mx-auto px-3 md:px-6 lg:px-8 py-4 md:py-12">
        {/* Quick Actions - 2 columns on mobile, 3 on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
          {/* Ürün Hazırlama */}
          {hasPermission('urunHazirlama') && (
            <button
              onClick={() => navigate('/documents')}
              className="bg-dark-800/60 backdrop-blur-sm rounded-xl shadow-dark-lg transition-all p-4 md:p-8 text-left group border border-dark-700 hover:border-violet-500/50 hover:shadow-violet-500/10"
            >
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2 md:mb-4">
                  <div className="w-10 md:w-16 h-10 md:h-16 bg-violet-500/20 rounded-xl flex items-center justify-center group-hover:bg-violet-600 transition-colors border border-violet-500/30">
                    <Package className="w-5 md:w-8 h-5 md:h-8 text-violet-400 group-hover:text-white transition-colors" />
                  </div>
                  <ArrowRight className="w-4 md:w-6 h-4 md:h-6 text-slate-600 group-hover:text-violet-400 transition-colors" />
                </div>
                <div>
                  <h3 className="text-sm md:text-xl font-bold text-slate-100 mb-0.5 md:mb-1">Ürün Hazırlama</h3>
                  <p className="hidden md:block text-sm text-slate-500">Ürün hazırlama işlemlerini başlat</p>
                </div>
              </div>
            </button>
          )}

          {/* PTS */}
          {hasPermission('pts') && (
            <button
              onClick={() => navigate('/pts', { state: { fromDashboard: true } })}
              className="bg-dark-800/60 backdrop-blur-sm rounded-xl shadow-dark-lg transition-all p-4 md:p-8 text-left group border border-dark-700 hover:border-primary-500/50 hover:shadow-primary-500/10"
            >
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2 md:mb-4">
                  <div className="w-10 md:w-16 h-10 md:h-16 bg-primary-500/20 rounded-xl flex items-center justify-center group-hover:bg-primary-600 transition-colors border border-primary-500/30">
                    <Truck className="w-5 md:w-8 h-5 md:h-8 text-primary-400 group-hover:text-white transition-colors" />
                  </div>
                  <ArrowRight className="w-4 md:w-6 h-4 md:h-6 text-slate-600 group-hover:text-primary-400 transition-colors" />
                </div>
                <div>
                  <h3 className="text-sm md:text-xl font-bold text-slate-100 mb-0.5 md:mb-1">PTS İşlemleri</h3>
                  <p className="hidden md:block text-sm text-slate-500">Paket Transfer Sistemi</p>
                </div>
              </div>
            </button>
          )}

          {/* Serbest Bildirim */}
          {hasPermission('serbestBildirim') && (
            <button
              onClick={() => navigate('/serbest-bildirim')}
              className="bg-dark-800/60 backdrop-blur-sm rounded-xl shadow-dark-lg transition-all p-4 md:p-8 text-left group border border-dark-700 hover:border-indigo-500/50 hover:shadow-indigo-500/10"
            >
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2 md:mb-4">
                  <div className="w-10 md:w-16 h-10 md:h-16 bg-indigo-500/20 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors border border-indigo-500/30">
                    <FileText className="w-5 md:w-8 h-5 md:h-8 text-indigo-400 group-hover:text-white transition-colors" />
                  </div>
                  <ArrowRight className="w-4 md:w-6 h-4 md:h-6 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div>
                  <h3 className="text-sm md:text-xl font-bold text-slate-100 mb-0.5 md:mb-1">Serbest Bildirim</h3>
                  <p className="hidden md:block text-sm text-slate-500">Manuel ITS bildirimleri</p>
                </div>
              </div>
            </button>
          )}

          {/* UTS İşlemleri */}
          {hasPermission('utsIslemleri') && (
            <button
              onClick={() => navigate('/uts')}
              className="bg-dark-800/60 backdrop-blur-sm rounded-xl shadow-dark-lg transition-all p-4 md:p-8 text-left group border border-dark-700 hover:border-teal-500/50 hover:shadow-teal-500/10"
            >
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2 md:mb-4">
                  <div className="w-10 md:w-16 h-10 md:h-16 bg-teal-500/20 rounded-xl flex items-center justify-center group-hover:bg-teal-600 transition-colors border border-teal-500/30">
                    <Stethoscope className="w-5 md:w-8 h-5 md:h-8 text-teal-400 group-hover:text-white transition-colors" />
                  </div>
                  <ArrowRight className="w-4 md:w-6 h-4 md:h-6 text-slate-600 group-hover:text-teal-400 transition-colors" />
                </div>
                <div>
                  <h3 className="text-sm md:text-xl font-bold text-slate-100 mb-0.5 md:mb-1">UTS İşlemleri</h3>
                  <p className="hidden md:block text-sm text-slate-500">Ürün takip sistemi</p>
                </div>
              </div>
            </button>
          )}

          {/* Kullanıcılar */}
          {hasPermission('kullanicilar') && (
            <button
              onClick={() => navigate('/users')}
              className="bg-dark-800/60 backdrop-blur-sm rounded-xl shadow-dark-lg transition-all p-4 md:p-8 text-left group border border-dark-700 hover:border-rose-500/50 hover:shadow-rose-500/10"
            >
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2 md:mb-4">
                  <div className="w-10 md:w-16 h-10 md:h-16 bg-rose-500/20 rounded-xl flex items-center justify-center group-hover:bg-rose-600 transition-colors border border-rose-500/30">
                    <Users className="w-5 md:w-8 h-5 md:h-8 text-rose-400 group-hover:text-white transition-colors" />
                  </div>
                  <ArrowRight className="w-4 md:w-6 h-4 md:h-6 text-slate-600 group-hover:text-rose-400 transition-colors" />
                </div>
                <div>
                  <h3 className="text-sm md:text-xl font-bold text-slate-100 mb-0.5 md:mb-1">Kullanıcılar</h3>
                  <p className="hidden md:block text-sm text-slate-500">Kullanıcı ve yetki yönetimi</p>
                </div>
              </div>
            </button>
          )}

          {/* Ayarlar */}
          {hasPermission('ayarlar') && (
            <button
              onClick={() => navigate('/settings')}
              className="bg-dark-800/60 backdrop-blur-sm rounded-xl shadow-dark-lg transition-all p-4 md:p-8 text-left group border border-dark-700 hover:border-amber-500/50 hover:shadow-amber-500/10"
            >
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2 md:mb-4">
                  <div className="w-10 md:w-16 h-10 md:h-16 bg-amber-500/20 rounded-xl flex items-center justify-center group-hover:bg-amber-600 transition-colors border border-amber-500/30">
                    <Settings className="w-5 md:w-8 h-5 md:h-8 text-amber-400 group-hover:text-white transition-colors" />
                  </div>
                  <ArrowRight className="w-4 md:w-6 h-4 md:h-6 text-slate-600 group-hover:text-amber-400 transition-colors" />
                </div>
                <div>
                  <h3 className="text-sm md:text-xl font-bold text-slate-100 mb-0.5 md:mb-1">Ayarlar</h3>
                  <p className="hidden md:block text-sm text-slate-500">ITS/UTS ve ERP entegrasyon ayarları</p>
                </div>
              </div>
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

export default Dashboard
