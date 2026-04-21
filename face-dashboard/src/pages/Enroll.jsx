import { useEffect, useRef, useState } from 'react'
import { BACKEND_URL } from '../utils'
import { useToast } from '../context/ToastContext'

export default function Enroll() {
  const [files, setFiles] = useState([])
  const [name, setName] = useState('')
  const [existingUsers, setExistingUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [useExisting, setUseExisting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState(null)
  const [done, setDone] = useState(false)
  const inputRef = useRef(null)
  const toast = useToast()

  useEffect(() => {
    fetch(`${BACKEND_URL}/users`)
      .then(r => r.json())
      .then(data => setExistingUsers(Array.isArray(data) ? data : data.users ?? []))
      .catch(() => {})
  }, [])

  const addFiles = (incoming) => {
    const imgs = incoming.filter(f => f.type.startsWith('image/'))
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...imgs.filter(f => !existing.has(f.name + f.size))]
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const removeFile = (index) => setFiles(prev => prev.filter((_, i) => i !== index))

  const handleSubmit = async () => {
    const effectiveName = useExisting
      ? existingUsers.find(u => u.id === selectedUserId || u.user_id === selectedUserId)?.name ?? ''
      : name.trim()

    if (!effectiveName && !selectedUserId) { toast('Enter a name or select an existing person', 'error'); return }
    if (!files.length) { toast('Add at least one photo', 'error'); return }

    const total = files.length
    const results = []
    setProgress({ current: 0, total, results: [] })
    setDone(false)

    let userId = useExisting ? (selectedUserId || null) : null

    for (let i = 0; i < files.length; i++) {
      const form = new FormData()
      form.append('name', effectiveName)
      if (userId) form.append('user_id', userId)
      form.append('image', files[i])

      try {
        const res = await fetch(`${BACKEND_URL}/enroll`, { method: 'POST', body: form })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          if (data.user_id && !userId) userId = data.user_id
          results.push({ file: files[i].name, ok: true })
        } else {
          results.push({ file: files[i].name, ok: false, err: data.detail ?? 'Failed' })
        }
      } catch {
        results.push({ file: files[i].name, ok: false, err: 'Network error' })
      }

      setProgress({ current: i + 1, total, results: [...results] })
    }

    setDone(true)
    const ok = results.filter(r => r.ok).length
    if (ok === total) toast(`Enrolled ${total} photo(s) successfully`, 'success')
    else              toast(`${ok}/${total} photos uploaded`, ok > 0 ? 'info' : 'error')
  }

  const handleReset = () => {
    setFiles([])
    setName('')
    setSelectedUserId('')
    setUseExisting(false)
    setProgress(null)
    setDone(false)
  }

  const progressPct = progress ? (progress.current / progress.total) * 100 : 0

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <p className="section-label" style={{ marginBottom: 6 }}>// BIOMETRIC_ENROLLMENT</p>
        <h1 style={{
          fontFamily: 'var(--ff-ui)',
          fontWeight: 800,
          fontSize: '1.4rem',
          letterSpacing: '0.05em',
          color: 'var(--t1)',
          margin: 0,
        }}>
          Enroll New Subject
        </h1>
        <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.65rem', color: 'var(--t3)', marginTop: 6, letterSpacing: '0.06em' }}>
          Upload face photos to register a subject in the recognition system
        </p>
      </div>

      {/* Tips */}
      <div className="tips-panel stagger-1">
        <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--cyan)', marginBottom: 10 }}>
          Optimal Capture Guidelines
        </p>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: 0, padding: 0, listStyle: 'none' }}>
          {[
            'Upload 5–10 photos per subject for best accuracy',
            'Vary angles, lighting conditions, and expressions',
            'Ensure the face is clearly visible and unobstructed',
            'Avoid extreme filters, heavy makeup, or occlusion',
          ].map((tip, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: 'var(--cyan)', fontFamily: 'var(--ff-data)', fontSize: '0.6rem', marginTop: 1 }}>›</span>
              <span style={{ fontFamily: 'var(--ff-data)', fontSize: '0.65rem', color: 'var(--t2)', letterSpacing: '0.04em' }}>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {done ? (
        /* Results */
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card-cyber" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.6rem', letterSpacing: '0.15em', color: 'var(--cyan)', textTransform: 'uppercase' }}>
              Enrollment Complete
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {progress?.results.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 4,
                    border: `1px solid ${r.ok ? 'var(--green-border)' : 'var(--red-border)'}`,
                    background: r.ok ? 'var(--green-08)' : 'var(--red-08)',
                  }}
                >
                  <span style={{
                    fontFamily: 'var(--ff-data)',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: r.ok ? 'var(--green)' : 'var(--red)',
                    flexShrink: 0,
                  }}>
                    {r.ok ? 'OK' : 'ERR'}
                  </span>
                  <span style={{ fontFamily: 'var(--ff-data)', fontSize: '0.62rem', color: 'var(--t2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.file}
                  </span>
                  {!r.ok && (
                    <span style={{ fontFamily: 'var(--ff-data)', fontSize: '0.6rem', color: 'var(--red)', flexShrink: 0 }}>
                      {r.err}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={handleReset}
            className="btn-cyber btn-cyber-primary"
            style={{ padding: '12px', fontSize: '0.75rem', width: '100%' }}
          >
            + Enroll Another Subject
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Drop zone */}
          <div
            className={`dropzone-cyber${dragOver ? ' drag-over' : ''} stagger-2`}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: `1px solid ${dragOver ? 'var(--cyan)' : 'var(--cyan-border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: dragOver ? 'var(--cyan)' : 'var(--t3)',
              transition: 'all 0.2s',
              boxShadow: dragOver ? 'var(--cyan-glow-sm)' : 'none',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--t1)', margin: '0 0 4px', letterSpacing: '0.03em' }}>
                Drop photos here or click to browse
              </p>
              <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.6rem', color: 'var(--t4)', letterSpacing: '0.06em' }}>
                JPG · PNG · WEBP — multiple files supported
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { addFiles(Array.from(e.target.files)); e.target.value = '' }}
            />
          </div>

          {/* Thumbnails */}
          {files.length > 0 && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--ff-data)', fontSize: '0.62rem', color: 'var(--t3)', letterSpacing: '0.08em' }}>
                  {files.length} photo(s) staged
                </span>
                <button
                  onClick={() => setFiles([])}
                  className="btn-cyber btn-cyber-ghost"
                  style={{ padding: '3px 10px', fontSize: '0.6rem' }}
                >
                  Clear All
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 8 }}>
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="face-thumb"
                    style={{ aspectRatio: '1', cursor: 'pointer' }}
                    onClick={() => removeFile(i)}
                  >
                    <img
                      src={URL.createObjectURL(f)}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <div className="delete-overlay">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Person selection */}
          <div className="card-cyber stagger-3" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['New subject', 'Existing subject'].map((label, i) => (
                <button
                  key={label}
                  onClick={() => setUseExisting(i === 1)}
                  className={`btn-cyber ${(i === 1) === useExisting ? 'btn-cyber-primary' : 'btn-cyber-ghost'}`}
                  style={{ padding: '6px 14px', fontSize: '0.68rem' }}
                >
                  {label}
                </button>
              ))}
            </div>

            {!useExisting ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontFamily: 'var(--ff-data)', fontSize: '0.6rem', color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Sarah Chen"
                  className="input-cyber"
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontFamily: 'var(--ff-data)', fontSize: '0.6rem', color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Select Subject
                </label>
                {existingUsers.length === 0 ? (
                  <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.63rem', color: 'var(--t4)' }}>
                    No enrolled subjects found — create a new one
                  </p>
                ) : (
                  <select
                    value={selectedUserId}
                    onChange={e => setSelectedUserId(e.target.value)}
                    className="input-cyber"
                    style={{ fontFamily: 'var(--ff-ui)' }}
                  >
                    <option value="">— Select a subject —</option>
                    {existingUsers.map(u => (
                      <option key={u.id ?? u.user_id} value={u.id ?? u.user_id}>{u.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Progress */}
          {progress && !done && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--ff-data)', fontSize: '0.6rem', color: 'var(--t3)', letterSpacing: '0.1em' }}>
                  UPLOADING
                </span>
                <span style={{ fontFamily: 'var(--ff-data)', fontSize: '0.65rem', color: 'var(--cyan)', fontWeight: 700 }}>
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!!progress && !done}
            className="btn-cyber btn-cyber-primary stagger-4"
            style={{ padding: '14px', fontSize: '0.75rem', width: '100%', borderRadius: 6 }}
          >
            {progress && !done
              ? `Processing ${progress.current}/${progress.total}…`
              : `Enroll${files.length > 0 ? ` ${files.length} Photo${files.length !== 1 ? 's' : ''}` : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
