import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { Spinner } from './components/ui'
import { ErrorBoundary } from './components/ErrorBoundary'
import Backdrop from './components/Backdrop'
import Shell from './components/Shell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Locations from './pages/Locations'
import LocationDetail from './pages/LocationDetail'
import Catalog from './pages/Catalog'
import Templates from './pages/Templates'
import Activity from './pages/Activity'
import Users from './pages/Users'

function Gate() {
  const { session, loading } = useAuth()

  // Session check hone tak kuch mat dikhao — warna har refresh par
  // login screen ek pal ke liye flash hoti hai
  if (loading) return <div className="min-h-screen grid place-items-center"><Spinner /></div>
  if (!session) return <Login />

  return (
    <Routes>
      <Route element={<ErrorBoundary><Shell /></ErrorBoundary>}>
        <Route index element={<Dashboard />} />
        <Route path="locations" element={<Locations />} />
        <Route path="locations/:id" element={<LocationDetail />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="templates" element={<Templates />} />
        <Route path="activity" element={<Activity />} />
        <Route path="people" element={<Users />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <>
      {/* Ambient layer sabse peeche — har route iske upar tairta hai */}
      <Backdrop />
      <BrowserRouter>
        <AuthProvider><Gate /></AuthProvider>
      </BrowserRouter>
    </>
  )
}
