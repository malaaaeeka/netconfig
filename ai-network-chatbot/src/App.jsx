import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from './lib/firebase'
import Login from './pages/Login'
import Chat from './pages/Chat'
import History from './pages/History'

function App() {
  const [user, loading] = useAuthState(auth)
if (loading) {
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" strokeDasharray="15.7 62.8">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  )
}

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/chat" /> : <Login />} />
        <Route path="/chat" element={user ? <Chat /> : <Navigate to="/" />} />
        <Route path="/history" element={user ? <History /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App