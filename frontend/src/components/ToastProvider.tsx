import React from 'react';
import { useToastStore } from '../store/useToastStore';

export const ToastProvider: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      id="toast-container"
      className="fixed top-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const bgClass =
          t.type === 'success'
            ? 'bg-black text-white'
            : t.type === 'error'
            ? 'bg-red-600 text-white'
            : t.type === 'warning'
            ? 'bg-amber-600 text-white'
            : 'bg-gray-900 text-white';

        return (
          <div
            key={t.id}
            className={`toast-item pointer-events-auto flex items-start space-x-2 p-3 rounded-[4px] ${bgClass} shadow-lg text-xs max-w-sm border border-white/10 animate-slideInRight`}
          >
            <div className="flex-1 space-y-0.5">
              <div className="font-bold">{t.title}</div>
              <div className="text-[11px] opacity-90">{t.message}</div>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-white/60 hover:text-white font-bold text-xs p-1"
              aria-label="Dismiss toast"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
};
