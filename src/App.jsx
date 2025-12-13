import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import DocumentsPage from './pages/DocumentsPage'
import DocumentDetailPage from './pages/DocumentDetailPage'

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

          {/* Legacy routes - yönlendirme */}
          <Route path="/orders" element={<Navigate to="/documents" replace />} />
          <Route path="/orders/:id" element={<Navigate to="/documents/:id" replace />} />
          
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
