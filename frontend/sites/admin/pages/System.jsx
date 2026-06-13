import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { api } from '@core/api.js';

export default function System() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/admin/system/overview')
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  if (error) return (
    <AdminLayout>
      <p style={{ color: 'var(--color-danger)' }}>{error}</p>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>Systeem</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '28px', fontSize: 'var(--font-size-sm)' }}>
        Volledige staat van het platform
      </p>

      {!data ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Laden…</p>
      ) : (
        <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          <EnvironmentCard data={data} />
          <UsersCard data={data} />
          <GroupsCard data={data} />
          <SitesCard data={data} />
          <TablesCard data={data} />
          <RecentCard data={data} />
          <DataStorageCard />
        </div>
      )}
    </AdminLayout>
  );
}

/* ── Cards ──────────────────────────────────────────────────────────────── */

function Card({ title, icon, children, wide }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      gridColumn: wide ? '1 / -1' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: '15px' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, mono, where }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '6px 0', borderBottom: '1px solid var(--color-border)',
      gap: '12px',
    }}>
      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span style={{
          fontSize: '13px', fontWeight: 500,
          fontFamily: mono ? 'var(--font-mono)' : undefined,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{value}</span>
        {where && (
          <span style={{
            fontSize: '11px', color: 'var(--color-text-light)',
            background: 'var(--color-background)', border: '1px solid var(--color-border)',
            borderRadius: '4px', padding: '1px 5px', whiteSpace: 'nowrap', flexShrink: 0,
          }}>{where}</span>
        )}
      </div>
    </div>
  );
}

function EnvironmentCard({ data }) {
  return (
    <Card title="Omgeving" icon="⚙">
      <Row label="Environment"     value={data.environment}    where=".env → ENVIRONMENT" />
      <Row label="Backend versie"  value={data.backend_version} />
      <Row label="DB revisie"      value={data.db_revision}   mono where="alembic upgrade head" />
      <Row label="Database bestand" value={data.database_file} mono where=".env → DATABASE_URL" />
      <Row label="Music map"       value={data.music_dir}     mono where=".env → MUSIC_DIR" />
      <Row label="Sentry"          value={data.sentry_enabled ? `actief (${data.sentry_min_level}+)` : 'uitgeschakeld'} where=".env → SENTRY_DSN" />
    </Card>
  );
}

function UsersCard({ data }) {
  const { total, active, inactive } = data.users;
  return (
    <Card title="Gebruikers" icon="◉">
      <Row label="Totaal"     value={total} />
      <Row label="Actief"     value={active} />
      <Row label="Inactief"   value={inactive} where="admin → Gebruikers" />
    </Card>
  );
}

function GroupsCard({ data }) {
  return (
    <Card title="Groepen" icon="◎">
      {data.groups.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Geen groepen</p>
      ) : (
        data.groups.map(g => (
          <Row key={g.id} label={g.name} value={`${g.members} leden`} where="admin → Groepen" />
        ))
      )}
    </Card>
  );
}

function SitesCard({ data }) {
  return (
    <Card title="Sites" icon="◫">
      {data.sites.map(s => (
        <div key={s.slug} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 0', borderBottom: '1px solid var(--color-border)', gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '15px' }}>{s.icon || '◈'}</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>{s.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{s.module}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <Chip active={s.is_active} label={s.is_active ? 'actief' : 'inactief'} />
            {s.restricted && <Chip label="beperkt" color="var(--color-warning, #e6a817)" />}
          </div>
        </div>
      ))}
      <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '8px' }}>
        Beheer via admin → Sites
      </div>
    </Card>
  );
}

function TablesCard({ data }) {
  const entries = Object.entries(data.tables).sort((a, b) => b[1] - a[1]);
  const max = entries.length ? entries[0][1] : 1;
  return (
    <Card title="Databasetabellen" icon="▤">
      {entries.map(([table, count]) => (
        <div key={table} style={{ padding: '5px 0', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{table}</span>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>{count.toLocaleString('nl-NL')}</span>
          </div>
          <div style={{ height: '3px', background: 'var(--color-border)', borderRadius: '2px' }}>
            <div style={{
              height: '100%', borderRadius: '2px',
              background: 'var(--color-primary)',
              width: `${max > 0 ? (count / max) * 100 : 0}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      ))}
    </Card>
  );
}

function RecentCard({ data }) {
  return (
    <Card title="Recente activiteit" icon="◷" wide>
      <div style={{ display: 'grid', gap: '6px' }}>
        {data.recent_audit.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Geen recente activiteit</p>
        ) : (
          data.recent_audit.map((e, i) => (
            <div key={i} style={{
              display: 'flex', gap: '12px', alignItems: 'center',
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-background)',
            }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-light)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                {new Date(e.created_at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
              <code style={{
                fontSize: '12px', background: 'var(--color-surface)',
                padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
              }}>{e.action}</code>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{e.site}</span>
              {e.user_id && (
                <span style={{ fontSize: '11px', color: 'var(--color-text-light)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                  {e.user_id.slice(0, 8)}…
                </span>
              )}
            </div>
          ))
        )}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '10px' }}>
        Volledige history via admin → Audit log
      </div>
    </Card>
  );
}

const DB_USER_ROWS = [
  { label: 'username, email, locale',              where: 'users',            note: 'Basisprofiel' },
  { label: 'active_group_id',                      where: 'users',            note: 'Globale actieve groep' },
  { label: 'pref_group_dontforget',                where: 'users',            note: 'Voorkeurs-groep DontForget' },
  { label: 'pref_group_mixmusic',                  where: 'users',            note: 'Voorkeurs-groep MixMusic' },
  { label: 'pref_group_tournix',                   where: 'users',            note: 'Voorkeurs-groep Tournix' },
  { label: 'theme_id, language',                   where: 'user_preferences', note: 'Thema en taal' },
  { label: 'df_moment, df_repeat, df_history, df_photo_required', where: 'user_preferences.extra', note: 'DontForget instellingen' },
  { label: 'mm_desktop_layout, mm_mobile_layout',  where: 'user_preferences.extra', note: 'MixMusic layout' },
  { label: 'group_id, role',                       where: 'user_groups',      note: 'Groepslidmaatschappen' },
  { label: 'Taken (group_id = NULL)',              where: 'tasks',            note: 'DontForget — persoonlijk' },
];

const DB_GROUP_ROWS = [
  { label: 'Taken (group_id = …)',                 where: 'tasks',                  note: 'DontForget — gedeeld' },
  { label: 'display_name, rating, genres, moments, play_count', where: 'mixmusic_track_meta', note: 'MixMusic meta per track' },
  { label: 'file_path, position',                  where: 'mixmusic_track_hearts',  note: 'MixMusic favoriete momenten' },
  { label: 'Toernooien (group_id = …)',             where: 'tournix_tournaments',    note: 'Tournix — per groep' },
  { label: 'Poules',                               where: 'tournix_pools',          note: 'Tournix — per toernooi' },
  { label: 'Teams, velden, wedstrijden',            where: 'tournix_teams / fields / matches', note: 'Tournix — per toernooi' },
  { label: 'Standen snapshots',                    where: 'tournix_snapshots',      note: 'Tournix — per ronde' },
  { label: 'Voorspellingen (user_id)',              where: 'tournix_predictions',    note: 'Tournix — per gebruiker' },
];

const LS_ROWS = [
  { label: 'hp_token',           note: 'JWT access token',                    scope: 'alle sites' },
  { label: 'hp_user',            note: '{ id, username } — gecached bij login', scope: 'alle sites' },
  { label: 'hp_theme',           note: 'Actief thema',                         scope: 'alle sites' },
  { label: 'df_moment / df_repeat / df_history', note: 'DontForget instellingen — cache (gesynchroniseerd via DB)', scope: 'DontForget' },
  { label: 'df_photo_required',  note: 'Foto verplicht — cache (gesynchroniseerd via DB)',  scope: 'DontForget' },
  { label: 'mm_desktop_layout',  note: 'Desktop layout — cache (gesynchroniseerd via DB)',  scope: 'MixMusic' },
  { label: 'mm_mobile_layout',   note: 'Mobiel layout — cache (gesynchroniseerd via DB)',   scope: 'MixMusic' },
  { label: 'nk_club / nk_comp',  note: 'Gekozen club en competitie',           scope: 'NKHockey' },
  { label: 'nk_form / nk_played / nk_focus', note: 'Weergave-instellingen',   scope: 'NKHockey' },
  { label: 'nk_sim_count',       note: 'Simulatieaantal',                      scope: 'NKHockey' },
  { label: 'nk_disclaimer_seen', note: 'Disclaimer gezien',                    scope: 'NKHockey' },
];

function DataStorageCard() {
  const subHeader = (label) => (
    <div style={{
      fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: 'var(--color-text-light)', margin: '14px 0 6px',
    }}>{label}</div>
  );

  const dataRow = (key, col1, col2, col3) => (
    <div key={key} style={{
      display: 'grid', gridTemplateColumns: '2fr 1.4fr 2fr',
      gap: '8px', padding: '5px 0', borderBottom: '1px solid var(--color-border)',
      alignItems: 'baseline',
    }}>
      <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col1}</span>
      <span style={{ fontSize: '11px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '1px 5px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', justifySelf: 'start' }}>{col2}</span>
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{col3}</span>
    </div>
  );

  return (
    <Card title="Data &amp; instellingen" icon="◈" wide>
      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px', lineHeight: 1.5 }}>
        Overzicht van wat per gebruiker of groep wordt opgeslagen, en waar.
      </p>

      {subHeader('Database — per gebruiker')}
      {DB_USER_ROWS.map((r, i) => dataRow(i, r.label, r.where, r.note))}

      {subHeader('Database — per groep')}
      {DB_GROUP_ROWS.map((r, i) => dataRow('g' + i, r.label, r.where, r.note))}

      <p style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '6px' }}>
        Globaal (niet per user of groep): mixmusic_genres, tournix_clubs, changelog, roadmap_items.
      </p>

      {subHeader('localStorage — per browser / apparaat')}
      <div style={{
        display: 'grid', gridTemplateColumns: '2fr 1.4fr 2fr',
        gap: '8px', padding: '5px 0', borderBottom: '1px solid var(--color-border)',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-light)' }}>Sleutel</span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-light)' }}>Site</span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-light)' }}>Omschrijving</span>
      </div>
      {LS_ROWS.map((r, i) => dataRow('ls' + i, r.label, r.scope, r.note))}

      <p style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '8px' }}>
        localStorage is apparaatgebonden — niet gesynchroniseerd tussen browsers of gebruikers.
      </p>
    </Card>
  );
}

function Chip({ label, active, color }) {
  const bg = active === undefined
    ? (color || 'var(--color-text-muted)')
    : active ? 'var(--color-success, #22c55e)' : 'var(--color-text-light)';
  return (
    <span style={{
      fontSize: '11px', padding: '2px 7px', borderRadius: '99px',
      background: bg + '22', color: bg,
      border: `1px solid ${bg}44`, fontWeight: 500,
    }}>{label}</span>
  );
}
