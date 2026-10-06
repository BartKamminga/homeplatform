import AdminLayout from '../AdminLayout.jsx';

export default function Workflows() {
  return (
    <AdminLayout>
      <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>Workflows</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '28px', fontSize: 'var(--font-size-sm)' }}>
        Step-by-step explanation of the standard processes within the platform.
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
              { status: 'on_acc',      color: '#f97316',                 label: 'on_acc' },
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
              { status: 'idea',        color: 'var(--color-text-muted)', desc: 'New wish or task — in the backlog, not picked up yet.' },
              { status: 'analyzed',    color: '#8b5cf6',                 desc: 'Impact, risk and scope are filled in — ready for prioritisation.' },
              { status: 'pick_up',     color: '#0ea5e9',                 desc: 'Explicitly prioritised — picked up first in the next session.' },
              { status: 'in_progress', color: 'var(--color-primary)',    desc: 'Actively being worked on — code in development.' },
              { status: 'ready',       color: 'var(--color-warning)',    desc: 'Code is ready — pushed to develop, not yet tested on acc.' },
              { status: 'on_acc',      color: '#f97316',                 desc: 'Live on the acceptance environment (:8081) — tested, waiting for the prod deploy.' },
              { status: 'deploying',   color: 'var(--color-danger)',     desc: 'Merge to main in progress — the GitHub Actions pipeline deploys to prod.' },
              { status: 'done',        color: 'var(--color-success)',    desc: 'Live on prod (webheaven.nl) — changelog entry created automatically.' },
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
          <WorkflowStep step={1} title="Make changes on develop" color="var(--color-primary)">
            Work on the <code>develop</code> branch. Change code in <code>backend/</code> or <code>frontend/sites/</code>.
            Test locally via the dev server (<code>vite dev</code>) or the local backend (<code>F5</code>).
          </WorkflowStep>
          <WorkflowStep step={2} title="Create a migration (DB changes only)" color="var(--color-primary)">
            Add a new file in <code>backend/alembic/versions/</code> with the correct
            <code> down_revision</code>. The pipeline runs it automatically, right after a database snapshot.
          </WorkflowStep>
          <WorkflowStep step={3} title="Push to develop → test on acc" color="#f59e0b">
            <code>git push origin develop</code> — GitHub Actions builds and deploys automatically to the
            acceptance environment on <strong>G4 (:8081)</strong>.
            Test the changes here before going to production.
          </WorkflowStep>
          <WorkflowStep step={4} title="Merge to main → live on prod" color="#22c55e">
            <code>git merge develop &amp;&amp; git push origin main</code> — G4 builds the images and pushes them to GHCR,
            prod (g5) pulls them: database snapshot → backend → migrations → frontend.
            A few minutes later everything is live on <strong>webheaven.nl</strong>.
          </WorkflowStep>
        </div>
      </Section>

      {/* ── Gebruikers workflow ── */}
      <Section title="User workflow">
        <div style={{ display: 'grid', gap: '12px' }}>
          <WorkflowStep step={1} title="Create an invite" color="var(--color-primary)">
            Go to <a href="/admin/users" style={{ color: 'var(--color-primary)' }}>Admin → Users</a> →
            click <strong>✉ Invite</strong> → choose a group → generate a link.
            The link is valid for 7 days and can be used once.
          </WorkflowStep>
          <WorkflowStep step={2} title="Send the link" color="var(--color-primary)">
            Copy the link (<code>/account/invite/…</code>) and send it via WhatsApp, e-mail or another channel.
          </WorkflowStep>
          <WorkflowStep step={3} title="Registration" color="#22c55e">
            The recipient opens the link, chooses a username + password and creates an account.
            After registering, the user is logged in straight away and is a member of the chosen group.
          </WorkflowStep>
          <WorkflowStep step={4} title="Management" color="#22c55e">
            Manage groups and access via <a href="/admin/users" style={{ color: 'var(--color-primary)' }}>Admin → Users</a>.
            Users can switch groups themselves via{' '}
            <a href="/account/groups" style={{ color: 'var(--color-primary)' }}>Account → Groups</a>.
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
