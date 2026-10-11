import { useEffect, useState } from 'react';
import { api } from '@core/api.js';
import { getOidcProviders, readOidcFragment } from '@core/oidc.js';
import { useConfirm } from '@components/ConfirmDialog.jsx';

// Gekoppelde logins (item 1271): Google/Microsoft aan dit account koppelen,
// zodat je daarna zonder wachtwoord kunt inloggen. Koppelen gaat via een
// fetch (met login) die de URL van de provider teruggeeft.
export default function LinkedLoginsSection({ card }) {
  const [providers, setProviders] = useState([]);
  const [linked, setLinked]       = useState(null);
  const [message, setMessage]     = useState('');
  const [error, setError]         = useState('');
  const [confirmUnlink, confirmUnlinkDialog] = useConfirm();

  useEffect(() => {
    const result = readOidcFragment();
    if (result.linked) setMessage(`${result.linked === 'microsoft' ? 'Microsoft' : 'Google'} account linked`);
    if (result.error) setError(result.error);
    getOidcProviders().then(setProviders);
    load();
  }, []);

  function load() {
    api.get('/api/auth/identities').then(setLinked).catch(e => setError(e.message));
  }

  async function link(provider) {
    setError(''); setMessage('');
    try {
      const { url } = await api.post(`/api/auth/oidc/${provider}/link`, { next: '/account/profile' });
      window.location.href = url;
    } catch (e) { setError(e.message); }
  }

  async function unlink(row) {
    if (!(await confirmUnlink(`Unlink ${labelOf(row.provider)}?`))) return;
    try { await api.delete(`/api/auth/identities/${row.id}`); load(); }
    catch (e) { setError(e.message); }
  }

  const labelOf = id => providers.find(p => p.id === id)?.label || id;
  if (!providers.length && !linked?.length) return null;
  const unlinkedProviders = providers.filter(p => !linked?.some(l => l.provider === p.id));

  return (
    <div style={card}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Linked sign-ins</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        Sign in with Google or Microsoft instead of your password.
      </div>

      {linked?.map(row => (
        <div key={row.id} style={rowStyle}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{labelOf(row.provider)}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {row.email || 'no email shared'}
              {row.last_login_at && ` · last used ${new Date(row.last_login_at).toLocaleDateString('en-GB')}`}
            </div>
          </div>
          <button onClick={() => unlink(row)} style={{ ...smallButton, color: 'var(--color-danger, #ef4444)' }}>Unlink</button>
        </div>
      ))}

      {unlinkedProviders.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: linked?.length ? 8 : 0 }}>
          {unlinkedProviders.map(p => (
            <button key={p.id} onClick={() => link(p.id)} style={smallButton}>Link {p.label}</button>
          ))}
        </div>
      )}

      {message && <p style={{ fontSize: 13, color: '#22c55e', margin: '10px 0 0' }}>{message}</p>}
      {error && <p style={{ fontSize: 13, color: 'var(--color-danger, #ef4444)', margin: '10px 0 0' }}>{error}</p>}
      {confirmUnlinkDialog}
    </div>
  );
}

const rowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '9px 12px', borderRadius: 8, marginBottom: 8,
  border: '1px solid var(--color-border)', background: 'var(--color-background)',
};

const smallButton = {
  padding: '6px 12px', fontSize: 13, borderRadius: 6,
  border: '1px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit',
};
