import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { BACKEND_URL } from '../utils'
import { useToast } from '../context/ToastContext'

const EyeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="1" fill="currentColor"/>
  </svg>
)

const ReloadIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
  </svg>
)

export default function Layout({ children }) {
  const [status, setStatus] = useState('checking')
  const [reloading, setReloading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(3000) })
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
    setReloading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/reload`, { method: 'POST' })
      if (res.ok) toast('Face encodings reloaded', 'success')
      else        toast('Reload failed — check backend logs', 'error')
    } catch {
      toast('Backend unreachable', 'error')
    } finally {
      setReloading(false)
    }
  }

  const navCls = ({ isActive }) =>
    `nav-link-cyber${isActive ? ' active' : ''}`

  const statusColor = status === 'online' ? 'var(--green)' : status === 'offline' ? 'var(--red)' : 'var(--amber)'
  const statusLabel = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Connecting'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--t1)', fontFamily: 'var(--ff-ui)' }}>
      <nav className="nav-cyber sticky top-0 z-30">
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>

          {/* Brand + Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
              <div style={{ color: 'var(--cyan)' }}>
                <EyeIcon />
              </div>
              <span style={{
                fontFamily: 'var(--ff-ui)',
                fontWeight: 800,
                fontSize: '1.05rem',
                letterSpacing: '0.18em',
                color: 'var(--cyan)',
                textTransform: 'uppercase',
              }}>
                FaceGuard
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' }}>
              <NavLink to="/"       end className={navCls}>Live Feed</NavLink>
              <NavLink to="/people"     className={navCls}>People</NavLink>
              <NavLink to="/enroll"     className={navCls}>Enroll</NavLink>
            </div>
          </div>

          {/* Status + Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: statusColor,
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--ff-data)',
                fontSize: '0.6rem',
                letterSpacing: '0.12em',
                color: statusColor,
              }}>
                {statusLabel}
              </span>
            </div>

            <button
              onClick={handleReload}
              disabled={reloading}
              className="btn-cyber btn-cyber-ghost"
              style={{ padding: '6px 12px' }}
              title="Reload face encodings from Firebase"
            >
              <ReloadIcon />
              <span className="hidden sm:inline">{reloading ? 'Reloading…' : 'Reload'}</span>
            </button>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 20px' }}>
        {children}
      </main>
    </div>
  )
}
