import { useState } from 'react'
import { BACKEND_URL, resolveImageUrl, formatRelativeTime, getConfidenceColor, getStatusInfo } from '../utils'
import { useToast } from '../context/ToastContext'
import CorrectionModal from './CorrectionModal'

function FacePlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-700/50">
      <svg className="w-16 h-16 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    </div>
  )
}

export default function EventCard({ event, isNew }) {
  const [imgError, setImgError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('correct')
  const [confirming, setConfirming] = useState(false)
  const toast = useToast()

  const { status, confidence, detectedName, correctedName, imageUrl, timestamp, id } = event
  const { label, cls } = getStatusInfo(status)
  const confColor = getConfidenceColor(confidence)
  const imgSrc = resolveImageUrl(imageUrl)

  const displayName = status === 'corrected'
    ? correctedName ?? detectedName
    : detectedName ?? 'Unknown Person'

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      const res = await fetch(`${BACKEND_URL}/confirm/${id}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail ?? data.message ?? 'Failed to confirm')
      toast('Confirmed as recognized', 'success')
    } catch (error) {
      toast(error?.message || 'Failed to confirm', 'error')
    } finally {
      setConfirming(false)
    }
  }

  const openCorrect = () => { setModalMode('correct'); setModalOpen(true) }
  const openEnroll  = () => { setModalMode('enroll');  setModalOpen(true) }

  return (
    <>
      <div className={`bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col transition-shadow hover:border-slate-600 ${isNew ? 'new-event-flash' : ''}`}>
        {/* Image */}
        <div className="relative aspect-square bg-slate-700">
          {imgSrc && !imgError ? (
            <img
              src={imgSrc}
              alt={displayName}
              loading="lazy"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <FacePlaceholder />
          )}
          {/* Status badge overlay */}
          <div className="absolute top-2 left-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col gap-2 flex-1">
          {/* Name */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-100 text-sm leading-tight">{displayName}</p>
              {status === 'corrected' && detectedName && detectedName !== correctedName && (
                <p className="text-xs text-slate-500 mt-0.5">{detectedName} → {correctedName}</p>
              )}
            </div>
            <p className="text-xs text-slate-500 shrink-0">{formatRelativeTime(timestamp)}</p>
          </div>

          {/* Confidence bar */}
          {confidence != null && status !== 'no_face' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Confidence</span>
                <span className={`text-xs font-medium ${confColor.text}`}>{Math.round(confidence * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${confColor.bar}`}
                  style={{ width: `${Math.round(confidence * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Action area */}
          <div className="mt-auto pt-1 space-y-2">
            {status === 'needs_review' && (
              <div className="bg-slate-700/50 rounded-lg p-2 space-y-1.5">
                <p className="text-xs text-slate-300">Is this <span className="text-white font-medium">{detectedName}</span>?</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="flex-1 text-xs py-1.5 bg-green-600/80 hover:bg-green-600 disabled:opacity-50 rounded-md text-white font-medium transition-colors"
                  >
                    {confirming ? '…' : 'Confirm'}
                  </button>
                  <button
                    onClick={openCorrect}
                    className="flex-1 text-xs py-1.5 bg-slate-600 hover:bg-slate-500 rounded-md text-slate-200 transition-colors"
                  >
                    Correct
                  </button>
                </div>
              </div>
            )}

            {status === 'unknown' && (
              <button
                onClick={openEnroll}
                className="w-full text-xs py-2 bg-teal-600/80 hover:bg-teal-600 rounded-md text-white font-medium transition-colors"
              >
                Who is this? Enroll them
              </button>
            )}

            {/* "This is wrong" — always visible except no_face */}
            {status !== 'no_face' && (
              <button
                onClick={openCorrect}
                className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors text-center"
              >
                This is wrong
              </button>
            )}
          </div>
        </div>
      </div>

      <CorrectionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        event={event}
        mode={modalMode}
        onSuccess={() => {}}
      />
    </>
  )
}
