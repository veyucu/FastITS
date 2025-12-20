import { createContext, useContext, useState, useEffect } from 'react'
import usersData from '../data/users.json'

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
    // JSON'dan kullanıcıları kontrol et
    const foundUser = usersData.users.find(
      u => u.username === username && u.password === password
    )

    if (foundUser) {
      // Şifreyi kaldır (güvenlik için)
      const { password: _, ...userWithoutPassword } = foundUser
      setUser(userWithoutPassword)
      localStorage.setItem('user', JSON.stringify(userWithoutPassword))
      return { success: true, user: userWithoutPassword }
    }

    return { 
      success: false, 
      error: 'Kullanıcı adı veya şifre hatalı!' 
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






















