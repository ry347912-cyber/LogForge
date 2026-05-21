import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import Layout from './components/dashboard/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import LogsPage from './pages/LogsPage.jsx'
import AlertsPage from './pages/AlertsPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import IngestPage from './pages/IngestPage.jsx'
import SystemPage from './pages/SystemPage.jsx'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-forge-900">
      <div className="text-forge-400 animate-pulse font-mono text-sm">Initializing LogForge...</div>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1a2440', border: '1px solid #1e3a5f', color: '#f1f5f9' },
            duration: 4000,
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="ingest" element={<IngestPage />} />
            <Route path="system" element={<SystemPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
