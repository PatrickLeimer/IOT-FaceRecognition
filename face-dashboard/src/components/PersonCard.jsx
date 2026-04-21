import { useEffect, useState, useRef } from 'react'
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { BACKEND_URL, resolveImageUrl } from '../utils'
import { useToast } from '../context/ToastContext'

export default function PersonCard({ person, onFaceDeleted, onRenamed, onAddPhotos, selectedForMerge, onToggleMerge }) {
  const [faces, setFaces] = useState([])
  const [loadingFaces, setLoadingFaces] = useState(true)
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(person.name)
  const nameRef = useRef(null)
  const toast = useToast()

  useEffect(() => { loadFaces() }, [person.id]) // eslint-disable-line

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

  const handleAddPhotos = (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'))
    if (files.length) onAddPhotos?.(person, files)
    e.target.value = ''
  }

  const initials = person.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '??'

  return (
    <div
      className={`card-cyber${selectedForMerge ? ' card-cyber-selected' : ''}`}
      style={{ overflow: 'hidden', transition: 'all 0.2s' }}
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
            width: 18,
            height: 18,
            borderRadius: 3,
            border: `1.5px solid ${selectedForMerge ? 'var(--cyan)' : 'rgba(176,215,232,0.2)'}`,
            background: selectedForMerge ? 'var(--cyan)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'all 0.15s',
            boxShadow: selectedForMerge ? 'var(--cyan-glow-sm)' : 'none',
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
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--bg-3), var(--bg-4))',
          border: '1px solid var(--cyan-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          fontFamily: 'var(--ff-data)',
          fontSize: '0.65rem',
          fontWeight: 700,
          color: 'var(--cyan)',
          letterSpacing: '0.05em',
        }}>
          {initials}
        </div>

        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
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
                background: 'none',
                border: 'none',
                padding: 0,
                fontFamily: 'var(--ff-ui)',
                fontWeight: 700,
                fontSize: '0.82rem',
                color: 'var(--t1)',
                cursor: 'pointer',
                letterSpacing: '0.02em',
                textAlign: 'left',
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--cyan)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--t1)'}
              title="Click to rename"
            >
              {person.name}
            </button>
          )}
        </div>

        {/* Face count */}
        <span style={{
          fontFamily: 'var(--ff-data)',
          fontSize: '0.6rem',
          color: 'var(--cyan)',
          background: 'var(--cyan-10)',
          border: '1px solid var(--cyan-border)',
          padding: '2px 7px',
          borderRadius: 3,
          flexShrink: 0,
          letterSpacing: '0.06em',
        }}>
          {faces.length}
        </span>
      </div>

      {/* Face grid */}
      <div style={{ padding: '10px' }}>
        {loadingFaces ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{
                aspectRatio: '1',
                background: 'var(--bg-1)',
                borderRadius: 4,
                animation: 'shimmerSlide 1.5s linear infinite',
              }} />
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
                <div
                  className="delete-overlay"
                  onClick={() => handleDeleteFace(face.id)}
                  title="Remove face"
                >
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
        <label
          className="btn-cyber btn-cyber-ghost"
          style={{ width: '100%', padding: '7px', cursor: 'pointer' }}
        >
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
