import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import DocumentsPage from './pages/DocumentsPage'
import DocumentDetailPage from './pages/DocumentDetailPage'
import PTSPage from './pages/PTSPage'
import PTSDetailPage from './pages/PTSDetailPage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'
import UTSPage from './pages/UTSPage'
import SerbestBildirimPage from './pages/SerbestBildirimPage'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <DocumentsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/documents/:id"
            element={
              <ProtectedRoute>
                <DocumentDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/pts"
            element={
              <ProtectedRoute>
                <PTSPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/pts/:transferId"
            element={
              <ProtectedRoute>
                <PTSDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <UsersPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/uts"
            element={
              <ProtectedRoute>
                <UTSPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/serbest-bildirim"
            element={
              <ProtectedRoute>
                <SerbestBildirimPage />
              </ProtectedRoute>
            }
          />

          {/* Default Route - Login'e yönlendir */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* 404 - Dashboard'a yönlendir */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
