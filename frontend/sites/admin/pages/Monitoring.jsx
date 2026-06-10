import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { api } from '@core/api.js';

export default function Monitoring() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/admin/system/overview')
      .then(setOverview)
      .catch(e => setError(e.message));
  }, []);

  const links = overview?.links ?? {};

  return (
    <AdminLayout>
      <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>Beheer & links</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '28px', fontSize: 'var(--font-size-sm)' }}>
        Snelle toegang tot externe beheeromgevingen
      </p>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>{error}</p>}

      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        <LinkCard
          icon="🐛"
          title="GlitchTip"
          description="Fout- en crash-monitoring. Bekijk exceptions, traces en releases."
          href={links.glitchtip}
          badge={overview?.sentry_enabled ? `actief · ${overview.sentry_min_level}+` : null}
          badgeColor={overview?.sentry_enabled ? '#22c55e' : null}
          placeholder="Stel SENTRY_DSN in .env in"
        />

        <LinkCard
          icon="🖥"
          title="NAS — Synology DSM"
          description="Beheerpaneel van de NAS waar HomePlatform op draait."
          href={links.nas}
          placeholder="Stel NAS_URL in .env in"
        />

        <LinkCard
          icon="📄"
          title="API documentatie"
          description="Interactieve Swagger UI voor alle backend endpoints (alleen development)."
          href={links.api_docs}
          placeholder="Alleen beschikbaar in development mode"
          internal
        />

        <LinkCard
          icon="🔑"
          title="Admin — Systeem"
          description="Volledig platformoverzicht met versies, gebruikers en tabelgroottes."
          href="/admin/system"
          internal
        />

        <LinkCard
          icon="📊"
          title="Admin — API stats"
          description="Live overzicht van hoeveel elke backend-endpoint wordt aangeroepen."
          href="/admin/api-stats"
          internal
        />
      </div>

      {overview && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Omgeving</h2>
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)', padding: '16px 20px',
            display: 'grid', gap: '8px',
          }}>
            <EnvRow label="Environment"    value={overview.environment} />
            <EnvRow label="Backend versie" value={overview.backend_version} />
            <EnvRow label="DB revisie"     value={overview.db_revision} mono />
            <EnvRow label="Database"       value={overview.database_file} mono />
            <EnvRow label="GlitchTip"      value={overview.sentry_enabled ? `actief (${overview.sentry_min_level}+)` : 'uitgeschakeld'} />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function LinkCard({ icon, title, description, href, badge, badgeColor, placeholder, internal }) {
  const available = Boolean(href);

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid ${available ? 'var(--color-border)' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      opacity: available ? 1 : 0.55,
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>{icon}</span>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>{title}</span>
        </div>
        {badge && (
          <span style={{
            fontSize: '11px', padding: '2px 7px', borderRadius: '99px',
            background: (badgeColor || '#888') + '22', color: badgeColor || '#888',
            border: `1px solid ${(badgeColor || '#888')}44`, fontWeight: 500,
          }}>{badge}</span>
        )}
      </div>

      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
        {description}
      </p>

      {available ? (
        internal ? (
          <a
            href={href}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', color: 'var(--color-primary)',
              textDecoration: 'none', fontWeight: 500,
              marginTop: 'auto',
            }}
          >
            Openen →
          </a>
        ) : (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', color: 'var(--color-primary)',
              textDecoration: 'none', fontWeight: 500,
              marginTop: 'auto',
            }}
          >
            Openen ↗
          </a>
        )
      ) : (
        <span style={{ fontSize: '12px', color: 'var(--color-text-light)', fontStyle: 'italic', marginTop: 'auto' }}>
          {placeholder}
        </span>
      )}
    </div>
  );
}

function EnvRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'var(--font-mono)' : undefined, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
