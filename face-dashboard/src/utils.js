export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { 'ngrok-skip-browser-warning': 'true', ...options.headers },
  });
}

export function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
  return `${BACKEND_URL}${imageUrl}`;
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function getConfidenceColor(confidence) {
  if (confidence == null) return { bar: 'bg-slate-600', text: 'text-slate-400' };
  if (confidence >= 0.40) return { bar: 'bg-green-500', text: 'text-green-400' };
  if (confidence >= 0.25) return { bar: 'bg-amber-500', text: 'text-amber-400' };
  return { bar: 'bg-red-500', text: 'text-red-400' };
}

export function getStatusInfo(status) {
  switch (status) {
    case 'recognized':   return { label: 'Recognized',       cls: 'bg-green-500/20 text-green-400 border border-green-500/30' };
    case 'needs_review': return { label: 'Needs Review',     cls: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' };
    case 'unknown':      return { label: 'Unknown',          cls: 'bg-red-500/20 text-red-400 border border-red-500/30' };
    case 'corrected':    return { label: 'Corrected',        cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' };
    case 'no_face':      return { label: 'No Face Detected', cls: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' };
    default:             return { label: status ?? 'Unknown', cls: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' };
  }
}

export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* silently ignore if audio not available */ }
}
