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
  { label: 'fiets_wind_pref_deg',                                   where: 'user_preferences.extra', note: 'Fiets windrichting-voorkeur (graden)' },
  { label: 'fiets_show_breakdown',                                  where: 'user_preferences.extra', note: 'Fiets grafiek met/zonder opbouw (onthouden per sessie)' },
  { label: 'fiets_lat, fiets_lon, fiets_location_label',           where: 'user_preferences.extra', note: 'Fiets locatie-instelling (i.p.v. vast Rotterdam)' },
  { label: 'fiets_temp_weight',                                     where: 'user_preferences.extra', note: 'Fiets gewicht temperatuur vs. wind in score' },
  { label: 'fiets_temp_min, fiets_temp_max',                       where: 'user_preferences.extra', note: 'Fiets comfortband temperatuur' },
  { label: 'fiets_wind_knee_kmh',                                   where: 'user_preferences.extra', note: 'Fiets wind-drempel' },
  { label: 'fiets_weight_night/rain/temp/sun/wind',                 where: 'user_preferences.extra', note: 'Fiets eigen score-gewicht-profiel (debug-pagina)' },
  { label: 'fiets_night_absolute',                                  where: 'user_preferences.extra', note: 'Fiets nacht als absoluut plafond i.p.v. gewogen' },
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
  { label: 'site, version, title, description',            where: 'changelog',        note: 'Platform changelog' },
  { label: 'title, status, priority, owner, notes',        where: 'roadmap_items',    note: 'Roadmap backlog' },
  { label: 'item_id, username, action, changes',           where: 'roadmap_history',  note: 'Roadmap wijzigingshistorie' },
  { label: 'name, abbreviation, city, color',              where: 'tournix_clubs',  note: 'Tournix clubreferentie (legacy, niet meer gebruikt door Poulebord)' },
  { label: 'name, friendly_name, logo_url, district',      where: 'hockey_clubs',   note: 'Hockey Discovery clubs — bron van de Poulebord-clubselector (via hockey-vanger scan)' },
  { label: 'name',                                         where: 'mixmusic_genres', note: 'MixMusic genres' },
  { label: 'url, title, status, progress_log, output_path', where: 'download_jobs', note: 'BeatCrades — download queue' },
  { label: 'name, slug, season, published',                where: 'hockey_publications',      note: 'Hockey Inside — publicaties (user-beheerd)' },
  { label: 'name, order',                                  where: 'hockey_publication_tags',  note: 'Hockey Inside — publicatie-tags' },
  { label: 'publication_id, competition_id, label, order, scan_profile', where: 'hockey_publication_comps', note: 'Hockey Inside — competitie-koppelingen (scan_profile: manual/active, stuurt de auto-scan)' },
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
  { label: 'pb_query_pins', note: 'Gepinde query-templates (ranglijst / rondetopscorers per niveau-tag)', scope: 'Poulebord' },
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

/* ── Architecture + deploy components ───────────────────────────────────── */

function SectionCard({ title, subtitle, children }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginTop: '16px',
    }}>
      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: subtitle ? '4px' : '16px' }}>{title}</div>
      {subtitle && <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>{subtitle}</p>}
      {children}
    </div>
  );
}

function ArchBox({ label, sublabel, color = 'var(--color-text)', dashed = false, small = false, active = false }) {
  return (
    <div style={{
      border: `${active ? '2px' : '1.5px'} ${dashed ? 'dashed' : 'solid'} ${color}`,
      borderRadius: '8px',
      padding: small ? '5px 12px' : '8px 16px',
      textAlign: 'center',
      color,
      fontSize: small ? '11px' : '12px',
      fontFamily: 'var(--font-mono)',
      lineHeight: 1.4,
      width: '100%',
      background: active ? `${color}18` : 'transparent',
    }}>
      {label}
      {active && !small && (
        <span style={{ fontSize: '9px', fontFamily: 'sans-serif', marginLeft: '6px', opacity: 0.8 }}>● actief</span>
      )}
      {sublabel && (
        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'sans-serif', marginTop: '2px' }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

function ConnArrow({ label }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '11px', margin: '3px 0', fontFamily: 'var(--font-mono)' }}>
      ↓{label ? ` ${label}` : ''}
    </div>
  );
}

function EnvRow({ label, note }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px',
      padding: '5px 0', borderBottom: '1px solid var(--color-border)', alignItems: 'baseline',
    }}>
      <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>{label}</span>
      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{note}</span>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function DataStorage() {
  const [tables, setTables] = useState({});
  const [paths, setPaths] = useState({});
  const [beatportProvider, setBeatportProvider] = useState(null);

  useEffect(() => {
    api.get('/api/admin/system/overview')
      .then(d => {
        setTables(d.tables ?? {});
        setBeatportProvider(d.beatport_provider ?? 'binary');
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
        <DataRow col1="DOWNLOAD_DIR" col2={paths.download_dir ?? '—'} col3="Bestemmingsmap voor BeatCrades-downloads (binnen Docker-container)" count={null} />
        <DataRow col1="BEATPORTDL_CONFIG_DIR" col2={paths.beatportdl_config_dir ?? '—'} col3="Optionele config-map voor beatportdl (leeg = niet ingesteld)" count={null} />

        <SubHeader label="Paden — NAS" />
        <DataRow col1="NAS_HOST" col2={paths.nas_host ?? '—'} col3="IP-adres of hostnaam van de NAS" count={null} />
        <DataRow col1="NAS_PATH" col2={paths.nas_path ?? '—'} col3="Bestandspad op de NAS waar het project staat" count={null} />
        <DataRow col1="NAS_URL"  col2={paths.nas_url  ?? '—'} col3="Web-URL van de NAS-interface" count={null} />
      </div>

      {/* ── Download provider architectuur ─────────────────────────────── */}
      <SectionCard
        title="Architectuur — download providers"
        subtitle="De worker praat uitsluitend met de DownloadProvider-interface. Achter die interface zitten drie implementaties — de worker weet niets van binaries, processen of API-calls."
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '220px' }}>
            <ArchBox label="downloader_worker.py" />
          </div>
          <ConnArrow label="get_provider(source)" />
          <div style={{ width: '220px' }}>
            <ArchBox label="DownloadProvider — ABC" />
          </div>
          <ConnArrow />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', width: '100%', maxWidth: '700px', marginTop: '4px' }}>
            {[
              { label: 'BinaryBeatportProvider', implLabel: 'beatportdl subprocess', implSub: '+ directory watcher', color: '#c8961a', header: 'SOURCE=beatport/beatsource\nPROVIDER=binary',  providerKey: 'binary' },
              { label: 'NativeBeatportProvider', implLabel: 'auth → API v4 → dl',   implSub: '+ mutagen tags (fase 2)',  color: '#16a085', header: 'SOURCE=beatport/beatsource\nPROVIDER=native', providerKey: 'native' },
              { label: 'YtdlpProvider',          implLabel: 'yt-dlp subprocess',     implSub: 'real-time output',        color: '#8e44ad', header: 'SOURCE=youtube/\nsoundcloud / auto',           providerKey: null },
            ].map((p) => {
              const isActive = p.providerKey === null
                ? true
                : beatportProvider === p.providerKey;
              return (
                <div key={p.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', opacity: (!isActive && p.providerKey !== null) ? 0.45 : 1 }}>
                  <div style={{ fontSize: '9px', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', whiteSpace: 'pre-line', marginBottom: '2px' }}>
                    {p.header}
                  </div>
                  <ArchBox label={p.label} color={p.color} active={isActive} />
                  <ConnArrow />
                  <ArchBox label={p.implLabel} sublabel={p.implSub} color={p.color} small active={isActive} />
                </div>
              );
            })}
          </div>

          <ConnArrow label="update_job()" />
          <div style={{ width: '180px' }}>
            <ArchBox label="SQLite DB → UI" color="var(--color-text-muted)" dashed />
          </div>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '14px', textAlign: 'center' }}>
          Actieve Beatport-provider: <strong style={{ fontFamily: 'var(--font-mono)' }}>{beatportProvider ?? '…'}</strong>
          {' '}— instelbaar via env var <span style={{ fontFamily: 'var(--font-mono)' }}>BEATPORT_PROVIDER</span> in docker-compose.g4.yml
        </p>
      </SectionCard>

      {/* ── Deploy-omgevingen ───────────────────────────────────────────── */}
      <SectionCard
        title="Deploy-omgevingen"
        subtitle="Lokale ontwikkeling (Windows) en productie op de G4 (HP ProDesk 600 G4 — Ubuntu + Docker)."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
              Lokaal — ontwikkeling
            </div>
            <EnvRow label="Vite dev server"  note="Frontend MPA — elke site eigen port" />
            <EnvRow label="FastAPI uvicorn"  note="Backend op :8000 — F5 launch config in .venv" />
            <EnvRow label="Git branch"       note="develop voor feature-werk, main voor productie" />
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
              G4 — acceptatie (192.168.30.232:8081)
            </div>
            <EnvRow label="Branch"           note="develop → automatisch via GitHub Actions" />
            <EnvRow label="Caddy (Docker)"   note="Poort 8081 — docker-compose.acc.yml" />
            <EnvRow label="Backend (Docker)" note="FastAPI container — homeplatform_backend_acc" />
            <EnvRow label="SQLite"           note="/home/bart/homeplatform-acc/db/homeplatform.sqlite" />
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
              G4 — productie (192.168.30.232:8080)
            </div>
            <EnvRow label="Branch"           note="main → automatisch via GitHub Actions" />
            <EnvRow label="Caddy (Docker)"   note="Poort 8080 / 8443 — docker-compose.g4.yml" />
            <EnvRow label="Backend (Docker)" note="FastAPI container — Dockerfile in /backend" />
            <EnvRow label="SQLite"           note="/home/bart/homeplatform/db/homeplatform.sqlite" />
            <EnvRow label="Downloads"        note="/home/bart/homeplatform/downloads — beatportdl + yt-dlp output" />
            <EnvRow label="Bugsink"          note="Fout-tracking op G4 (poort 8090)" />
            <EnvRow label="Cloudflare Tunnel" note="Externe toegang via cloudflared" />
          </div>
        </div>

        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Deploy-flow — GitHub Actions
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
            {[
              { branch: 'develop', desc: 'push → acc (8081): Vite build + Docker rebuild + migraties' },
              { branch: 'main',    desc: 'push → prod (8080): zelfde flow, live op webheaven.nl' },
            ].map((item) => (
              <div key={item.branch} style={{
                background: 'var(--color-background)', border: '1px solid var(--color-border)',
                borderRadius: '6px', padding: '8px 10px',
              }}>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text)' }}>
                  {item.branch}
                </span>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </AdminLayout>
  );
}
