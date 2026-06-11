import { useState, useEffect } from 'react';
import AccountLayout from '../AccountLayout.jsx';
import { api } from '@core/api.js';

export default function GroupsPage() {
  const [me,        setMe]        = useState(null);
  const [error,     setError]     = useState('');
  const [switching, setSwitching] = useState(false);

  function load() {
    api.get('/api/auth/me').then(setMe).catch(e => setError(e.message));
  }
  useEffect(() => { load(); }, []);

  async function switchGroup(slug) {
    setSwitching(true);
    try {
      await api.patch('/api/auth/me/active-group', { group_slug: slug });
      load();
      window.dispatchEvent(new CustomEvent('groupchange'));
    } catch(e) { setError(e.message); }
    finally { setSwitching(false); }
  }

  const activeSlug = me?.active_group ?? null;

  return (
    <AccountLayout title="Groepen">
      {error && <p style={{ color: 'var(--color-danger, #ef4444)', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 28, lineHeight: 1.6 }}>
        De actieve groep bepaalt welke gedeelde data je ziet in de apps.
        Wissel hier om te schakelen tussen persoonlijk en gedeeld.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <GroupCard
          name="Persoonlijk"
          slug={null}
          description="Alleen jouw eigen data — niet gedeeld"
          isActive={activeSlug === null}
          onSwitch={() => switchGroup(null)}
          switching={switching}
        />
        {me?.group_details?.map(gd => (
          <GroupCard
            key={gd.slug}
            name={gd.slug}
            slug={gd.slug}
            description={`${gd.member_count} lid${gd.member_count !== 1 ? 'en' : ''}`}
            isActive={activeSlug === gd.slug}
            onSwitch={() => switchGroup(gd.slug)}
            switching={switching}
          />
        ))}
      </div>
    </AccountLayout>
  );
}

function GroupCard({ name, description, isActive, onSwitch, switching }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius-lg, 12px)',
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
      transition: 'border-color 0.15s',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          {name}
          {isActive && (
            <span style={{
              fontSize: 11, color: 'var(--color-primary)',
              background: 'var(--color-primary-light)', padding: '2px 8px',
              borderRadius: 20, fontWeight: 500,
            }}>
              Actief
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>{description}</div>
      </div>
      {!isActive && (
        <button
          onClick={onSwitch}
          disabled={switching}
          style={{
            padding: '6px 14px', fontSize: 13, fontWeight: 500,
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text)',
            cursor: switching ? 'default' : 'pointer',
            opacity: switching ? 0.6 : 1, fontFamily: 'inherit',
          }}
        >
          Activeer
        </button>
      )}
    </div>
  );
}
