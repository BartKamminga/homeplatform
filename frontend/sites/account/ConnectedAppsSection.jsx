import { useEffect, useState } from 'react';
import { api } from '@core/api.js';
import { useConfirm } from '@components/ConfirmDialog.jsx';

// Gekoppelde apps (item 1310): koppelingen met diensten buiten HomePlatform, per gebruiker.
// Nu Strava (VBT uploadt je ritten); koppelen gaat via Strava en komt hier terug (?strava=...).
const RESULT = {
  connected: { ok: true, text: 'Strava connected - VBT can now upload your rides' },
  denied: { ok: false, text: 'Strava was not connected (permission denied)' },
  scope: { ok: false, text: 'Strava connected without upload permission - connect again and keep "Upload your activities" checked' },
};

export default function ConnectedAppsSection({ card }) {
  const [strava, setStrava]   = useState(null);
  const [busy, setBusy]       = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError]     = useState('');
  const [confirmDisconnect, confirmDialog] = useConfirm();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('strava');
    if (result && RESULT[result]) {
      setMessage(RESULT[result]);
      params.delete('strava');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
    }
    load();
  }, []);

  function load() {
    api.get('/api/vbt/strava').then(setStrava).catch(() => setStrava({ configured: false, connected: false }));
  }

  async function connect() {
    setError(''); setMessage(null); setBusy(true);
    try {
      const { url } = await api.get('/api/vbt/strava/connect?next=' + encodeURIComponent('/account/profile'));
      window.location.href = url;
    } catch (e) { setError(e.message); setBusy(false); }
  }

  async function disconnect() {
    if (!(await confirmDisconnect('Disconnect Strava? VBT can no longer upload your rides.'))) return;
    setError(''); setBusy(true);
    try { await api.delete('/api/vbt/strava'); setMessage({ ok: true, text: 'Strava disconnected' }); load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (!strava || (!strava.configured && !strava.connected)) return null;

  return (
    <div style={card}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Connected apps</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        Services outside HomePlatform that work with your account.
      </div>

      <div style={rowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={badge}>S</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Strava</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {strava.connected
                ? <>
                    {strava.athleteName || 'Connected'}
                    {strava.connectedAt && ` · since ${new Date(strava.connectedAt).toLocaleDateString('en-GB')}`}
                    {' · '}{strava.canUpload ? 'VBT uploads your rides' : 'no upload permission'}
                    {strava.athleteId && <> · <a href={`https://www.strava.com/athletes/${strava.athleteId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>profile</a></>}
                  </>
                : 'Upload your VBT rides to Strava'}
            </div>
          </div>
        </div>
        {strava.connected
          ? <button disabled={busy} onClick={disconnect} style={{ ...smallButton, color: 'var(--color-danger, #ef4444)' }}>Disconnect</button>
          : <button disabled={busy || !strava.configured} onClick={connect} style={stravaButton}>{busy ? 'Opening Strava…' : 'Connect with Strava'}</button>}
      </div>

      {message && <p style={{ fontSize: 13, color: message.ok ? '#22c55e' : 'var(--color-danger, #ef4444)', margin: '10px 0 0' }}>{message.text}</p>}
      {error && <p style={{ fontSize: 13, color: 'var(--color-danger, #ef4444)', margin: '10px 0 0' }}>{error}</p>}
      {confirmDialog}
    </div>
  );
}

const rowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '9px 12px', borderRadius: 8, marginBottom: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
};

const badge = {
  width: 28, height: 28, borderRadius: 6, flexShrink: 0, display: 'grid', placeItems: 'center',
  background: '#fc4c02', color: '#fff', fontWeight: 700, fontSize: 14,
};

const smallButton = {
  padding: '6px 12px', fontSize: 13, borderRadius: 6,
  border: '1px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit',
};

const stravaButton = { ...smallButton, border: '1px solid #fc4c02', background: '#fc4c02', color: '#fff', whiteSpace: 'nowrap' };
