import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogIn, User, Lock, AlertCircle, Eye, EyeOff, Package, Building2, ChevronDown } from 'lucide-react'
import usePageTitle from '../hooks/usePageTitle'
import apiService from '../services/apiService'

const LoginPage = () => {
  usePageTitle('Giriş')
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [companiesLoading, setCompaniesLoading] = useState(true)

  const { login, isAuthenticated, selectedCompany: authSelectedCompany, getRememberedCredentials } = useAuth()
  const navigate = useNavigate()

  // Şirketleri yükle ve kayıtlı bilgileri kontrol et
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const result = await apiService.getCompanies()
        if (result.success && result.data?.length > 0) {
          setCompanies(result.data)

          // Son seçili şirketi localStorage'dan al
          const lastCompany = localStorage.getItem('lastSelectedCompany')
          const foundCompany = result.data.find(c => c.sirket === lastCompany)

          if (foundCompany) {
            // Son şirket listede varsa onu seç
            setSelectedCompany(foundCompany)
          } else {
            // Yoksa ilk şirketi seç
            setSelectedCompany(result.data[0])
          }
        }
      } catch (error) {
        console.error('Şirket listesi alınamadı:', error)
      } finally {
        setCompaniesLoading(false)
      }
    }
    fetchCompanies()

    // Kayıtlı kullanıcı bilgilerini yükle
    const remembered = getRememberedCredentials()
    if (remembered) {
      setUsername(remembered.username)
      setPassword(remembered.password)
      setRememberMe(true)
    }
  }, [])

  // Zaten giriş yapılmışsa VE şirket seçiliyse dashboard'a yönlendir
  useEffect(() => {
    if (isAuthenticated && authSelectedCompany) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, authSelectedCompany, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validasyon
    if (!selectedCompany) {
      setError('Lütfen bir şirket seçin')
      return
    }

    if (!username.trim() || !password.trim()) {
      setError('Lütfen tüm alanları doldurun')
      return
    }

    setLoading(true)

    // Login işlemi
    setTimeout(async () => {
      const result = await login(username, password, selectedCompany, rememberMe)

      if (result.success) {
        // Son seçili şirketi kaydet
        localStorage.setItem('lastSelectedCompany', selectedCompany.sirket)
        navigate('/dashboard', { replace: true })
      } else {
        setError(result.error)
      }

      setLoading(false)
    }, 800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-950">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary-500/5 to-transparent rounded-full" />
      </div>

      <div className="relative max-w-md w-full space-y-8 animate-fadeIn">
        {/* Logo ve Başlık */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-primary-500 to-cyan-600 rounded-2xl shadow-2xl shadow-primary-500/30 mb-6 transform hover:scale-105 transition-transform animate-glow">
            <Package className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Fast<span className="text-primary-400">ITS</span>
          </h1>
          <p className="mt-3 text-lg text-slate-400">
            Ürün Hazırlama Sistemi
          </p>
        </div>

        {/* Login Formu */}
        <div className="bg-dark-800/80 backdrop-blur-xl rounded-2xl shadow-dark-xl p-8 border border-dark-700/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Hata Mesajı */}
            {error && (
              <div className="bg-rose-500/10 border-l-4 border-rose-500 p-4 rounded-r-lg animate-shake">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-rose-400 mr-3 flex-shrink-0" />
                  <span className="text-sm font-medium text-rose-300">{error}</span>
                </div>
              </div>
            )}

            {/* Şirket Seçimi */}
            <div>
              <label htmlFor="company" className="block text-sm font-semibold text-slate-300 mb-2">
                Şirket
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-slate-500 group-focus-within:text-primary-400 transition-colors" />
                </div>
                <select
                  id="company"
                  value={selectedCompany?.sirket || ''}
                  onChange={(e) => {
                    const company = companies.find(c => c.sirket === e.target.value)
                    setSelectedCompany(company)
                  }}
                  className="block w-full pl-12 pr-10 py-3.5 bg-dark-900/50 border-2 border-dark-600 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all appearance-none cursor-pointer"
                  disabled={loading || companiesLoading}
                >
                  {companiesLoading ? (
                    <option value="">Yükleniyor...</option>
                  ) : companies.length === 0 ? (
                    <option value="">Şirket bulunamadı</option>
                  ) : (
                    companies.map(company => (
                      <option key={company.sirket} value={company.sirket}>
                        {company.sirket}
                      </option>
                    ))
                  )}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <ChevronDown className="h-5 w-5 text-slate-500" />
                </div>
              </div>
            </div>

            {/* Kullanıcı Adı */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-slate-300 mb-2">
                Kullanıcı Adı
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500 group-focus-within:text-primary-400 transition-colors" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-dark-900/50 border-2 border-dark-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                  placeholder="admin"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Şifre */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-300 mb-2">
                Şifre
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-primary-400 transition-colors" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-12 py-3.5 bg-dark-900/50 border-2 border-dark-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center hover:scale-110 transition-transform"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-slate-500 hover:text-slate-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-slate-500 hover:text-slate-300" />
                  )}
                </button>
              </div>
            </div>

            {/* Beni Hatırla */}
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-dark-600 border-dark-500 text-primary-600 focus:ring-primary-500"
                  disabled={loading}
                />
                <span className="text-sm text-slate-400">Beni Hatırla</span>
              </label>
            </div>

            {/* Giriş Butonu */}
            <button
              type="submit"
              disabled={loading || companiesLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-gradient-to-r from-primary-600 to-cyan-600 hover:from-primary-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-primary-600/30 hover:shadow-primary-500/40 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Giriş Yapılıyor...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Giriş Yap
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-sm">
          © 2025 FastITS. Tüm hakları saklıdır.
        </p>
      </div>
    </div>
  )
}

export default LoginPage
