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

  useEffect(() => {
    loadFaces()
  }, [person.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className={`bg-slate-800 border rounded-xl overflow-hidden transition-all ${
      selectedForMerge ? 'border-teal-500 ring-2 ring-teal-500/30' : 'border-slate-700 hover:border-slate-600'
    }`}>
      {/* Card header */}
      <div className="p-4 flex items-center gap-3 border-b border-slate-700">
        {/* Merge checkbox */}
        <button
          onClick={() => onToggleMerge?.(person.id)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            selectedForMerge ? 'bg-teal-600 border-teal-600' : 'border-slate-600 hover:border-slate-400'
          }`}
          title="Select for merge"
        >
          {selectedForMerge && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Name — click to edit */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={nameRef}
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={handleRename}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setEditing(false); setNameVal(person.name) } }}
              className="w-full bg-slate-700 border border-teal-500 rounded px-2 py-0.5 text-sm text-slate-100 focus:outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setEditing(true); setTimeout(() => nameRef.current?.select(), 50) }}
              className="text-left text-sm font-semibold text-slate-100 hover:text-teal-400 transition-colors truncate w-full"
              title="Click to rename"
            >
              {person.name}
            </button>
          )}
        </div>

        {/* Face count badge */}
        <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full shrink-0">
          {faces.length} {faces.length === 1 ? 'face' : 'faces'}
        </span>
      </div>

      {/* Face thumbnails */}
      <div className="p-3">
        {loadingFaces ? (
          <div className="grid grid-cols-4 gap-1.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square bg-slate-700/50 rounded-md animate-pulse" />
            ))}
          </div>
        ) : faces.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No face photos yet</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {faces.map(face => (
              <div key={face.id} className="relative group aspect-square">
                <img
                  src={resolveImageUrl(face.imageUrl)}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover rounded-md border border-slate-700"
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
                {/* Delete overlay */}
                <button
                  onClick={() => handleDeleteFace(face.id)}
                  className="absolute inset-0 flex items-center justify-center bg-red-900/80 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove face"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add photos button */}
      <div className="px-3 pb-3">
        <label className="flex items-center justify-center gap-1.5 w-full py-2 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 cursor-pointer transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Photos
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} />
        </label>
      </div>
    </div>
  )
}
