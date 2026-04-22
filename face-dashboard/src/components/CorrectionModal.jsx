import { useEffect, useState } from 'react'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { BACKEND_URL, apiFetch, resolveImageUrl } from '../utils'
import { useToast } from '../context/ToastContext'

export default function CorrectionModal({ isOpen, onClose, event, mode = 'correct', onSuccess }) {
  const [tab, setTab] = useState(mode === 'enroll' ? 'new' : 'existing')
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!isOpen) return
    setTab(mode === 'enroll' ? 'new' : 'existing')
    setSelectedUserId('')
    setNewName('')
    getDocs(collection(db, 'users')).then(snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [isOpen, mode])

  if (!isOpen || !event) return null

  const handleSubmit = async () => {
    if (tab === 'existing' && !selectedUserId) { toast('Select a subject', 'error'); return }
    if (tab === 'new' && !newName.trim()) { toast('Enter a name', 'error'); return }

    setLoading(true)
    try {
      if (tab === 'existing') {
        const user = users.find(u => u.id === selectedUserId)
        const form = new FormData()
        form.append('correct_user_id', selectedUserId)
        form.append('correct_name', user?.name ?? '')
        await apiFetch(`${BACKEND_URL}/correct/${event.id}`, { method: 'POST', body: form })

        // Update Firestore event
        await updateDoc(doc(db, 'events', event.id), {
          status: 'corrected',
          correctedName: user?.name ?? '',
          correctedUserId: selectedUserId,
          reviewed: true,
        })
        toast('Correction saved', 'success')
      } else {
        const name = newName.trim()
        const form = new FormData()
        form.append('name', name)
        const enrollRes = await apiFetch(`${BACKEND_URL}/enroll-from-event/${event.id}`, {
          method: 'POST',
          body: form,
        })
        if (!enrollRes.ok) {
          const err = await enrollRes.json().catch(() => ({}))
          throw new Error(err.detail ?? 'Enrollment failed')
        }
        const enrollData = await enrollRes.json()
        const enrolledUserId = enrollData.user_id ?? ''
        await updateDoc(doc(db, 'events', event.id), {
          status: 'corrected',
          correctedName: name,
          correctedUserId: enrolledUserId,
          reviewed: true,
        })
        toast(`Enrolled "${name}" successfully`, 'success')
      }
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
      toast('Something went wrong — check the console', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(2, 5, 7, 0.85)',
        }}
        onClick={onClose}
      />

      <div
        className="modal-cyber"
        style={{ position: 'relative', width: '100%', maxWidth: 440 }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--cyan-border)',
        }}>
          <div>
            <p className="section-label" style={{ marginBottom: 4 }}>
              {mode === 'enroll' ? '// ENROLL_SUBJECT' : '// CORRECT_ID'}
            </p>
            <h2 style={{
              fontFamily: 'var(--ff-ui)',
              fontWeight: 700,
              fontSize: '0.95rem',
              letterSpacing: '0.04em',
              color: 'var(--t1)',
              margin: 0,
            }}>
              {mode === 'enroll' ? 'Who is this person?' : 'Correct identification'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--cyan-border)',
              borderRadius: 4,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--t3)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--cyan-border)'; e.currentTarget.style.color = 'var(--t3)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Event preview */}
        {event.imageUrl && (
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ display: 'inline-block', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--cyan-border)' }}>
              <img
                src={resolveImageUrl(event.imageUrl)}
                alt="Event"
                style={{ width: 80, height: 80, objectFit: 'cover', display: 'block' }}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px 0' }}>
          {['existing', 'new'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`btn-cyber ${tab === t ? 'btn-cyber-primary' : 'btn-cyber-ghost'}`}
              style={{ padding: '6px 14px', fontSize: '0.68rem' }}
            >
              {t === 'existing' ? 'Select person' : 'New person'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tab === 'existing' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontFamily: 'var(--ff-data)', fontSize: '0.6rem', color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Select correct subject
              </label>
              <div style={{
                maxHeight: 200,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                border: '1px solid var(--cyan-border)',
                borderRadius: 6,
                padding: 6,
                background: 'var(--bg-1)',
              }}>
                {users.length === 0 && (
                  <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.62rem', color: 'var(--t4)', textAlign: 'center', padding: '20px 0' }}>
                    No enrolled subjects
                  </p>
                )}
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`person-select-row${selectedUserId === user.id ? ' selected' : ''}`}
                  >
                    {user.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontFamily: 'var(--ff-data)', fontSize: '0.6rem', color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Subject name
              </label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="e.g. Sarah Chen"
                className="input-cyber"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '0 20px 20px' }}>
          <button
            onClick={onClose}
            className="btn-cyber btn-cyber-ghost"
            style={{ flex: 1, padding: '10px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-cyber btn-cyber-primary"
            style={{ flex: 1, padding: '10px' }}
          >
            {loading ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
