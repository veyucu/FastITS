import { createContext, useContext, useState, useEffect } from 'react'
import apiService from '../services/apiService'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [selectedCompany, setSelectedCompanyState] = useState(null)
  const [loading, setLoading] = useState(true)

  // Sayfa yüklendiğinde kullanıcı ve şirketi kontrol et
  // Kullanıcı: localStorage (kalıcı - beni hatırla)
  // Şirket: sessionStorage (sekme bazlı)
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const storedCompany = sessionStorage.getItem('selectedCompany')

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (error) {
        localStorage.removeItem('user')
      }
    }

    if (storedCompany) {
      try {
        setSelectedCompanyState(JSON.parse(storedCompany))
      } catch (error) {
        sessionStorage.removeItem('selectedCompany')
      }
    }

    setLoading(false)
  }, [])

  const login = async (username, password, company = null, rememberMe = false) => {
    try {
      // API üzerinden login
      const result = await apiService.login(username, password)

      if (result.success) {
        // Şirket yetki kontrolü (admin kullanıcılar tüm şirketlere erişebilir)
        const isAdmin = result.user.role === 'admin'
        if (company && result.user.authorizedCompanies && !isAdmin) {
          const authorizedCodes = result.user.authorizedCompanies.split(',').map(c => c.trim().toUpperCase())
          if (!authorizedCodes.includes(company.sirket.toUpperCase())) {
            return {
              success: false,
              error: 'Bu şirkete erişim yetkiniz bulunmuyor!'
            }
          }
        }

        setUser(result.user)
        localStorage.setItem('user', JSON.stringify(result.user))

        // Beni hatırla seçiliyse kullanıcı adı/şifreyi kaydet
        if (rememberMe) {
          localStorage.setItem('rememberedCredentials', JSON.stringify({ username, password }))
        } else {
          localStorage.removeItem('rememberedCredentials')
        }

        // Şirketi sessionStorage'a kaydet (sekme bazlı)
        if (company) {
          setSelectedCompanyState(company)
          sessionStorage.setItem('selectedCompany', JSON.stringify(company))
        }

        return { success: true, user: result.user }
      }

      return {
        success: false,
        error: result.error || 'Kullanıcı adı veya şifre hatalı!'
      }
    } catch (error) {
      console.error('Login error:', error)
      return {
        success: false,
        error: 'Giriş işlemi sırasında bir hata oluştu'
      }
    }
  }

  const setSelectedCompany = (company) => {
    setSelectedCompanyState(company)
    if (company) {
      sessionStorage.setItem('selectedCompany', JSON.stringify(company))
    } else {
      sessionStorage.removeItem('selectedCompany')
    }
  }

  const logout = () => {
    setUser(null)
    setSelectedCompanyState(null)
    localStorage.removeItem('user')
    sessionStorage.removeItem('selectedCompany')
    // rememberedCredentials'ı silme - kullanıcı isterse hatırlasın
  }

  const getRememberedCredentials = () => {
    try {
      const stored = localStorage.getItem('rememberedCredentials')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  const value = {
    user,
    selectedCompany,
    setSelectedCompany,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    requiresCompanySelection: !!user && !selectedCompany, // Kullanıcı var ama şirket seçilmemiş
    getRememberedCredentials
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
