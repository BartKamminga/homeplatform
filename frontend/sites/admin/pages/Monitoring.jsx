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
      <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>Management & links</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '28px', fontSize: 'var(--font-size-sm)' }}>
        Quick access to external management environments
      </p>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>{error}</p>}

      {/* ── Toegang ── */}
      <Section title="Access">
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          <LinkCard
            icon="🌐"
            title="webheaven.nl"
            description="External access via Cloudflare Tunnel. Reachable for everyone with an invite."
            href={links.external_url}
            badge="live"
            badgeColor="#22c55e"
            placeholder="Set EXTERNAL_URL in .env"
          />
          <LinkCard
            icon="☁"
            title="Cloudflare Tunnel"
            description="Manage the tunnel that makes the platform reachable externally. Status, replicas and routes."
            href={links.cloudflare_tunnel}
            placeholder="Set EXTERNAL_URL in .env"
          />
          <LinkCard
            icon="📊"
            title="Cloudflare Analytics"
            description="Visitors, requests, bandwidth and threats for webheaven.nl."
            href={links.cloudflare_analytics}
            placeholder="Set EXTERNAL_URL in .env"
          />
          <LinkCard
            icon="🌍"
            title="mijndomein.nl"
            description="Domain registrar — the webheaven.nl domain is registered here. DNS, renewal and invoices."
            href="https://www.mijndomein.nl/"
          />
          <LinkCard
            icon="🐛"
            title="Bugsink"
            description="Error and crash monitoring. Sentry-compatible drop-in, runs on the acc/management machine (G4)."
            href={links.bugsink}
            badge={overview?.sentry_enabled ? `active · ${overview.sentry_min_level}+` : null}
            badgeColor={overview?.sentry_enabled ? '#22c55e' : null}
          />
          <LinkCard
            icon="🐳"
            title="Portainer"
            description="Docker management UI on the acc/management machine (G4). Containers, images, volumes and logs."
            href={links.portainer}
          />
          <LinkCard
            icon="🖥"
            title="Cockpit"
            description="Server management UI on the acc/management machine (G4). CPU, memory, network and services."
            href={links.cockpit}
          />
          <LinkCard
            icon="📄"
            title="API documentation"
            description="Interactive Swagger UI for all backend endpoints (development only)."
            href={links.api_docs}
            placeholder="Only available in development mode"
            internal
          />
          <LinkCard
            icon="🔑"
            title="Admin — System"
            description="Full platform overview: versions, users, groups and table sizes."
            href="/admin/system"
            internal
          />
          <LinkCard
            icon="🖥"
            title="Admin — Infrastructure"
            description="Live overview of the containers on this machine: images, status, ports and volumes."
            href="/admin/infrastructure"
            internal
          />
          <LinkCard
            icon="📈"
            title="Admin — API stats"
            description="Live overview of how often each backend endpoint is called."
            href="/admin/api-stats"
            internal
          />
          <LinkCard
            icon="🐙"
            title="GitHub"
            description="Platform source code. Commits, branches, pull requests and the full history."
            href={links.github}
          />
          <LinkCard
            icon="⚙"
            title="GitHub Actions"
            description="CI/CD pipelines: deploy to acc (develop) and prod (main). Trigger the prod→acc DB snapshot manually."
            href={links.github ? links.github + '/actions' : null}
            placeholder="Set GITHUB_URL in .env"
          />
          <LinkCard
            icon="🧪"
            title="Acceptance environment"
            description="Develop branch — test new features before they go to prod. Same stack as prod, own database."
            href={links.acc}
          />
          <LinkCard
            icon="◈"
            title="Roadmap"
            description="Ideas, ongoing tasks and finished items. The central backlog of the platform."
            href="/admin/roadmap"
            internal
          />
          <LinkCard
            icon="◷"
            title="Changelog"
            description="Overview of all releases and changes that went live."
            href="/admin/changelog"
            internal
          />
          <LinkCard
            icon="⟳"
            title="Workflows"
            description="Step-by-step explanation of the roadmap, deploy and user workflows."
            href="/admin/workflows"
            internal
          />
          <LinkCard
            icon="◈"
            title="Data &amp; settings"
            description="Overview of what is stored per user, group or device."
            href="/admin/data-storage"
            internal
          />
        </div>
      </Section>

      {/* ── Omgeving ── */}
      {overview && (
        <Section title="Environment">
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'grid', gap: '8px',
          }}>
            <EnvRow label="Environment"           value={overview.environment} />
            <EnvRow label="Backend version"        value={overview.backend_version} />
            <EnvRow label="DB revision"            value={overview.db_revision} mono />
            <EnvRow label="Database"              value={overview.database_file} mono />
            <EnvRow label="External"                value={links.external_url || '—'} />
            <EnvRow label="Bugsink"               value={overview.sentry_enabled ? `active (${overview.sentry_min_level}+)` : 'disabled'} />
            <EnvRow label="Download folder"          value={overview.download_dir || '—'} mono />
            {overview.beatportdl_config_dir && (
              <EnvRow label="beatportdl config"   value={overview.beatportdl_config_dir} mono />
            )}
          </div>
        </Section>
      )}

    </AdminLayout>
  );
}

/* ── Helpers ── */

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '36px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px', color: 'var(--color-text)' }}>{title}</h2>
      {children}
    </div>
  );
}

function LinkCard({ icon, title, description, href, badge, badgeColor, placeholder, internal }) {
  const available = Boolean(href);
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '20px',
      opacity: available ? 1 : 0.55, display: 'flex', flexDirection: 'column', gap: '10px',
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
        <a
          href={href}
          target={internal ? undefined : '_blank'}
          rel={internal ? undefined : 'noopener noreferrer'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', color: 'var(--color-primary)',
            textDecoration: 'none', fontWeight: 500, marginTop: 'auto',
          }}
        >
          {internal ? 'Open →' : 'Open ↗'}
        </a>
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
