import { useState, useEffect } from 'react';
import AccountLayout from '../AccountLayout.jsx';
import { api } from '@core/api.js';

export default function GroupsPage() {
  const [me,        setMe]        = useState(null);
  const [error,     setError]     = useState('');
  const [switching, setSwitching] = useState(false);
  const [saving,    setSaving]    = useState(false);

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

  async function setAppPref(app, slug) {
    setSaving(true);
    try {
      await api.patch('/api/auth/me/preferences', { [app]: slug || null });
      load();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const activeSlug = me?.active_group ?? null;
  const groups     = me?.group_details ?? [];

  return (
    <AccountLayout title="Groepen">
      {error && <p style={{ color: 'var(--color-danger, #ef4444)', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 28, lineHeight: 1.6 }}>
        De actieve groep bepaalt de standaard gedeelde data. Per app kun je hieronder een eigen voorkeur instellen.
      </p>

      {/* ── Actieve groep ── */}
      <SectionTitle>Actieve groep</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36 }}>
        <GroupCard
          name="Persoonlijk"
          slug={null}
          description="Alleen jouw eigen data — niet gedeeld"
          isActive={activeSlug === null}
          onSwitch={() => switchGroup(null)}
          switching={switching}
        />
        {groups.map(gd => (
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

      {/* ── App voorkeuren ── */}
      {groups.length > 0 && (
        <>
          <SectionTitle>App voorkeuren</SectionTitle>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            Kies per app welke groep je wilt gebruiken, onafhankelijk van de actieve groep hierboven.
          </p>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg, 12px)',
            overflow: 'hidden',
          }}>
            <AppPrefRow
              icon="✅"
              label="DontForget"
              groups={groups}
              value={me?.pref_group_dontforget ?? ''}
              onChange={slug => setAppPref('pref_group_dontforget', slug)}
              saving={saving}
            />
            <AppPrefRow
              icon="🎵"
              label="MixMusic"
              groups={groups}
              value={me?.pref_group_mixmusic ?? ''}
              onChange={slug => setAppPref('pref_group_mixmusic', slug)}
              saving={saving}
              last
            />
          </div>
        </>
      )}
    </AccountLayout>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 12 }}>
      {children}
    </h2>
  );
}

function AppPrefRow({ icon, label, groups, value, onChange, saving, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 20px',
      borderBottom: last ? 'none' : '1px solid var(--color-border)',
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label}</span>
      <select
        disabled={saving}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          fontSize: 13, padding: '5px 10px', borderRadius: 8,
          border: '1px solid var(--color-border)',
          background: 'var(--color-background)',
          color: 'var(--color-text)',
          fontFamily: 'inherit',
          cursor: saving ? 'default' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}
      >
        <option value="">Persoonlijk</option>
        {groups.map(gd => (
          <option key={gd.slug} value={gd.slug}>{gd.slug}</option>
        ))}
      </select>
    </div>
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
