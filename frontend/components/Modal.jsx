// frontend/components/Modal.jsx
import { useEffect } from 'react';

export default function Modal({ title, onClose, children, width = 480 }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-background)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          width: '100%',
          maxWidth: width,
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: 'var(--color-text-muted)',
              fontSize: '18px',
              padding: '2px 8px',
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ModalFooter({ children }) {
  return (
    <div style={{
      display: 'flex', gap: '8px', justifyContent: 'flex-end',
      marginTop: '20px', paddingTop: '16px',
      borderTop: '1px solid var(--color-border)',
    }}>
      {children}
    </div>
  );
}

export function BtnPrimary({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: 'var(--color-primary)',
      color: '#fff',
      padding: '8px 18px',
    }}>
      {children}
    </button>
  );
}

export function BtnDanger({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: 'var(--color-danger)',
      color: '#fff',
      padding: '8px 18px',
    }}>
      {children}
    </button>
  );
}

export function BtnSecondary({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent',
      border: '1px solid var(--color-border)',
      color: 'var(--color-text-muted)',
      padding: '8px 18px',
    }}>
      {children}
    </button>
  );
}
