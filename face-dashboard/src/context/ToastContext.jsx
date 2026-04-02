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

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast-enter px-4 py-3 rounded-lg shadow-xl text-sm font-medium border pointer-events-auto max-w-sm ${
              toast.type === 'success' ? 'bg-green-900/95 text-green-100 border-green-700' :
              toast.type === 'error'   ? 'bg-red-900/95 text-red-100 border-red-700' :
                                         'bg-slate-800 text-slate-100 border-slate-600'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <span className="text-green-400">✓</span>}
              {toast.type === 'error'   && <span className="text-red-400">✗</span>}
              {toast.message}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
