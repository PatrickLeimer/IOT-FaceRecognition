import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const addToast = useCallback((message, type = 'info') => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const getBorderColor = (type) => {
    if (type === 'success') return 'var(--green-border)'
    if (type === 'error')   return 'var(--red-border)'
    return 'var(--cyan-border)'
  }

  const getDotColor = (type) => {
    if (type === 'success') return 'var(--green)'
    if (type === 'error')   return 'var(--red)'
    return 'var(--cyan)'
  }

  const getLabel = (type) => {
    if (type === 'success') return 'OK'
    if (type === 'error')   return 'ERR'
    return 'INFO'
  }

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              background: 'var(--bg-2)',
              border: `1px solid ${getBorderColor(toast.type)}`,
              color: 'var(--t1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              padding: '10px 14px',
              borderRadius: 6,
              pointerEvents: 'auto',
              maxWidth: 340,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{
              fontFamily: 'var(--ff-data)',
              fontSize: '0.55rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: getDotColor(toast.type),
              flexShrink: 0,
            }}>
              {getLabel(toast.type)}
            </span>
            <div style={{ width: '1px', height: 14, background: 'var(--cyan-border)', flexShrink: 0 }} />
            <p style={{ fontFamily: 'var(--ff-ui)', fontSize: '0.78rem', color: 'var(--t1)', margin: 0, lineHeight: 1.4 }}>
              {toast.message}
            </p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
