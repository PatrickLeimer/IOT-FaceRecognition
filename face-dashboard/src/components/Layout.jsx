import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { BACKEND_URL } from '../utils'
import { useToast } from '../context/ToastContext'

export default function Layout({ children }) {
  const [status, setStatus] = useState('checking') // 'online' | 'offline' | 'checking'
  const toast = useToast()

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/health`, {
          signal: AbortSignal.timeout(3000),
          headers: { 'ngrok-skip-browser-warning': 'true' },
        })
        setStatus(res.ok ? 'online' : 'offline')
      } catch {
        setStatus('offline')
      }
    }
    check()
    const id = setInterval(check, 30000)
    return () => clearInterval(id)
  }, [])

  const handleReload = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/reload`, { method: 'POST' })
      if (res.ok) toast('Face encodings reloaded successfully', 'success')
      else        toast('Reload failed — check backend logs', 'error')
    } catch {
      toast('Backend unreachable', 'error')
    }
  }

  const navCls = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-slate-700 text-white'
        : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
    }`

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Top nav */}
      <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Brand + links */}
          <div className="flex items-center gap-6 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A8.966 8.966 0 0112 15c2.21 0 4.232.8 5.879 2.115M15 11a3 3 0 11-6 0 3 3 0 016 0zm6.796 2.43C21.914 12.96 22 12.49 22 12a10 10 0 10-10 10c1.808 0 3.5-.48 4.963-1.32" />
              </svg>
              <span className="font-bold text-teal-400 text-lg tracking-tight">FaceGuard</span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              <NavLink to="/" end className={navCls}>Live Feed</NavLink>
              <NavLink to="/people"  className={navCls}>People</NavLink>
              <NavLink to="/enroll"  className={navCls}>Enroll</NavLink>
            </div>
          </div>

          {/* Status + reload */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`w-2 h-2 rounded-full ${
                status === 'online'   ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' :
                status === 'offline'  ? 'bg-red-400' :
                                        'bg-yellow-400 animate-pulse'
              }`} />
              <span className="hidden sm:inline">
                {status === 'online' ? 'Backend Online' : status === 'offline' ? 'Backend Offline' : 'Checking…'}
              </span>
            </div>
            <button
              onClick={handleReload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-md text-slate-300 transition-colors"
              title="Reload face encodings from Firebase"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Reload Model</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
