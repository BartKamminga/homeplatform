import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { api } from '@core/api.js';

/* ── Static data map ─────────────────────────────────────────────────────── */

const DB_USER_ROWS = [
  { label: 'username, email, locale',                              where: 'users',                  note: 'Basisprofiel' },
  { label: 'active_group_id',                                      where: 'users',                  note: 'Globale actieve groep' },
  { label: 'pref_group_dontforget',                                where: 'users',                  note: 'Voorkeurs-groep DontForget' },
  { label: 'pref_group_mixmusic',                                  where: 'users',                  note: 'Voorkeurs-groep MixMusic' },
  { label: 'pref_group_tournix',                                   where: 'users',                  note: 'Voorkeurs-groep Tournix' },
  { label: 'theme_id, language',                                   where: 'user_preferences',       note: 'Thema en taal' },
  { label: 'df_moment, df_repeat, df_history, df_photo_required',  where: 'user_preferences.extra', note: 'DontForget instellingen' },
  { label: 'mm_mobile_layout',                                      where: 'user_preferences.extra', note: 'MixMusic mobiele layout' },
  { label: 'mm_sort, mm_filter_genre, mm_filter_rating, mm_filter_hearts', where: 'user_preferences.extra', note: 'MixMusic filterinstellingen' },
  { label: 'mm_show_play_count, mm_show_hearts, mm_show_rating, mm_show_moments, mm_show_ext', where: 'user_preferences.extra', note: 'MixMusic weergaveopties tracklist' },
  { label: 'mm_resume_server',                                      where: 'user_preferences.extra', note: 'MixMusic laatste track + positie (cross-device sync)' },
  { label: 'rm_site, rm_status, rm_priority, rm_last_site',        where: 'user_preferences.extra', note: 'Roadmap filterinstellingen' },
  { label: 'group_id, role',                                       where: 'user_groups',            note: 'Groepslidmaatschappen' },
  { label: 'Taken (group_id = NULL)',                              where: 'tasks',                  note: 'DontForget — persoonlijk' },
];

const DB_GROUP_ROWS = [
  { label: 'Taken (group_id = …)',                                 where: 'tasks',                         note: 'DontForget — gedeeld' },
  { label: 'display_name, rating, genres, moments, play_count',    where: 'mixmusic_track_meta',           note: 'MixMusic meta per track' },
  { label: 'file_path, position',                                  where: 'mixmusic_track_hearts',         note: 'MixMusic favoriete momenten' },
  { label: 'Toernooien (group_id = …)',                            where: 'tournix_tournaments',           note: 'Tournix — per groep' },
  { label: 'Poules',                                               where: 'tournix_pools',                 note: 'Tournix — per toernooi' },
  { label: 'Teams, velden, wedstrijden',                           where: 'tournix_teams / fields / matches', note: 'Tournix — per toernooi' },
  { label: 'Standen snapshots',                                    where: 'tournix_snapshots',             note: 'Tournix — per ronde' },
  { label: 'Voorspellingen (user_id)',                             where: 'tournix_predictions',           note: 'Tournix — per gebruiker' },
];

const DB_GLOBAL_ROWS = [
  { label: 'site, version, title, description',            where: 'changelog',      note: 'Platform changelog' },
  { label: 'title, status, priority, notes',               where: 'roadmap_items',  note: 'Roadmap backlog' },
  { label: 'name, abbreviation, city, color',              where: 'tournix_clubs',  note: 'Tournix clubreferentie' },
  { label: 'name',                                         where: 'mixmusic_genres', note: 'MixMusic genres' },
  { label: 'url, title, status, progress_log, output_path', where: 'download_jobs', note: 'Beatload — download queue' },
];

const LS_ROWS = [
  { label: 'hp_token',                           note: 'JWT access token',                                scope: 'alle sites' },
  { label: 'hp_user',                            note: '{ id, username } — gecached bij login',           scope: 'alle sites' },
  { label: 'hp_theme',                           note: 'Actief thema',                                    scope: 'alle sites' },
  { label: 'df_moment / df_repeat / df_history', note: 'DontForget instellingen — cache (via DB)',        scope: 'DontForget' },
  { label: 'df_photo_required',                  note: "Foto verplicht — cache (via DB)",                 scope: 'DontForget' },
  { label: 'mm_mobile_layout',                   note: 'Mobiele layout — cache (via DB)',                 scope: 'MixMusic' },
  { label: 'mm_sort / mm_filter_genre / mm_filter_rating / mm_filter_hearts', note: 'Filterinstellingen — cache (via DB)', scope: 'MixMusic' },
  { label: 'mm_show_play_count / mm_show_hearts / mm_show_rating / mm_show_moments / mm_show_ext', note: 'Weergaveopties tracklist — cache (via DB)', scope: 'MixMusic' },
  { label: 'mm_resume', note: 'Laatste track + positie — lokale cache (gesynchroniseerd via mm_resume_server)', scope: 'MixMusic' },
  { label: 'nk_club / nk_comp',                  note: 'Gekozen club en competitie',                     scope: 'NKHockey' },
  { label: 'nk_form / nk_played / nk_focus',     note: 'Weergave-instellingen',                          scope: 'NKHockey' },
  { label: 'nk_sim_count',                       note: 'Simulatieaantal',                                scope: 'NKHockey' },
  { label: 'nk_disclaimer_seen',                 note: 'Disclaimer gezien',                              scope: 'NKHockey' },
  { label: 'rm_site / rm_status / rm_priority / rm_last_site', note: 'Roadmap filters — cache (via DB)', scope: 'Admin / Roadmap' },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function SubHeader({ label }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: 'var(--color-text-light)', margin: '20px 0 8px',
    }}>{label}</div>
  );
}

function DataRow({ col1, col2, col3, count }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '2fr 1.4fr 2fr auto',
      gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--color-border)',
      alignItems: 'baseline',
    }}>
      <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col1}</span>
      <span style={{ fontSize: '11px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '1px 5px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', justifySelf: 'start' }}>{col2}</span>
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{col3}</span>
      {count != null ? (
        <span style={{ fontSize: '11px', color: 'var(--color-text-light)', fontFamily: 'var(--font-mono)', justifySelf: 'end', whiteSpace: 'nowrap' }}>
          {count.toLocaleString('nl-NL')} rijen
        </span>
      ) : <span />}
    </div>
  );
}

function ColHeader() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '2fr 1.4fr 2fr auto',
      gap: '8px', padding: '4px 0 6px', borderBottom: '1px solid var(--color-border)',
    }}>
      {['Veld / sleutel', 'Tabel / locatie', 'Omschrijving', ''].map((h, i) => (
        <span key={i} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-light)' }}>{h}</span>
      ))}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function DataStorage() {
  const [tables, setTables] = useState({});
  const [paths, setPaths] = useState({});

  useEffect(() => {
    api.get('/api/admin/system/overview')
      .then(d => {
        setTables(d.tables ?? {});
        setPaths({
          download_dir:         d.download_dir ?? null,
          beatportdl_config_dir: d.beatportdl_config_dir ?? null,
          nas_host:             d.nas_host ?? null,
          nas_path:             d.nas_path ?? null,
          nas_url:              d.nas_url  ?? null,
        });
      })
      .catch(() => {});
  }, []);

  const cnt = (table) => {
    const parts = table.split(' / ');
    if (parts.length > 1) return null;
    return tables[table] != null ? tables[table] : null;
  };

  return (
    <AdminLayout>
      <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>Data &amp; instellingen</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '28px', fontSize: 'var(--font-size-sm)' }}>
        Overzicht van wat per gebruiker, groep of apparaat wordt opgeslagen, en in welke tabel.
      </p>

      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: '20px 24px',
      }}>
        <ColHeader />

        <SubHeader label="Database — per gebruiker" />
        {DB_USER_ROWS.map((r, i) => (
          <DataRow key={i} col1={r.label} col2={r.where} col3={r.note} count={cnt(r.where)} />
        ))}

        <SubHeader label="Database — per groep" />
        {DB_GROUP_ROWS.map((r, i) => (
          <DataRow key={i} col1={r.label} col2={r.where} col3={r.note} count={cnt(r.where)} />
        ))}

        <SubHeader label="Database — globaal" />
        {DB_GLOBAL_ROWS.map((r, i) => (
          <DataRow key={i} col1={r.label} col2={r.where} col3={r.note} count={cnt(r.where)} />
        ))}

        <SubHeader label="localStorage — per browser / apparaat" />
        {LS_ROWS.map((r, i) => (
          <DataRow key={i} col1={r.label} col2={r.scope} col3={r.note} count={null} />
        ))}
        <p style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '10px' }}>
          localStorage is apparaatgebonden — niet gesynchroniseerd tussen browsers of gebruikers.
        </p>

        <SubHeader label="Paden — server" />
        <DataRow col1="DOWNLOAD_DIR" col2={paths.download_dir ?? '—'} col3="Bestemmingsmap voor Beatload-downloads (binnen Docker-container)" count={null} />
        <DataRow col1="BEATPORTDL_CONFIG_DIR" col2={paths.beatportdl_config_dir ?? '—'} col3="Optionele config-map voor beatportdl (leeg = niet ingesteld)" count={null} />

        <SubHeader label="Paden — NAS" />
        <DataRow col1="NAS_HOST" col2={paths.nas_host ?? '—'} col3="IP-adres of hostnaam van de NAS" count={null} />
        <DataRow col1="NAS_PATH" col2={paths.nas_path ?? '—'} col3="Bestandspad op de NAS waar het project staat" count={null} />
        <DataRow col1="NAS_URL"  col2={paths.nas_url  ?? '—'} col3="Web-URL van de NAS-interface" count={null} />
      </div>
    </AdminLayout>
  );
}
