import { useEffect, useState } from 'react';
import Modal, { ModalFooter, BtnPrimary, BtnSecondary } from '@components/Modal.jsx';
import CopyButton from '@components/CopyButton.jsx';
import { api } from '@core/api.js';

// Groepslink (item 1332): een link die iedereen kan gebruiken om lid te worden
// van deze groep, bv. in een WhatsApp-groep. Na aanmelden direct naar de
// gekozen site. Alleen sites waar de groep toegang toe heeft staan in de lijst.
export default function GroupInviteModal({ group, onClose }) {
  const [sites, setSites] = useState([]);
  const [next, setNext]   = useState('/landing/');
  const [link, setLink]   = useState('');
  const [expires, setExpires] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/admin/sites/')
      .then(all => setSites(all.filter(s => s.is_active && s.slug !== 'landing'
        && (!s.allowed_groups.length || s.allowed_groups.includes(group.slug)))))
      .catch(() => {});
  }, [group.slug]);

  async function createLink() {
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/api/auth/invite', { group_slug: group.slug, reusable: true, next });
      setLink(`${window.location.origin}/account/invite/${res.token}`);
      setExpires(new Date(res.expires_at + 'Z').toLocaleDateString());
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={`Invite link — ${group.name}`} onClose={onClose}>
      {!link ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            Anyone with this link can join <strong>{group.name}</strong> with Google, Microsoft or a password.
            Valid for 30 days.
          </p>
          <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 5 }}>
            Start page after sign-up
          </label>
          <select value={next} onChange={e => setNext(e.target.value)} style={{ width: '100%' }}>
            <option value="/landing/">Home</option>
            {sites.map(s => <option key={s.slug} value={`/${s.slug}/`}>{s.name}</option>)}
          </select>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Share this link. It works for multiple people until {expires}.
          </p>
          {/* Zichtbaar veld: kopiëren kan stil falen zonder https */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input readOnly value={link} onFocus={e => e.target.select()}
              style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
            <CopyButton text={link} icon="Copy" style={{ padding: '8px 14px', fontSize: 13 }} />
          </div>
        </>
      )}
      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 12 }}>{error}</p>}
      <ModalFooter>
        <BtnSecondary onClick={onClose}>Close</BtnSecondary>
        {!link && <BtnPrimary onClick={createLink} disabled={saving}>{saving ? 'Creating…' : 'Create link'}</BtnPrimary>}
      </ModalFooter>
    </Modal>
  );
}
