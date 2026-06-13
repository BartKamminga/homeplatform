import AdminLayout from '../AdminLayout.jsx';

export default function Workflows() {
  return (
    <AdminLayout>
      <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>Workflows</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '28px', fontSize: 'var(--font-size-sm)' }}>
        Stap-voor-stap uitleg van de vaste werkprocessen binnen het platform.
      </p>

      {/* ── Roadmap workflow ── */}
      <Section title="Roadmap workflow">
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: '20px 24px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            flexWrap: 'wrap', marginBottom: '20px',
          }}>
            {[
              { status: 'idea',        color: 'var(--color-text-muted)', label: 'idea' },
              { status: 'analyzed',    color: '#8b5cf6',                 label: 'analyzed' },
              { status: 'pick_up',     color: '#0ea5e9',                 label: 'pick_up' },
              { status: 'in_progress', color: 'var(--color-primary)',    label: 'in_progress' },
              { status: 'ready',       color: 'var(--color-warning)',    label: 'ready' },
              { status: 'deploying',   color: 'var(--color-danger)',     label: 'deploying' },
              { status: 'done',        color: 'var(--color-success)',    label: 'done' },
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
          <div style={{ display: 'grid', gap: '8px' }}>
            {[
              { status: 'idea',        color: 'var(--color-text-muted)', desc: 'Nieuwe wens of taak — staat in de backlog, nog niet opgepakt.' },
              { status: 'analyzed',    color: '#8b5cf6',                 desc: 'Impact, risk en scope zijn ingevuld — klaar voor verdere prioritering.' },
              { status: 'pick_up',     color: '#0ea5e9',                 desc: 'Expliciet geprioriteerd — wordt als eerste opgepakt in de volgende sessie.' },
              { status: 'in_progress', color: 'var(--color-primary)',    desc: 'Wordt actief aan gewerkt — code in ontwikkeling.' },
              { status: 'ready',       color: 'var(--color-warning)',    desc: 'Code is klaar en getest, nog niet gedeployed naar de NAS.' },
              { status: 'deploying',   color: 'var(--color-danger)',     desc: 'Deploy bezig via hpem.ps1 — platform herstart.' },
              { status: 'done',        color: 'var(--color-success)',    desc: 'Live op de NAS — changelog-entry is automatisch aangemaakt.' },
            ].map(({ status, color, desc }) => (
              <div key={status} style={{ display: 'flex', alignItems: 'baseline', gap: '12px', fontSize: '13px' }}>
                <span style={{
                  minWidth: '96px', padding: '1px 8px', borderRadius: '99px', fontSize: '11px',
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
