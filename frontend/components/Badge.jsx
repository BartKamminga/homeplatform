// frontend/components/Badge.jsx

const variants = {
  success: { bg: 'var(--color-success-light)', color: 'var(--color-success)' },
  danger:  { bg: 'var(--color-danger-light)',  color: 'var(--color-danger)'  },
  warning: { bg: 'var(--color-warning-light)', color: 'var(--color-warning)' },
  neutral: { bg: 'var(--color-surface-2)',     color: 'var(--color-text-muted)' },
  primary: { bg: 'var(--color-primary-light)', color: 'var(--color-primary)' },
};

export default function Badge({ label, variant = 'neutral' }) {
  const style = variants[variant] || variants.neutral;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 9px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 500,
      background: style.bg,
      color: style.color,
    }}>
      {label}
    </span>
  );
}
