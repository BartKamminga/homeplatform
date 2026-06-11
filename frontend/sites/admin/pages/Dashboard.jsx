import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import { api } from '@core/api.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function relTime(isoStr) {
  const s = (Date.now() - new Date(isoStr)) / 1000;
  if (s < 60)    return 'zojuist';
  if (s < 3600)  return `${Math.floor(s / 60)} min geleden`;
  if (s < 86400) return `${Math.floor(s / 3600)} u geleden`;
  return `${Math.floor(s / 86400)} d geleden`;
}

const ACTION_META = {
  'login':          { icon: '→', color: '#6366f1' },
  'logout':         { icon: '←', color: '#94a3b8' },
  'task.create':    { icon: '+', color: '#22c55e' },
  'task.complete':  { icon: '✓', color: '#16a34a' },
  'task.delete':    { icon: '×', color: '#ef4444' },
  'task.update':    { icon: '~', color: '#f59e0b' },
  'heart.add':      { icon: '♥', color: '#ec4899' },
  'heart.delete':   { icon: '♡', color: '#94a3b8' },
  'group.create':   { icon: '+', color: '#3b82f6' },
  'group.delete':   { icon: '×', color: '#ef4444' },
  'user.create':    { icon: '+', color: '#8b5cf6' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 22px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 'var(--radius-md)',
        background: color + '1a', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 22, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: color, lineHeight: 1 }}>
          {value ?? '—'}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ entry }) {
  const meta = ACTION_META[entry.action] ?? { icon: '·', color: 'var(--color-text-muted)' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: meta.color + '18', color: meta.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700,
      }}>
        {meta.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <code style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
          {entry.action}
        </code>
        {entry.site && (
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-primary-light)', padding: '1px 6px', borderRadius: 4 }}>
            {entry.site}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
        {relTime(entry.created_at)}
      </div>
    </div>
  );
}

function QuickLink({ to, icon, label, sub }) {
  const [hovered, setHovered] = useState(false);
  return (
    <NavLink
      to={to}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 'var(--radius-md)',
        textDecoration: 'none',
        background: (isActive || hovered) ? 'var(--color-primary-light)' : 'transparent',
        color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
        transition: 'background 0.15s',
      })}
    >
      <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{sub}</div>}
      </div>
    </NavLink>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [error,    setError]    = useState('');

  useEffect(() => {
    api.get('/api/admin/system/overview')
      .then(setOverview)
      .catch(e => setError(e.message));
  }, []);

  const t = overview?.tables ?? {};

  return (
    <AdminLayout>
      <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>Dashboard</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '28px', fontSize: 'var(--font-size-sm)' }}>
        Overzicht van het platform
      </p>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      {/* Stat cards */}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginBottom: 28 }}>
        <StatCard
          icon="👤"
          label="Gebruikers"
          value={overview?.users?.active}
          sub={overview ? `${overview.users.inactive} inactief` : null}
          color="#6366f1"
        />
        <StatCard
          icon="📋"
          label="Taken"
          value={t.tasks}
          sub="in database"
          color="#22c55e"
        />
        <StatCard
          icon="♫"
          label="Tracks"
          value={t.mixmusic_track_meta}
          sub={`${t.mixmusic_track_hearts ?? 0} hartjes`}
          color="#ec4899"
        />
        <StatCard
          icon="🗃"
          label="DB revisie"
          value={overview?.db_revision?.slice(0, 8)}
          sub={overview?.environment}
          color="#f59e0b"
        />
      </div>

      {/* Bottom: activity + quick links */}
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 260px', alignItems: 'start' }}>

        {/* Recente activiteit */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Recente activiteit</span>
            <NavLink to="/admin/audit-log" style={{ fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none' }}>
              Alles zien →
            </NavLink>
          </div>
          {overview?.recent_audit?.length
            ? overview.recent_audit.map((e, i) => <ActivityRow key={i} entry={e} />)
            : <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Geen activiteit gevonden</p>
          }
        </div>

        {/* Snelkoppelingen */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8, padding: '0 6px' }}>
            Navigeer naar
          </div>
          <QuickLink to="/admin/users"      icon="👥" label="Gebruikers"   sub={overview ? `${overview.users.total} totaal` : ''} />
          <QuickLink to="/admin/groups"     icon="🏷" label="Groepen"      sub={overview ? `${overview.groups.length} groepen` : ''} />
          <QuickLink to="/admin/sites"      icon="🌐" label="Sites"        sub={overview ? `${overview.sites.length} sites` : ''} />
          <QuickLink to="/admin/api-stats"  icon="▤"  label="API stats"    sub="Gebruik en latentie" />
          <QuickLink to="/admin/monitoring" icon="🔗" label="Monitoring"   sub="Links & GlitchTip" />
          <QuickLink to="/admin/audit-log"  icon="📜" label="Auditlog"     sub={t.audit_log ? `${t.audit_log} regels` : ''} />
        </div>
      </div>
    </AdminLayout>
  );
}
