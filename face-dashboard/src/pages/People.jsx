import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, deleteDoc, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { BACKEND_URL } from '../utils'
import { useToast } from '../context/ToastContext'
import PersonCard from '../components/PersonCard'
import { RELATIONSHIP_GROUPS } from '../components/PersonCard'

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
)

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
  </svg>
)

const MergeIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6l4 4-4 4M16 6l-4 4 4 4"/>
  </svg>
)

export default function People() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mergeSelected, setMergeSelected] = useState([])
  const [merging, setMerging] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRelationship, setNewRelationship] = useState('')
  const [newFiles, setNewFiles] = useState([])
  const [adding, setAdding] = useState(false)
  const toast = useToast()

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase())
  )

  const toggleMerge = (id) => {
    setMergeSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]
    )
  }

  const handleMerge = async () => {
    if (mergeSelected.length !== 2) return
    const [sourceId, targetId] = mergeSelected
    const source = users.find(u => u.id === sourceId)
    const target = users.find(u => u.id === targetId)
    if (!confirm(`Merge "${source?.name}" into "${target?.name}"? This cannot be undone.`)) return

    setMerging(true)
    try {
      const facesSnap = await getDocs(collection(db, 'users', sourceId, 'faces'))
      await Promise.all(facesSnap.docs.map(faceDoc =>
        setDoc(doc(db, 'users', targetId, 'faces', faceDoc.id), faceDoc.data())
      ))
      await deleteDoc(doc(db, 'users', sourceId))
      setMergeSelected([])
      toast(`Merged "${source?.name}" into "${target?.name}"`, 'success')
    } catch {
      toast('Merge failed', 'error')
    } finally {
      setMerging(false)
    }
  }

  const handleAddPerson = async () => {
    if (!newName.trim()) { toast('Enter a name', 'error'); return }
    if (!newFiles.length) { toast('Select at least one photo', 'error'); return }
    setAdding(true)
    try {
      let userId = null
      for (let i = 0; i < newFiles.length; i++) {
        const form = new FormData()
        form.append('name', newName.trim())
        if (userId) form.append('user_id', userId)
        form.append('image', newFiles[i])
        const res = await fetch(`${BACKEND_URL}/enroll`, { method: 'POST', body: form })
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          if (data.user_id) userId = data.user_id
        }
      }
      // Save relationship if set
      if (newRelationship && userId) {
        await import('firebase/firestore').then(({ updateDoc, doc }) =>
          updateDoc(doc(db, 'users', userId), { relationship: newRelationship })
        ).catch(() => {})
      }
      toast(`Added "${newName.trim()}"${newRelationship ? ` (${newRelationship})` : ''} with ${newFiles.length} photo(s)`, 'success')
      setShowAddForm(false)
      setNewName('')
      setNewRelationship('')
      setNewFiles([])
    } catch {
      toast('Failed to add person', 'error')
    } finally {
      setAdding(false)
    }
  }

  const handleAddPhotos = async (person, files) => {
    try {
      for (const file of files) {
        const form = new FormData()
        form.append('name', person.name)
        form.append('user_id', person.id)
        form.append('image', file)
        await fetch(`${BACKEND_URL}/enroll`, { method: 'POST', body: form })
      }
      toast(`Added ${files.length} photo(s) to ${person.name}`, 'success')
    } catch {
      toast('Failed to upload photos', 'error')
    }
  }

  const handleRenamed = (id, newName) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, name: newName } : u))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div>
          <p className="section-label" style={{ marginBottom: 6 }}>// SUBJECT_DATABASE</p>
          <h1 style={{
            fontFamily: 'var(--ff-ui)',
            fontWeight: 800,
            fontSize: '1.4rem',
            letterSpacing: '0.05em',
            color: 'var(--t1)',
            margin: 0,
          }}>
            Enrolled Subjects
          </h1>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-cyber btn-cyber-primary"
          style={{ padding: '9px 16px', fontSize: '0.72rem' }}
        >
          <PlusIcon />
          New Subject
        </button>
      </div>

      {/* Search + merge */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', pointerEvents: 'none' }}>
            <SearchIcon />
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search subjects…"
            className="input-cyber"
            style={{ paddingLeft: 32 }}
          />
        </div>

        {mergeSelected.length === 2 && (
          <button
            onClick={handleMerge}
            disabled={merging}
            className="btn-cyber btn-cyber-amber"
            style={{ padding: '9px 14px', fontSize: '0.7rem' }}
          >
            <MergeIcon />
            {merging ? 'Merging…' : `Merge: ${users.find(u => u.id === mergeSelected[0])?.name} → ${users.find(u => u.id === mergeSelected[1])?.name}`}
          </button>
        )}
        {mergeSelected.length > 0 && !merging && (
          <button
            onClick={() => setMergeSelected([])}
            className="btn-cyber btn-cyber-ghost"
            style={{ padding: '9px 12px' }}
          >
            Cancel
          </button>
        )}
      </div>

      {mergeSelected.length === 1 && (
        <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.65rem', color: 'var(--t3)', letterSpacing: '0.06em', marginTop: -14 }}>
          Select one more subject to merge with <span style={{ color: 'var(--cyan)' }}>{users.find(u => u.id === mergeSelected[0])?.name}</span>
        </p>
      )}

      {/* Add person form */}
      {showAddForm && (
        <div
          className="card-cyber fade-in"
          style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p className="section-label">// NEW_SUBJECT</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Subject name"
              className="input-cyber"
            />

            {/* Relationship picker inline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontFamily: 'var(--ff-data)', fontSize: '0.58rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--t3)' }}>
                Relationship <span style={{ color: 'var(--t4)' }}>(optional)</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {RELATIONSHIP_GROUPS.map(group => (
                  <div key={group.label}>
                    <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.54rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: group.color, marginBottom: 5, opacity: 0.7 }}>
                      {group.label}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {group.options.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setNewRelationship(newRelationship === opt ? '' : opt)}
                          style={{
                            fontFamily: 'var(--ff-ui)',
                            fontSize: '0.68rem',
                            padding: '4px 9px',
                            borderRadius: 3,
                            border: `1px solid ${newRelationship === opt ? group.color : group.border}`,
                            background: newRelationship === opt ? group.bg : 'transparent',
                            color: newRelationship === opt ? group.color : 'var(--t2)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            boxShadow: newRelationship === opt ? `0 0 8px ${group.color}40` : 'none',
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {/* Custom field */}
                {!RELATIONSHIP_GROUPS.flatMap(g => g.options).includes(newRelationship) && newRelationship && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '3px 8px', borderRadius: 3,
                    border: '1px solid rgba(167,139,250,0.3)',
                    background: 'rgba(167,139,250,0.08)',
                    color: '#A78BFA',
                    fontFamily: 'var(--ff-data)', fontSize: '0.65rem',
                  }}>
                    {newRelationship}
                    <button onClick={() => setNewRelationship('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Or type a custom relationship…"
                    className="input-cyber"
                    style={{ flex: 1, fontSize: '0.72rem', padding: '5px 9px' }}
                    onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { setNewRelationship(e.currentTarget.value.trim()); e.currentTarget.value = '' } }}
                  />
                </div>
              </div>
            </div>

            <label
              className="dropzone-cyber"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px', textAlign: 'center', cursor: 'pointer' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" style={{ color: 'var(--t3)' }}>
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
              </svg>
              <span style={{ fontFamily: 'var(--ff-data)', fontSize: '0.65rem', color: 'var(--t3)', letterSpacing: '0.08em' }}>
                {newFiles.length > 0 ? `${newFiles.length} photo(s) staged` : 'Click to select photos'}
              </span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => setNewFiles(Array.from(e.target.files))} />
            </label>
            {newFiles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {newFiles.map((f, i) => (
                  <img
                    key={i}
                    src={URL.createObjectURL(f)}
                    alt=""
                    style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--cyan-border)' }}
                  />
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setShowAddForm(false); setNewName(''); setNewRelationship(''); setNewFiles([]) }}
              className="btn-cyber btn-cyber-ghost"
              style={{ flex: 1, padding: '9px' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddPerson}
              disabled={adding}
              className="btn-cyber btn-cyber-primary"
              style={{ flex: 1, padding: '9px' }}
            >
              {adding ? 'Uploading…' : 'Enroll Subject'}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card-cyber" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 10, background: 'var(--bg-3)', borderRadius: 3, width: '50%' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                {[...Array(4)].map((_, j) => (
                  <div key={j} style={{ aspectRatio: '1', background: 'var(--bg-1)', borderRadius: 4 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            border: '1px solid var(--cyan-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--t4)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div>
            <p style={{ fontWeight: 700, color: 'var(--t2)', letterSpacing: '0.05em', margin: '0 0 6px' }}>
              {search ? 'No matching subjects' : 'No subjects enrolled'}
            </p>
            {!search && (
              <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.63rem', color: 'var(--t4)', letterSpacing: '0.06em' }}>
                Add a subject to begin recognition
              </p>
            )}
          </div>
        </div>
      )}

      {/* Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((user, i) => (
            <div key={user.id} className={`stagger-${Math.min(i + 1, 6)}`}>
              <PersonCard
                person={user}
                selectedForMerge={mergeSelected.includes(user.id)}
                onToggleMerge={toggleMerge}
                onAddPhotos={handleAddPhotos}
                onRenamed={handleRenamed}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
