import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProfiloProvider } from './context/ProfiloContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="rounded-xl bg-white px-6 py-4 shadow-sm">
          <p className="text-sm text-slate-500">Caricamento in corso...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ProfiloProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </ProfiloProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
