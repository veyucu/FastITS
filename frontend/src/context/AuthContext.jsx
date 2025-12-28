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
  const [loading, setLoading] = useState(true)

  // Sayfa yüklendiğinde localStorage'dan kullanıcıyı kontrol et
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (error) {
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    try {
      // API üzerinden login
      const result = await apiService.login(username, password)

      if (result.success) {
        setUser(result.user)
        localStorage.setItem('user', JSON.stringify(result.user))
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

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
  }

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}




