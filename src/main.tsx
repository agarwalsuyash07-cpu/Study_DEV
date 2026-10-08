import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Revision from './pages/Revision'
import Settings from './pages/Settings'
import Today from './pages/Today'
import TrackDetail from './pages/TrackDetail'
import Tracks from './pages/Tracks'
import Week from './pages/Week'
import './index.css'

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="today" element={<Today />} />
          <Route path="tracks" element={<Tracks />} />
          <Route path="tracks/:trackId" element={<TrackDetail />} />
          <Route path="week" element={<Week />} />
          <Route path="revision" element={<Revision />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
