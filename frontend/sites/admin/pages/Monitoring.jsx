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

      {/* ── Toegang ── */}
      <Section title="Toegang">
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          <LinkCard
            icon="🌐"
            title="webheaven.nl"
            description="Externe toegang via Cloudflare Tunnel. Bereikbaar voor iedereen met een uitnodiging."
            href={links.external_url}
            badge="live"
            badgeColor="#22c55e"
            placeholder="Stel EXTERNAL_URL in .env in"
          />
          <LinkCard
            icon="☁"
            title="Cloudflare Tunnel"
            description="Beheer de tunnel die het platform extern bereikbaar maakt. Status, replicas en routes."
            href={links.cloudflare_tunnel}
            placeholder="Stel EXTERNAL_URL in .env in"
          />
          <LinkCard
            icon="📊"
            title="Cloudflare Analytics"
            description="Bezoekers, requests, bandbreedte en threats voor webheaven.nl."
            href={links.cloudflare_analytics}
            placeholder="Stel EXTERNAL_URL in .env in"
          />
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
            description="Beheerpaneel van de NAS waar WebHeaven op draait."
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
            description="Volledig platformoverzicht: versies, gebruikers, groepen en tabelgroottes."
            href="/admin/system"
            internal
          />
          <LinkCard
            icon="📈"
            title="Admin — API stats"
            description="Live overzicht van hoeveel elke backend-endpoint wordt aangeroepen."
            href="/admin/api-stats"
            internal
          />
          <LinkCard
            icon="🐙"
            title="GitHub"
            description="Broncode van het platform. Commits, branches, pull requests en de volledige history."
            href={links.github}
          />
          <LinkCard
            icon="◈"
            title="Roadmap"
            description="Ideeën, lopende taken en voltooide items. De centrale backlog van het platform."
            href="/admin/roadmap"
            internal
          />
          <LinkCard
            icon="◷"
            title="Changelog"
            description="Overzicht van alle releases en wijzigingen die live zijn gegaan."
            href="/admin/changelog"
            internal
          />
        </div>
      </Section>

      {/* ── Omgeving ── */}
      {overview && (
        <Section title="Omgeving">
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'grid', gap: '8px',
          }}>
            <EnvRow label="Environment"    value={overview.environment} />
            <EnvRow label="Backend versie" value={overview.backend_version} />
            <EnvRow label="DB revisie"     value={overview.db_revision} mono />
            <EnvRow label="Database"       value={overview.database_file} mono />
            <EnvRow label="Extern"         value={links.external_url || '—'} />
            <EnvRow label="GlitchTip"      value={overview.sentry_enabled ? `actief (${overview.sentry_min_level}+)` : 'uitgeschakeld'} />
          </div>
        </Section>
      )}

      {/* ── Roadmap workflow ── */}
      <Section title="Roadmap workflow">
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: '20px 24px',
        }}>
          {/* Flow bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            flexWrap: 'wrap', marginBottom: '20px',
          }}>
            {[
              { status: 'idee',        color: 'var(--color-text-muted)', label: 'idee' },
              { status: 'geanalyseerd',color: '#8b5cf6',                 label: 'geanalyseerd' },
              { status: 'pak_op',      color: '#0ea5e9',                 label: 'pak_op' },
              { status: 'in_progress', color: 'var(--color-primary)',    label: 'in_progress' },
              { status: 'gereed',      color: 'var(--color-warning)',    label: 'gereed' },
              { status: 'deploying',   color: 'var(--color-danger)',     label: 'deploying' },
              { status: 'klaar',       color: 'var(--color-success)',    label: 'klaar' },
            ].map(({ status, color, label }, i, arr) => (
              <span key={status} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
                  background: color + '1a', color, border: `1px solid ${color}44`,
                  fontFamily: 'var(--font-mono)',
                }}>{label}</span>
                {i < arr.length - 1 && (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>→</span>
                )}
              </span>
            ))}
          </div>
          {/* Status descriptions */}
          <div style={{ display: 'grid', gap: '8px' }}>
            {[
              { status: 'idee',        color: 'var(--color-text-muted)', desc: 'Nieuwe wens of taak — staat in de backlog, nog niet opgepakt.' },
              { status: 'geanalyseerd',color: '#8b5cf6',                 desc: 'Impact, risico en scope zijn ingevuld — klaar voor verdere prioritering.' },
              { status: 'pak_op',      color: '#0ea5e9',                 desc: 'Expliciet geprioriteerd — wordt als eerste opgepakt in de volgende sessie.' },
              { status: 'in_progress', color: 'var(--color-primary)',    desc: 'Wordt actief aan gewerkt — code in ontwikkeling.' },
              { status: 'gereed',      color: 'var(--color-warning)',    desc: 'Code is klaar en getest, nog niet gedeployed naar de NAS.' },
              { status: 'deploying',   color: 'var(--color-danger)',     desc: 'Deploy bezig via hpem.ps1 — platform herstart.' },
              { status: 'klaar',       color: 'var(--color-success)',    desc: 'Live op de NAS — changelog-entry is automatisch aangemaakt.' },
            ].map(({ status, color, desc }) => (
              <div key={status} style={{ display: 'flex', alignItems: 'baseline', gap: '12px', fontSize: '13px' }}>
                <span style={{
                  minWidth: '82px', padding: '1px 8px', borderRadius: '99px', fontSize: '11px',
                  fontWeight: 600, textAlign: 'center', flexShrink: 0,
                  background: color + '1a', color, border: `1px solid ${color}44`,
                  fontFamily: 'var(--font-mono)',
                }}>{status}</span>
                <span style={{ color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Deploy workflow ── */}
      <Section title="Deploy workflow">
        <div style={{ display: 'grid', gap: '12px' }}>
          <WorkflowStep step={1} title="Wijzigingen maken" color="var(--color-primary)">
            Pas code aan in <code>backend/</code> of <code>frontend/sites/</code>.
            Test lokaal via de dev-server (<code>vite dev</code>) of de lokale backend (<code>F5</code>).
          </WorkflowStep>
          <WorkflowStep step={2} title="Migratie aanmaken (alleen bij DB-wijziging)" color="var(--color-primary)">
            Voeg een nieuw bestand toe in <code>backend/alembic/versions/</code> met de juiste
            <code> down_revision</code>. Draai lokaal: <code>python -m alembic upgrade head</code>
          </WorkflowStep>
          <WorkflowStep step={3} title="Deployen" color="#22c55e">
            Draai vanuit de projectroot:
            <div style={{ display: 'grid', gap: '6px', marginTop: '10px' }}>
              {[
                ['hpem.ps1 -Build all',   'Alles — frontend + backend + migraties (standaard)'],
                ['hpem.ps1 -Build fe',    'Alleen frontend — sneller bij puur UI-wijzigingen'],
                ['hpem.ps1 -Build be',    'Alleen backend — geen DB-wijzigingen'],
                ['hpem.ps1 -Build be_db', 'Backend + alembic migraties + seed'],
              ].map(([cmd, desc]) => (
                <div key={cmd} style={{
                  display: 'flex', gap: '12px', alignItems: 'baseline',
                  background: 'var(--color-background)', borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                }}>
                  <code style={{ fontSize: '12px', color: 'var(--color-primary)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{cmd}</code>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </WorkflowStep>
          <WorkflowStep step={4} title="Resultaat" color="#22c55e">
            Script commit + push naar GitHub → NAS pull → Docker rebuild → migraties → dist upload → Caddy herstart.
            Na ±30 seconden is alles live op <strong>webheaven.nl</strong>.
          </WorkflowStep>
        </div>
      </Section>

      {/* ── Gebruikers workflow ── */}
      <Section title="Gebruikers workflow">
        <div style={{ display: 'grid', gap: '12px' }}>
          <WorkflowStep step={1} title="Uitnodiging aanmaken" color="var(--color-primary)">
            Ga naar <a href="/admin/users" style={{ color: 'var(--color-primary)' }}>Admin → Gebruikers</a> →
            klik <strong>✉ Uitnodigen</strong> → kies een groep → genereer link.
            De link is 7 dagen geldig en eenmalig bruikbaar.
          </WorkflowStep>
          <WorkflowStep step={2} title="Link versturen" color="var(--color-primary)">
            Kopieer de link (<code>/account/invite/…</code>) en stuur hem via WhatsApp, e-mail of een ander kanaal.
          </WorkflowStep>
          <WorkflowStep step={3} title="Registratie" color="#22c55e">
            Ontvanger opent de link, kiest gebruikersnaam + wachtwoord en maakt een account aan.
            Na registratie is de gebruiker direct ingelogd en lid van de gekozen groep.
          </WorkflowStep>
          <WorkflowStep step={4} title="Beheer" color="#22c55e">
            Groepen en toegang beheer je via <a href="/admin/users" style={{ color: 'var(--color-primary)' }}>Admin → Gebruikers</a>.
            De gebruiker kan zelf van groep wisselen via{' '}
            <a href="/account/groups" style={{ color: 'var(--color-primary)' }}>Account → Groepen</a>.
          </WorkflowStep>
        </div>
      </Section>
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

function WorkflowStep({ step, title, color, children }) {
  return (
    <div style={{
      display: 'flex', gap: '16px',
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '16px 20px',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: color + '22', border: `1px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', fontWeight: 700, color,
      }}>{step}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>{title}</div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{children}</div>
      </div>
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
          {internal ? 'Openen →' : 'Openen ↗'}
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
