import { useEffect, useState, useRef } from 'react'
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { BACKEND_URL, resolveImageUrl } from '../utils'
import { useToast } from '../context/ToastContext'

// ─── Relationship system ────────────────────────────────────────────────────

export const RELATIONSHIP_GROUPS = [
  {
    label: 'Family',
    color: 'var(--amber)',
    bg: 'var(--amber-08)',
    border: 'var(--amber-border)',
    options: ['Mom', 'Dad', 'Sister', 'Brother', 'Grandma', 'Grandpa', 'Aunt', 'Uncle', 'Cousin', 'Child'],
  },
  {
    label: 'Social',
    color: 'var(--cyan)',
    bg: 'var(--cyan-10)',
    border: 'var(--cyan-border)',
    options: ['Friend', 'Best Friend', 'Roommate', 'Neighbor', 'Partner'],
  },
  {
    label: 'Work',
    color: 'var(--green)',
    bg: 'var(--green-08)',
    border: 'var(--green-border)',
    options: ['Colleague', 'Manager', 'Employee', 'Client', 'Mentor'],
  },
]

function getRelColor(relationship, users) {
  if (!relationship) return null
  for (const g of RELATIONSHIP_GROUPS) {
    if (g.options.includes(relationship)) return { color: g.color, bg: g.bg, border: g.border }
  }
  // Custom
  return { color: '#A78BFA', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)' }
}

function RelationshipPicker({ current, onSave, onClose }) {
  const [custom, setCustom] = useState('')
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleSelect = (val) => { onSave(val); onClose() }
  const handleCustomSubmit = () => {
    const v = custom.trim()
    if (v) { onSave(v); onClose() }
  }
  const handleClear = () => { onSave(''); onClose() }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        zIndex: 50,
        background: 'var(--bg-2)',
        border: '1px solid var(--cyan-border-h)',
        borderRadius: 8,
        boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
        width: 260,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid var(--cyan-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: 'var(--ff-data)', fontSize: '0.58rem', letterSpacing: '0.15em', color: 'var(--cyan-50)', textTransform: 'uppercase' }}>
          Set Relationship
        </span>
        {current && (
          <button
            onClick={handleClear}
            style={{ background: 'none', border: 'none', fontFamily: 'var(--ff-data)', fontSize: '0.58rem', color: 'var(--t3)', cursor: 'pointer', letterSpacing: '0.06em' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}
          >
            Clear
          </button>
        )}
      </div>

      {/* Groups */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {RELATIONSHIP_GROUPS.map(group => (
          <div key={group.label}>
            <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.55rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: group.color, marginBottom: 6, opacity: 0.8 }}>
              {group.label}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {group.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  style={{
                    fontFamily: 'var(--ff-ui)',
                    fontSize: '0.68rem',
                    padding: '4px 9px',
                    borderRadius: 3,
                    border: `1px solid ${current === opt ? group.color : group.border}`,
                    background: current === opt ? group.bg : 'transparent',
                    color: current === opt ? group.color : 'var(--t2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: 'none',
                  }}
                  onMouseEnter={e => { if (current !== opt) { e.currentTarget.style.borderColor = group.color; e.currentTarget.style.color = group.color } }}
                  onMouseLeave={e => { if (current !== opt) { e.currentTarget.style.borderColor = group.border; e.currentTarget.style.color = 'var(--t2)' } }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Custom input */}
        <div>
          <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.55rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#A78BFA', marginBottom: 6, opacity: 0.8 }}>
            Custom
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
              placeholder="e.g. Mentor, Coach…"
              className="input-cyber"
              style={{ flex: 1, fontSize: '0.72rem', padding: '5px 9px' }}
              autoFocus
            />
            <button
              onClick={handleCustomSubmit}
              className="btn-cyber btn-cyber-ghost"
              style={{ padding: '5px 10px', fontSize: '0.65rem', flexShrink: 0 }}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PersonCard ─────────────────────────────────────────────────────────────

export default function PersonCard({ person, onFaceDeleted, onRenamed, onAddPhotos, selectedForMerge, onToggleMerge }) {
  const [faces, setFaces] = useState([])
  const [loadingFaces, setLoadingFaces] = useState(true)
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(person.name)
  const [relationship, setRelationship] = useState(person.relationship || '')
  const [showRelPicker, setShowRelPicker] = useState(false)
  const nameRef = useRef(null)
  const toast = useToast()

  useEffect(() => { loadFaces() }, [person.id]) // eslint-disable-line
  useEffect(() => { setRelationship(person.relationship || '') }, [person.relationship])

  const loadFaces = async () => {
    setLoadingFaces(true)
    try {
      const snap = await getDocs(collection(db, 'users', person.id, 'faces'))
      setFaces(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch { /* ignore */ }
    finally { setLoadingFaces(false) }
  }

  const handleDeleteFace = async (faceId) => {
    if (!confirm('Remove this face photo?')) return
    try {
      await deleteDoc(doc(db, 'users', person.id, 'faces', faceId))
      setFaces(prev => prev.filter(f => f.id !== faceId))
      toast('Face removed', 'success')
      onFaceDeleted?.(person.id, faceId)
    } catch {
      toast('Failed to delete face', 'error')
    }
  }

  const handleRename = async () => {
    const newName = nameVal.trim()
    if (!newName || newName === person.name) { setEditing(false); setNameVal(person.name); return }
    try {
      await updateDoc(doc(db, 'users', person.id), { name: newName })
      toast(`Renamed to "${newName}"`, 'success')
      onRenamed?.(person.id, newName)
    } catch {
      toast('Failed to rename', 'error')
      setNameVal(person.name)
    }
    setEditing(false)
  }

  const handleSaveRelationship = async (val) => {
    setRelationship(val)
    try {
      await updateDoc(doc(db, 'users', person.id), { relationship: val })
      if (val) toast(`Relationship set to "${val}"`, 'success')
      else toast('Relationship cleared', 'info')
    } catch {
      toast('Failed to save relationship', 'error')
      setRelationship(person.relationship || '')
    }
  }

  const handleAddPhotos = (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'))
    if (files.length) onAddPhotos?.(person, files)
    e.target.value = ''
  }

  const initials = person.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '??'
  const relStyle = getRelColor(relationship)

  return (
    <div
      className={`card-cyber${selectedForMerge ? ' card-cyber-selected' : ''}`}
    >
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid var(--cyan-border)',
        background: selectedForMerge ? 'rgba(0,229,255,0.04)' : 'transparent',
      }}>
        {/* Merge toggle */}
        <button
          onClick={() => onToggleMerge?.(person.id)}
          style={{
            width: 18, height: 18,
            borderRadius: 3,
            border: `1.5px solid ${selectedForMerge ? 'var(--cyan)' : 'rgba(176,215,232,0.2)'}`,
            background: selectedForMerge ? 'var(--cyan)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s',
            boxShadow: 'none',
          }}
          title="Select for merge"
        >
          {selectedForMerge && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          )}
        </button>

        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--bg-3)',
          border: `1px solid ${relStyle ? relStyle.border : 'var(--cyan-border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          fontFamily: 'var(--ff-data)', fontSize: '0.65rem', fontWeight: 700,
          color: relStyle ? relStyle.color : 'var(--cyan)',
          letterSpacing: '0.05em',
          transition: 'border-color 0.2s',
        }}>
          {initials}
        </div>

        {/* Name + relationship */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {editing ? (
            <input
              ref={nameRef}
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={handleRename}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') { setEditing(false); setNameVal(person.name) }
              }}
              className="input-cyber"
              style={{ padding: '3px 8px', fontSize: '0.8rem', fontWeight: 600 }}
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setEditing(true); setTimeout(() => nameRef.current?.select(), 50) }}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontFamily: 'var(--ff-ui)', fontWeight: 700, fontSize: '0.82rem',
                color: 'var(--t1)', cursor: 'pointer', letterSpacing: '0.02em',
                textAlign: 'left', width: '100%',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--cyan)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--t1)'}
              title="Click to rename"
            >
              {person.name}
            </button>
          )}

          {/* Relationship tag — always visible, click to edit */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowRelPicker(v => !v)}
              style={{
                background: relationship ? relStyle?.bg : 'transparent',
                border: `1px dashed ${relationship ? relStyle?.border : 'rgba(176,215,232,0.15)'}`,
                borderRadius: 3,
                padding: '2px 7px',
                fontFamily: 'var(--ff-data)',
                fontSize: '0.58rem',
                letterSpacing: '0.08em',
                color: relationship ? relStyle?.color : 'var(--t4)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                maxWidth: '100%',
              }}
              onMouseEnter={e => {
                if (!relationship) {
                  e.currentTarget.style.borderColor = 'var(--cyan-border)'
                  e.currentTarget.style.color = 'var(--t3)'
                }
              }}
              onMouseLeave={e => {
                if (!relationship) {
                  e.currentTarget.style.borderColor = 'rgba(176,215,232,0.15)'
                  e.currentTarget.style.color = 'var(--t4)'
                }
              }}
              title="Set relationship"
            >
              {relationship ? (
                <>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                  {relationship}
                </>
              ) : (
                <>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Add relationship
                </>
              )}
            </button>

            {showRelPicker && (
              <RelationshipPicker
                current={relationship}
                onSave={handleSaveRelationship}
                onClose={() => setShowRelPicker(false)}
              />
            )}
          </div>
        </div>

        {/* Face count */}
        <span style={{
          fontFamily: 'var(--ff-data)', fontSize: '0.6rem',
          color: 'var(--cyan)',
          background: 'var(--cyan-10)',
          border: '1px solid var(--cyan-border)',
          padding: '2px 7px', borderRadius: 3,
          flexShrink: 0, letterSpacing: '0.06em',
        }}>
          {faces.length}
        </span>
      </div>

      {/* Face grid */}
      <div style={{ padding: '10px', overflow: 'hidden' }}>
        {loadingFaces ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ aspectRatio: '1', background: 'var(--bg-1)', borderRadius: 4 }} />
            ))}
          </div>
        ) : faces.length === 0 ? (
          <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.6rem', color: 'var(--t4)', textAlign: 'center', padding: '16px 0', letterSpacing: '0.08em' }}>
            NO_FACE_DATA
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {faces.map(face => (
              <div key={face.id} className="face-thumb" style={{ aspectRatio: '1' }}>
                <img
                  src={resolveImageUrl(face.imageUrl)}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
                <div className="delete-overlay" onClick={() => handleDeleteFace(face.id)} title="Remove face">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add photos */}
      <div style={{ padding: '0 10px 10px' }}>
        <label className="btn-cyber btn-cyber-ghost" style={{ width: '100%', padding: '7px', cursor: 'pointer' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add Photos
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} />
        </label>
      </div>
    </div>
  )
}
