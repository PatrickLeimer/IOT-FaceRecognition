import { useEffect, useState } from 'react'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { BACKEND_URL, resolveImageUrl } from '../utils'
import { useToast } from '../context/ToastContext'

/**
 * mode: 'correct'  — correct a wrong identification (shows user list)
 *       'enroll'   — enroll an unknown person (name input + user list)
 */
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
    if (tab === 'existing' && !selectedUserId) { toast('Select a person', 'error'); return }
    if (tab === 'new' && !newName.trim()) { toast('Enter a name', 'error'); return }

    setLoading(true)
    try {
      if (tab === 'existing') {
        const user = users.find(u => u.id === selectedUserId)
        // Call backend correction endpoint
        const form = new FormData()
        form.append('correct_user_id', selectedUserId)
        form.append('correct_name', user?.name ?? '')
        await fetch(`${BACKEND_URL}/correct/${event.id}`, { method: 'POST', body: form })

        // Update Firestore event
        await updateDoc(doc(db, 'events', event.id), {
          status: 'corrected',
          correctedName: user?.name ?? '',
          correctedUserId: selectedUserId,
          reviewed: true,
        })
        toast('Correction saved', 'success')
      } else {
        // New person — enroll from event image
        const name = newName.trim()
        const imgUrl = resolveImageUrl(event.imageUrl)

        let enrolledUserId = null
        if (imgUrl) {
          const imgRes = await fetch(imgUrl)
          const blob = await imgRes.blob()
          const file = new File([blob], 'face.jpg', { type: blob.type || 'image/jpeg' })
          const form = new FormData()
          form.append('name', name)
          form.append('image', file)
          const enrollRes = await fetch(`${BACKEND_URL}/enroll`, { method: 'POST', body: form })
          if (enrollRes.ok) {
            const data = await enrollRes.json().catch(() => ({}))
            enrolledUserId = data.user_id ?? null
          }
        }

        // Mark the event as corrected in Firestore
        await updateDoc(doc(db, 'events', event.id), {
          status: 'corrected',
          correctedName: name,
          correctedUserId: enrolledUserId ?? '',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">
            {mode === 'enroll' ? 'Who is this person?' : 'Correct identification'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Event preview */}
        {event.imageUrl && (
          <div className="px-5 pt-4">
            <img
              src={resolveImageUrl(event.imageUrl)}
              alt="Event"
              className="w-24 h-24 rounded-lg object-cover border border-slate-700"
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4">
          <button
            onClick={() => setTab('existing')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tab === 'existing' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Select person
          </button>
          <button
            onClick={() => setTab('new')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tab === 'new' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            New person
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {tab === 'existing' ? (
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Select the correct person</label>
              <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border border-slate-700 p-2">
                {users.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No enrolled users yet</p>
                )}
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedUserId === user.id
                        ? 'bg-teal-600/30 text-teal-300 border border-teal-600/50'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {user.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Person's name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="e.g. Sarah"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
          >
            {loading ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
