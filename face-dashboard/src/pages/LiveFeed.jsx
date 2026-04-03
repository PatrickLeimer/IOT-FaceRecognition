import { useEffect, useRef, useState } from 'react'
import { BACKEND_URL, playNotificationSound } from '../utils'
import EventCard from '../components/EventCard'

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex-1 min-w-0">
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function LiveFeed() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [newIds, setNewIds] = useState(new Set())
  const [stats, setStats] = useState({ people: 0, today: 0, accuracy: null })
  const knownIds = useRef(null) // null = initial load not done

  useEffect(() => {
    let cancelled = false

    const loadDashboard = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/dashboard`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return

        const docs = Array.isArray(data.events) ? data.events : []

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

        if (!cancelled) {
          setEvents(docs)
          setStats(data.stats ?? { people: 0, today: 0, accuracy: null })
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    loadDashboard()
    const id = setInterval(loadDashboard, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex gap-3 flex-wrap">
        <StatCard label="People enrolled" value={stats.people} />
        <StatCard label="Events today" value={stats.today} />
        <StatCard
          label="Recognition accuracy"
          value={stats.accuracy != null ? `${stats.accuracy}%` : '—'}
          sub={stats.accuracy != null ? 'recognized + corrected / total' : 'No events today'}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Live Feed</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time face recognition events</p>
        </div>
        {!loading && (
          <span className="text-xs text-slate-500">{events.length} events</span>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-slate-700" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-slate-700 rounded w-3/4" />
                <div className="h-2 bg-slate-700 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-center py-24 space-y-3">
          <svg className="w-16 h-16 text-slate-700 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M4 8h11a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2V10a2 2 0 012-2z" />
          </svg>
          <p className="text-slate-400 font-medium">No events yet</p>
          <p className="text-slate-600 text-sm">Events will appear here when the ESP32-CAM sends images</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {events.map(event => (
            <EventCard key={event.id} event={event} isNew={newIds.has(event.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
