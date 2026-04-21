import { useEffect, useRef, useState, useMemo } from 'react'
import { collection, onSnapshot, query, orderBy, limit, where, Timestamp, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { playNotificationSound } from '../utils'
import EventCard from '../components/EventCard'

function useCountUp(target, duration = 1400) {
  const [display, setDisplay] = useState(null)

  useEffect(() => {
    if (target == null || target === '—') { setDisplay(target ?? '—'); return }
    const str = String(target)
    const match = str.match(/^(\d+)(.*)$/)
    if (!match) { setDisplay(target); return }

    const end = parseInt(match[1], 10)
    const suffix = match[2] || ''
    if (isNaN(end)) { setDisplay(target); return }

    let startTime = null
    let raf
    const animate = (ts) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(`${Math.round(end * eased)}${suffix}`)
      if (progress < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return display ?? target
}

function StatCard({ label, value, sub, index = 0 }) {
  const animated = useCountUp(value)
  return (
    <div
      className={`card-cyber stat-card-holo stagger-${index + 1}`}
      style={{ flex: 1, minWidth: 0, padding: '18px 20px', position: 'relative' }}
    >
      <p
        className="stat-value"
        style={{
          fontSize: '2rem',
          fontWeight: 800,
          color: 'var(--cyan)',
          textShadow: '0 0 20px rgba(0,229,255,0.5)',
          margin: 0,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {animated}
      </p>
      <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--t3)', marginTop: 8 }}>
        {label}
      </p>
      {sub && (
        <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.56rem', color: 'var(--t4)', marginTop: 4, letterSpacing: '0.04em' }}>
          {sub}
        </p>
      )}
      {/* Bottom accent line */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, transparent, var(--cyan-20), var(--cyan-50), var(--cyan-20), transparent)',
        borderRadius: '0 0 8px 8px',
      }} />
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="card-cyber" style={{ overflow: 'hidden' }}>
      <div style={{ aspectRatio: '1', background: 'var(--bg-1)', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.04) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmerSlide 1.5s linear infinite',
        }} />
      </div>
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 10, background: 'var(--bg-3)', borderRadius: 3, width: '60%' }} />
        <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, width: '100%' }} />
        <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, width: '80%' }} />
      </div>
    </div>
  )
}

export default function LiveFeed() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [newIds, setNewIds] = useState(new Set())
  const [stats, setStats] = useState({ people: 0, today: 0, accuracy: null })
  const knownIds = useRef(null)

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('timestamp', 'desc'), limit(50))
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      if (knownIds.current === null) {
        knownIds.current = new Set(docs.map(d => d.id))
      } else {
        const fresh = docs.filter(d => !knownIds.current.has(d.id))
        if (fresh.length > 0) {
          playNotificationSound()
          const freshSet = new Set(fresh.map(d => d.id))
          setNewIds(prev => new Set([...prev, ...freshSet]))
          setTimeout(() => setNewIds(prev => {
            const next = new Set(prev)
            freshSet.forEach(id => next.delete(id))
            return next
          }), 3000)
          fresh.forEach(d => knownIds.current.add(d.id))
        }
      }

      setEvents(docs)
      setLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [usersSnap, todaySnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(query(
            collection(db, 'events'),
            where('timestamp', '>=', Timestamp.fromDate(new Date(new Date().setHours(0, 0, 0, 0))))
          )),
        ])
        const todayDocs = todaySnap.docs.map(d => d.data())
        const recognized = todayDocs.filter(e => e.status === 'recognized' || e.status === 'corrected').length
        const accuracy = todayDocs.length > 0 ? Math.round((recognized / todayDocs.length) * 100) : null
        setStats({ people: usersSnap.size, today: todayDocs.length, accuracy })
      } catch { /* ignore */ }
    }
    loadStats()
    const id = setInterval(loadStats, 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard label="Enrolled Subjects" value={stats.people} index={0} />
        <StatCard label="Events Today" value={stats.today} index={1} />
        <StatCard
          label="Recognition Rate"
          value={stats.accuracy != null ? `${stats.accuracy}%` : '—'}
          sub={stats.accuracy != null ? 'recognized + corrected / total' : 'no events today'}
          index={2}
        />
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Radar decoration */}
          <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
            {[0, 0.6, 1.2].map((delay, i) => (
              <div
                key={i}
                className="radar-ring"
                style={{
                  inset: 0,
                  animationDelay: `${delay}s`,
                  animationDuration: '3s',
                }}
              />
            ))}
            {/* Center dot */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)', boxShadow: 'var(--cyan-glow-sm)' }} />
            </div>
            {/* Rotating sweep line */}
            <svg
              viewBox="0 0 48 48"
              style={{
                position: 'absolute', inset: 0,
                animation: 'radarRotate 4s linear infinite',
                width: '100%', height: '100%',
              }}
            >
              <defs>
                <radialGradient id="sweep" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(0,229,255,0.6)" />
                  <stop offset="100%" stopColor="rgba(0,229,255,0)" />
                </radialGradient>
              </defs>
              <path d="M24 24 L24 4 A20 20 0 0 1 44 24 Z" fill="url(#sweep)" opacity="0.5" />
            </svg>
          </div>

          <div>
            <p className="section-label" style={{ marginBottom: 5 }}>// BIOMETRIC_FEED</p>
            <h1 style={{
              fontFamily: 'var(--ff-ui)',
              fontWeight: 800,
              fontSize: '1.4rem',
              letterSpacing: '0.05em',
              color: 'var(--t1)',
              margin: 0,
            }}>
              Live Recognition Feed
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* LIVE indicator */}
          {!loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div className="live-dot" />
              <span style={{
                fontFamily: 'var(--ff-data)',
                fontSize: '0.6rem',
                fontWeight: 700,
                letterSpacing: '0.2em',
                color: 'var(--red)',
                textShadow: '0 0 8px rgba(255,45,85,0.5)',
                animation: 'neonBlink 2.5s ease-in-out infinite',
              }}>
                LIVE
              </span>
            </div>
          )}

          {!loading && (
            <div style={{
              fontFamily: 'var(--ff-data)',
              fontSize: '0.62rem',
              color: 'var(--t3)',
              letterSpacing: '0.1em',
              padding: '4px 10px',
              border: '1px solid var(--cyan-border)',
              borderRadius: 3,
            }}>
              {events.length} / 50
            </div>
          )}
        </div>
      </div>

      {/* Animated data divider */}
      <div className="data-line" style={{ height: 1, borderRadius: 1 }} />

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: '1px solid var(--cyan-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--t4)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div>
            <p style={{ fontWeight: 700, color: 'var(--t2)', letterSpacing: '0.05em', margin: '0 0 6px' }}>
              No events detected
            </p>
            <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.65rem', color: 'var(--t4)', letterSpacing: '0.06em' }}>
              Awaiting signal from ESP32-CAM
            </p>
          </div>
        </div>
      )}

      {/* Event grid */}
      {!loading && events.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {events.map((event, i) => (
            <div
              key={event.id}
              className={`stagger-${Math.min(i + 1, 6)}`}
              style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
            >
              <EventCard event={event} isNew={newIds.has(event.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
