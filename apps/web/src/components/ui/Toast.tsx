import React from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'conflict' | 'forbidden' | 'error' | 'info';
  title?: string;
  message: string;
  details?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        maxWidth: '440px',
        width: '100%',
      }}
    >
      {toasts.map((toast) => {
        const bgMap = {
          success: '#064e3b',
          conflict: '#7c2d12',
          forbidden: '#701a75',
          error: '#7f1d1d',
          info: '#1e3a8a',
        };
        const borderMap = {
          success: '#10b981',
          conflict: '#f97316',
          forbidden: '#d946ef',
          error: '#ef4444',
          info: '#3b82f6',
        };
        const titleMap = {
          success: '✓ Operation Successful',
          conflict: '⚡ 409 Conflict: Concurrent Modification',
          forbidden: '🔒 403 Forbidden: Action Not Permitted',
          error: '⚠ Request Error',
          info: 'ℹ Notice',
        };

        return (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className="animate-fade-in"
            style={{
              backgroundColor: bgMap[toast.type],
              border: `1px solid ${borderMap[toast.type]}`,
              color: '#ffffff',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              boxShadow: 'var(--shadow-popover)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {toast.title || titleMap[toast.type]}
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.2rem', opacity: 0.95, lineHeight: 1.4 }}>
                  {toast.message}
                </div>
                {toast.details && (
                  <div
                    style={{
                      fontSize: '0.725rem',
                      marginTop: '0.35rem',
                      opacity: 0.85,
                      fontStyle: 'italic',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    {toast.details}
                  </div>
                )}
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                style={{
                  color: '#ffffff',
                  opacity: 0.7,
                  fontSize: '1.1rem',
                  lineHeight: 1,
                  padding: '0 0.25rem',
                }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
