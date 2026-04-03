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
  const [progress, setProgress] = useState(null) // { current, total, results }
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
          if ((data.userId || data.user_id) && !userId) userId = data.userId || data.user_id
          results.push({ file: files[i].name, ok: true })
        } else {
          results.push({ file: files[i].name, ok: false, err: data.detail ?? data.message ?? `Request failed (${res.status})` })
        }
      } catch (error) {
        results.push({ file: files[i].name, ok: false, err: error?.message || 'Network error' })
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">Enroll New Face</h1>
        <p className="text-sm text-slate-500 mt-0.5">Upload face photos to register someone in the system</p>
      </div>

      {/* Tips */}
      <div className="bg-teal-900/30 border border-teal-700/40 rounded-xl p-4 text-sm text-teal-300 space-y-1">
        <p className="font-medium text-teal-200">Tips for best results</p>
        <ul className="space-y-0.5 text-teal-400 list-disc list-inside">
          <li>Upload 5–10 photos per person</li>
          <li>Use different angles, lighting, and expressions</li>
          <li>Make sure the face is clearly visible and unobstructed</li>
          <li>Avoid extreme filters or heavy makeup</li>
        </ul>
      </div>

      {done ? (
        /* Success / results view */
        <div className="space-y-4 fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-slate-100">Upload Complete</h2>
            <div className="space-y-2">
              {progress?.results.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${r.ok ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                  <span>{r.ok ? '✓' : '✗'}</span>
                  <span className="truncate flex-1">{r.file}</span>
                  {!r.ok && <span className="text-xs text-red-400">{r.err}</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={handleReset} className="w-full py-3 bg-teal-600 hover:bg-teal-500 rounded-xl text-white font-medium transition-colors">
            Enroll Another Person
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-teal-400 bg-teal-900/20' : 'border-slate-600 hover:border-slate-500'
            }`}
          >
            <svg className="w-12 h-12 text-slate-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-slate-300 font-medium">Drop photos here or click to browse</p>
            <p className="text-slate-500 text-sm mt-1">Supports JPG, PNG, WEBP — multiple files</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { addFiles(Array.from(e.target.files)); e.target.value = '' }}
            />
          </div>

          {/* Preview thumbnails */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{files.length} photo(s) selected</p>
                <button onClick={() => setFiles([])} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Clear all</button>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative group aspect-square">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover rounded-lg border border-slate-700" />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute inset-0 flex items-center justify-center bg-red-900/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Name / person selection */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex gap-3">
              <button
                onClick={() => setUseExisting(false)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${!useExisting ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                New person
              </button>
              <button
                onClick={() => setUseExisting(true)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${useExisting ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Existing person
              </button>
            </div>

            {!useExisting ? (
              <div className="space-y-1">
                <label className="text-sm text-slate-400">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Sarah"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-sm text-slate-400">Select person</label>
                {existingUsers.length === 0 ? (
                  <p className="text-sm text-slate-500">No enrolled users found — create a new person instead</p>
                ) : (
                  <select
                    value={selectedUserId}
                    onChange={e => setSelectedUserId(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">— Select a person —</option>
                    {existingUsers.map(u => (
                      <option key={u.id ?? u.user_id} value={u.id ?? u.user_id}>{u.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Progress bar */}
          {progress && !done && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Uploading…</span>
                <span className="text-slate-300 font-medium">{progress.current}/{progress.total}</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!!progress && !done}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-xl text-white font-medium transition-colors text-sm"
          >
            {progress && !done
              ? `Uploading ${progress.current}/${progress.total}…`
              : `Enroll ${files.length > 0 ? `${files.length} photo(s)` : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
