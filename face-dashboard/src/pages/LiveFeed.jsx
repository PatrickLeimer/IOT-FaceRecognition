import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, query, orderBy, limit, where, Timestamp, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { playNotificationSound } from '../utils'
import EventCard from '../components/EventCard'

function StatCard({ label, value, sub }) {
  return (
    <div
      className="card-cyber"
      style={{ flex: 1, minWidth: 0, padding: '18px 20px' }}
    >
      <p
        style={{
          fontFamily: 'var(--ff-data)',
          fontSize: '2rem',
          fontWeight: 800,
          color: 'var(--cyan)',
          margin: 0,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {value ?? '—'}
      </p>
      <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--t3)', marginTop: 8 }}>
        {label}
      </p>
      {sub && (
        <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.56rem', color: 'var(--t4)', marginTop: 4, letterSpacing: '0.04em' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="card-cyber" style={{ overflow: 'hidden' }}>
      <div style={{ aspectRatio: '1', background: 'var(--bg-1)' }} />
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
        <StatCard label="Enrolled Subjects" value={stats.people} />
        <StatCard label="Events Today" value={stats.today} />
        <StatCard
          label="Recognition Rate"
          value={stats.accuracy != null ? `${stats.accuracy}%` : '—'}
          sub={stats.accuracy != null ? 'recognized + corrected / total' : 'no events today'}
        />
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
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

        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div className="live-dot" />
              <span style={{
                fontFamily: 'var(--ff-data)',
                fontSize: '0.6rem',
                fontWeight: 700,
                letterSpacing: '0.2em',
                color: 'var(--red)',
              }}>
                LIVE
              </span>
            </div>

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
          </div>
        )}
      </div>

      <div style={{ height: 1, background: 'var(--cyan-border)' }} />

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
          {events.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
