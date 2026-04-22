import { useState } from 'react'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { resolveImageUrl, formatRelativeTime, getConfidenceColor, getStatusInfo } from '../utils'
import { useToast } from '../context/ToastContext'
import CorrectionModal from './CorrectionModal'

function FacePlaceholder() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-1)' }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--t4)' }}>
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1"/>
        <path d="M8 7h.01M16 7h.01M10 10s.5 1 2 1 2-1 2-1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

function getBadgeClass(status) {
  if (status === 'recognized') return 'badge-cyber badge-recognized'
  if (status === 'needs_review') return 'badge-cyber badge-needs_review'
  if (status === 'unknown') return 'badge-cyber badge-unknown'
  if (status === 'corrected') return 'badge-cyber badge-corrected'
  return 'badge-cyber badge-no_face'
}

function getBadgeLabel(status) {
  if (status === 'recognized') return 'Identified'
  if (status === 'needs_review') return 'Review'
  if (status === 'unknown') return 'Unknown'
  if (status === 'corrected') return 'Corrected'
  return 'No Face'
}

function getConfClass(confidence) {
  if (confidence == null) return ''
  if (confidence >= 0.75) return 'conf-high'
  if (confidence >= 0.5) return 'conf-medium'
  return 'conf-low'
}

export default function EventCard({ event }) {
  const [imgError, setImgError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('correct')
  const [confirming, setConfirming] = useState(false)
  const toast = useToast()

  const { status, confidence, detectedName, correctedName, imageUrl, timestamp, id } = event
  const imgSrc = resolveImageUrl(imageUrl)

  const displayName = status === 'corrected'
    ? correctedName ?? detectedName
    : detectedName ?? 'Unknown'

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await updateDoc(doc(db, 'events', id), { status: 'recognized', reviewed: true })
      toast('Confirmed as recognized', 'success')
    } catch {
      toast('Failed to confirm', 'error')
    } finally {
      setConfirming(false)
    }
  }

  const openCorrect = () => { setModalMode('correct'); setModalOpen(true) }
  const openEnroll  = () => { setModalMode('enroll');  setModalOpen(true) }

  const confPct = confidence != null ? Math.max(0, Math.round(confidence * 100)) : null

  return (
    <>
      <div className="card-cyber flex flex-col" style={{ overflow: 'hidden' }}>
        {/* Image area */}
        <div style={{ position: 'relative', aspectRatio: '1', background: 'var(--bg-1)' }}>
          {imgSrc && !imgError ? (
            <img
              src={imgSrc}
              alt={displayName}
              loading="lazy"
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <FacePlaceholder />
          )}

          {/* Bounding box */}
          {event.facialArea && !imgError && imgSrc && (
            <div
              style={{
                position: 'absolute',
                left:   `${event.facialArea.x * 100}%`,
                top:    `${event.facialArea.y * 100}%`,
                width:  `${event.facialArea.w * 100}%`,
                height: `${event.facialArea.h * 100}%`,
                border: '1.5px solid var(--cyan)',
                pointerEvents: 'none',
                zIndex: 6,
              }}
            >
              <span style={{
                position: 'absolute',
                top: -20,
                left: 0,
                fontFamily: 'var(--ff-data)',
                fontSize: '0.55rem',
                background: 'var(--cyan)',
                color: '#000',
                padding: '2px 6px',
                whiteSpace: 'nowrap',
                letterSpacing: '0.06em',
              }}>
                {displayName}
              </span>
            </div>
          )}

          {/* Status badge */}
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 7 }}>
            <span className={getBadgeClass(status)}>{getBadgeLabel(status)}</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {/* Name + time */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--t1)', margin: 0, lineHeight: 1.3, letterSpacing: '0.02em' }}>
                {displayName}
              </p>
              {status === 'corrected' && detectedName && detectedName !== correctedName && (
                <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.6rem', color: 'var(--t3)', marginTop: 3 }}>
                  {detectedName} → {correctedName}
                </p>
              )}
            </div>
            <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.6rem', color: 'var(--t3)', flexShrink: 0, letterSpacing: '0.05em' }}>
              {formatRelativeTime(timestamp)}
            </p>
          </div>

          {/* Confidence */}
          {confPct != null && status !== 'no_face' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--ff-data)', fontSize: '0.58rem', color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Confidence
                </span>
                <span style={{ fontFamily: 'var(--ff-data)', fontSize: '0.65rem', fontWeight: 700, color: confPct >= 75 ? 'var(--green)' : confPct >= 50 ? 'var(--amber)' : 'var(--red)' }}>
                  {confPct}%
                </span>
              </div>
              <div className="conf-bar-track">
                <div
                  className={`conf-bar-fill ${getConfClass(confidence)}`}
                  style={{ width: `${confPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {status === 'needs_review' && (
              <div style={{
                background: 'rgba(255, 184, 0, 0.05)',
                border: '1px solid var(--amber-border)',
                borderRadius: 4,
                padding: '8px 10px',
                display: 'flex', flexDirection: 'column', gap: 7,
              }}>
                <p style={{ fontFamily: 'var(--ff-data)', fontSize: '0.6rem', color: 'var(--t2)', margin: 0 }}>
                  Is this <strong style={{ color: 'var(--t1)', fontFamily: 'var(--ff-ui)' }}>{detectedName}</strong>?
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="btn-cyber btn-cyber-green"
                    style={{ flex: 1, padding: '6px 8px' }}
                  >
                    {confirming ? '…' : 'Confirm'}
                  </button>
                  <button
                    onClick={openCorrect}
                    className="btn-cyber btn-cyber-ghost"
                    style={{ flex: 1, padding: '6px 8px' }}
                  >
                    Correct
                  </button>
                </div>
              </div>
            )}

            {status === 'unknown' && (
              <button
                onClick={openEnroll}
                className="btn-cyber btn-cyber-primary"
                style={{ padding: '8px', width: '100%' }}
              >
                + Enroll this person
              </button>
            )}

            {status !== 'no_face' && (
              <button
                onClick={openCorrect}
                style={{
                  background: 'none',
                  border: 'none',
                  fontFamily: 'var(--ff-data)',
                  fontSize: '0.58rem',
                  color: 'var(--t4)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  letterSpacing: '0.08em',
                  padding: '2px',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--t4)'}
              >
                REPORT_ERROR
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
