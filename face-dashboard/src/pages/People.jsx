import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, deleteDoc, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { BACKEND_URL } from '../utils'
import { useToast } from '../context/ToastContext'
import PersonCard from '../components/PersonCard'

export default function People() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mergeSelected, setMergeSelected] = useState([]) // up to 2 IDs
  const [merging, setMerging] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
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
      // Copy all faces from source to target
      const facesSnap = await getDocs(collection(db, 'users', sourceId, 'faces'))
      await Promise.all(facesSnap.docs.map(faceDoc =>
        setDoc(doc(db, 'users', targetId, 'faces', faceDoc.id), faceDoc.data())
      ))
      // Delete source user document
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
      toast(`Added "${newName.trim()}" with ${newFiles.length} photo(s)`, 'success')
      setShowAddForm(false)
      setNewName('')
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">People</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage enrolled users and their face photos</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm font-medium text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Person
        </button>
      </div>

      {/* Search + merge bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search people…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {mergeSelected.length === 2 && (
          <button
            onClick={handleMerge}
            disabled={merging}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
          >
            {merging ? 'Merging…' : `Merge: ${users.find(u => u.id === mergeSelected[0])?.name} → ${users.find(u => u.id === mergeSelected[1])?.name}`}
          </button>
        )}
        {mergeSelected.length > 0 && !merging && (
          <button onClick={() => setMergeSelected([])} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            Cancel
          </button>
        )}
      </div>

      {mergeSelected.length === 1 && (
        <p className="text-sm text-slate-500">Select one more person to merge with <span className="text-slate-300">{users.find(u => u.id === mergeSelected[0])?.name}</span></p>
      )}

      {/* Add person form */}
      {showAddForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4 fade-in">
          <h2 className="text-sm font-semibold text-slate-100">New Person</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Full name"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-lg p-6 cursor-pointer hover:border-slate-500 transition-colors">
              <svg className="w-8 h-8 text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-slate-400">
                {newFiles.length > 0 ? `${newFiles.length} photo(s) selected` : 'Click to select photos'}
              </span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => setNewFiles(Array.from(e.target.files))} />
            </label>
            {newFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {newFiles.map((f, i) => (
                  <img key={i} src={URL.createObjectURL(f)} alt="" className="w-12 h-12 rounded object-cover border border-slate-700" />
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowAddForm(false); setNewName(''); setNewFiles([]) }} className="flex-1 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors">
              Cancel
            </button>
            <button onClick={handleAddPerson} disabled={adding} className="flex-1 py-2 text-sm bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg text-white font-medium transition-colors">
              {adding ? 'Uploading…' : 'Add Person'}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-1/2 mb-3" />
              <div className="grid grid-cols-4 gap-1.5">
                {[...Array(4)].map((_, j) => <div key={j} className="aspect-square bg-slate-700 rounded-md" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-24 space-y-3">
          <svg className="w-16 h-16 text-slate-700 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-slate-400 font-medium">{search ? 'No results' : 'No people enrolled yet'}</p>
          {!search && <p className="text-slate-600 text-sm">Click "Add Person" to enroll someone</p>}
        </div>
      )}

      {/* People grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(user => (
            <PersonCard
              key={user.id}
              person={user}
              selectedForMerge={mergeSelected.includes(user.id)}
              onToggleMerge={toggleMerge}
              onAddPhotos={handleAddPhotos}
              onRenamed={handleRenamed}
            />
          ))}
        </div>
      )}
    </div>
  )
}
