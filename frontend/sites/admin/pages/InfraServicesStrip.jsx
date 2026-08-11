import { useEffect, useState, useCallback } from 'react';
import { api } from '@core/api.js';

export default function InfraServicesStrip() {
  const [data,    setData]    = useState(null);
  const [status,  setStatus]  = useState(null);
  const [confirm, setConfirm] = useState(null); // 'runner'

  const load = useCallback(() => {
    api.get('/api/admin/infra/services').then(setData).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doRestartRunner() {
    setConfirm(null); setStatus(null);
    try {
      await api.post('/api/admin/infra/services/runner/restart', {});
      setStatus({ type: 'ok', msg: 'Restart ingepland — runner herstart binnen ~1 min.' });
      load();
    } catch (e) {
      setStatus({ type: 'err', msg: e.message });
    }
  }

  async function doToggleCron() {
    setStatus(null);
    try {
      const r = await api.post('/api/admin/infra/services/cron/toggle', {});
      setStatus({ type: 'ok', msg: r.enabled ? 'Backup-cron ingeschakeld.' : 'Backup-cron uitgeschakeld.' });
      load();
    } catch (e) {
      setStatus({ type: 'err', msg: e.message });
    }
  }

  if (!data) return null;

  const runner = data.runner;
  const cron   = data.backup_cron;

  const runnerColor = runner.status === 'online' ? '#22c55e' : runner.status === 'offline' ? '#dc2626' : '#94a3b8';
  const checkedAgo  = runner.checked_at ? Math.round((Date.now() - new Date(runner.checked_at)) / 1000) : null;

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={labelStyle}>Host services</span>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {/* Runner card */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>GitHub Actions Runner</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 700, background: runnerColor + '22', color: runnerColor, border: `1px solid ${runnerColor}44` }}>{runner.status}</span>
                  {runner.restart_pending && <span style={{ fontSize: 10, color: '#ea580c' }}>⏳ restart wacht…</span>}
                </div>
                {checkedAgo !== null && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Gecontroleerd: {checkedAgo < 60 ? `${checkedAgo}s geleden` : `${Math.round(checkedAgo / 60)}m geleden`}
                    {runner.service && runner.service !== 'unknown' && <span style={{ fontFamily: 'monospace', marginLeft: 6, fontSize: 10, color: 'var(--color-text-muted)' }}>{runner.service}</span>}
                  </div>
                )}
                {checkedAgo === null && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>services-watcher.sh niet actief</div>}
              </div>
              <button
                onClick={() => setConfirm('runner')}
                disabled={runner.restart_pending}
                style={{ ...btn, opacity: runner.restart_pending ? 0.4 : 1 }}
              >
                Herstart
              </button>
            </div>
          </div>

          {/* Backup cron card */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>Backup cron (03:00 dagelijks)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 700,
                    background: cron.enabled ? '#22c55e22' : '#dc262622',
                    color: cron.enabled ? '#22c55e' : '#dc2626',
                    border: `1px solid ${cron.enabled ? '#22c55e' : '#dc2626'}44` }}>
                    {cron.enabled ? 'ingeschakeld' : 'uitgeschakeld'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Laatste backup: {cron.last_backup ?? '—'}
                </div>
              </div>
              <button onClick={doToggleCron} style={btn}>
                {cron.enabled ? 'Uitzetten' : 'Inschakelen'}
              </button>
            </div>
          </div>
        </div>

        {status && (
          <div style={{ marginTop: 10, fontSize: 12, padding: '8px 12px', borderRadius: 8,
            background: status.type === 'ok' ? '#dcfce7' : '#fee2e2',
            color:      status.type === 'ok' ? '#166534' : '#991b1b' }}>
            {status.msg}
          </div>
        )}
      </div>

      {confirm === 'runner' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 16, padding: '28px 24px', maxWidth: 380, width: '100%' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Runner herstarten?</h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              De services-watcher.sh herstelt de runner via <code style={{ fontFamily: 'monospace' }}>systemctl restart</code>. Lopende jobs worden afgebroken.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={doRestartRunner} style={{ ...btn, flex: 1, background: '#dc2626', color: '#fff', border: 'none' }}>Ja, herstart</button>
              <button onClick={() => setConfirm(null)} style={{ ...btn, flex: 1 }}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--color-text-muted)' };
const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '14px 16px', flex: '1 1 280px' };
const btn  = { padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-text)', flexShrink: 0 };
