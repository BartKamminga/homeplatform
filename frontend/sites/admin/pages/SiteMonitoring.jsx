import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { api } from '@core/api.js';

const SITE_LABELS = {
  scrapster: 'Scrapster',
  poulebord: 'Poulebord',
};

export default function SiteMonitoring() {
  const [sites, setSites]         = useState(null);
  const [autoRefresh, setAuto]    = useState(false);
  const [scrapsterCache, setScrapsterCache] = useState(null);
  const intervalRef = useRef(null);

  const load = useCallback(() => {
    api.get('/api/admin/site-stats')
      .then(d => setSites(d.sites || {}))
      .catch(() => {});
    api.get('/api/admin/scrapster-cache-status')
      .then(setScrapsterCache)
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 10000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, load]);

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Site monitoring</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAuto(e.target.checked)} />
            Auto-refresh (10s)
          </label>
          <button onClick={load} style={btnStyle}>↻ Verversen</button>
        </div>
      </div>

      {!sites ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Laden…</p>
      ) : Object.keys(sites).length === 0 ? (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: '40px', textAlign: 'center',
          color: 'var(--color-text-muted)', fontSize: '14px',
        }}>
          Nog geen site-events vastgelegd.
        </div>
      ) : (
        Object.keys(sites).map(site => (
          <SitePanel
            key={site}
            site={site}
            s={sites[site]}
            cacheStatus={site === 'scrapster' ? scrapsterCache : null}
          />
        ))
      )}
    </AdminLayout>
  );
}

function buildHourlySlots(hourlyData) {
  const dataMap = {};
  for (const h of hourlyData) dataMap[h.hour] = h.count;

  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now);
    d.setUTCHours(now.getUTCHours() - (23 - i));
    const key = [
      d.getUTCFullYear(),
      String(d.getUTCMonth() + 1).padStart(2, '0'),
      String(d.getUTCDate()).padStart(2, '0'),
    ].join('-') + ' ' + String(d.getUTCHours()).padStart(2, '0') + ':00:00';
    return {
      hour: key,
      count: dataMap[key] || 0,
      label: d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };
  });
}

function ScrapsterCachePanel({ status, onRefresh }) {
  if (!status) return null;
  const { matches, standings, background } = status;
  const fmtAge = s => s == null ? '—' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`;
  const bgActive  = background.active;
  const bgEnabled = background.enabled;
  const idleMin   = background.idle_s != null ? Math.floor(background.idle_s / 60) : null;

  function handleToggle() {
    api.post('/api/admin/scrapster-cache-status/toggle', {})
      .then(() => onRefresh())
      .catch(() => {});
  }

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '14px 18px', marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>Cache & Background refresh</span>
        <span style={{
          fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
          background: !bgEnabled ? '#f3f4f6' : bgActive ? '#d1fae5' : '#fef3c7',
          color: !bgEnabled ? '#6b7280' : bgActive ? '#065f46' : '#92400e',
        }}>
          {!bgEnabled ? '○ Uitgeschakeld' : bgActive ? '● Actief' : '◐ Gepauzeerd (idle)'}
        </span>
        {bgEnabled && !bgActive && idleMin != null && (
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            {idleMin}m zonder clients — hervat bij eerste bezoeker
          </span>
        )}
        {bgEnabled && bgActive && (
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            elke {background.refresh_interval_s}s
          </span>
        )}
        <button onClick={handleToggle} style={{
          marginLeft: 'auto', fontSize: '12px', padding: '3px 12px',
          borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit',
          border: `1px solid ${bgEnabled ? '#fca5a5' : '#86efac'}`,
          background: bgEnabled ? '#fef2f2' : '#f0fdf4',
          color: bgEnabled ? '#b91c1c' : '#15803d', fontWeight: 600,
        }}>
          {bgEnabled ? '⏸ Uitzetten' : '▶ Aanzetten'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <CacheChip label="Wedstrijden" age={fmtAge(matches.age_s)} count={matches.count} ttl={background.cache_ttl_s} ageS={matches.age_s} />
        <CacheChip label="Standen"     age={fmtAge(standings.age_s)} count={standings.count} ttl={background.cache_ttl_s} ageS={standings.age_s} />
      </div>
    </div>
  );
}

function CacheChip({ label, age, count, ttl, ageS }) {
  const stale = ageS != null && ageS >= ttl;
  return (
    <div style={{
      border: `1px solid ${stale ? '#fca5a5' : 'var(--color-border)'}`,
      borderRadius: '8px', padding: '8px 12px', fontSize: '12px',
      background: stale ? '#fef2f2' : 'var(--color-bg)',
    }}>
      <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '2px' }}>{label}</div>
      <div style={{ color: stale ? '#b91c1c' : 'var(--color-text-muted)' }}>
        leeftijd: <strong>{age}</strong>
        {count != null && <> · {count} items</>}
        {stale && <span style={{ marginLeft: '6px' }}>⚠ stale</span>}
      </div>
    </div>
  );
}

function EventDetailPanel({ site, hour, onClose }) {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    api.get(`/api/admin/site-events?site=${encodeURIComponent(site)}&hour=${encodeURIComponent(hour)}&limit=100`)
      .then(d => setEvents(d.events || []))
      .catch(() => setEvents([]));
  }, [site, hour]);

  const fmtDt = iso => iso
    ? new Date(iso.replace(' ', 'T') + 'Z').toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginTop: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Events — {hour.slice(0, 13)}u</span>
        <button onClick={onClose} style={{ ...btnStyle, padding: '4px 10px', fontSize: '12px' }}>✕ Sluiten</button>
      </div>
      {events === null ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Laden…</p>
      ) : events.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Geen events gevonden.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={thStyle}>Tijd</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Detail</th>
                <th style={thStyle}>Duur</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)', opacity: 0.9 }}>
                  <td style={tdStyle}>{fmtDt(e.ts)}</td>
                  <td style={tdStyle}>
                    <EventTypeBadge type={e.event_type} />
                  </td>
                  <td style={{ ...tdStyle, maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.source_url || e.endpoint || e.token || '—'}
                  </td>
                  <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                    {e.duration_ms != null ? `${e.duration_ms}ms` : '—'}
                  </td>
                  <td style={tdStyle}>
                    {e.status_code ? (
                      <span style={{ color: e.status_code < 400 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                        {e.status_code}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EventTypeBadge({ type }) {
  const colors = {
    page_view:   { bg: '#dbeafe', fg: '#1d4ed8' },
    api_call:    { bg: '#d1fae5', fg: '#065f46' },
    source_call: { bg: '#fef3c7', fg: '#92400e' },
  };
  const c = colors[type] || { bg: 'var(--color-border)', fg: 'var(--color-text-muted)' };
  return (
    <span style={{
      background: c.bg, color: c.fg, padding: '1px 7px',
      borderRadius: '9999px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
    }}>{type}</span>
  );
}

function SitePanel({ site, s, cacheStatus }) {
  const slots = buildHourlySlots(s.hourly);
  const maxCount = Math.max(...slots.map(h => h.count), 1);
  const fmtDt = (iso) => iso
    ? new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('nl-NL')
    : '—';

  const [selectedHour, setSelectedHour] = useState(null);

  function handleBarClick(slot) {
    if (slot.count === 0) return;
    setSelectedHour(prev => prev === slot.hour ? null : slot.hour);
  }

  return (
    <div style={{ marginBottom: '40px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text)' }}>
        {SITE_LABELS[site] || site}
      </h2>

      {cacheStatus && <ScrapsterCachePanel status={cacheStatus} onRefresh={load} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Bezoekers vandaag"  value={s.today.unique_visitors} />
        <StatCard label="Paginabezoeken"      value={s.today.page_views} sub="vandaag" />
        <StatCard label="Paginabezoeken"      value={s.week.page_views} sub="7 dagen" />
        <StatCard label="API-calls"           value={s.today.api_calls} sub="vandaag" />
        {s.source.last_fetch_at && (
          <StatCard label="Gem. brontijd"     value={`${s.source.avg_duration_ms || 0} ms`} raw />
        )}
        {s.source.last_fetch_at && (
          <StatCard label="Bron succesratio"  value={`${s.source.success_rate || 0}%`} raw />
        )}
      </div>

      {s.source.last_fetch_at && (
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          Laatste ophaalmoment bron: <strong>{fmtDt(s.source.last_fetch_at)}</strong>
        </p>
      )}

      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: '16px 20px',
      }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Events per uur — laatste 24u <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(klik op een bar voor detail)</span>
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '60px' }}>
          {slots.map((h, i) => (
            <div
              key={i}
              title={`${h.label}: ${h.count} events — klik voor detail`}
              onClick={() => handleBarClick(h)}
              style={{
                flex: 1, minWidth: 0,
                height: h.count > 0 ? `${Math.max(4, Math.round((h.count / maxCount) * 60))}px` : '2px',
                background: selectedHour === h.hour
                  ? 'var(--color-primary, #3b82f6)'
                  : h.count > 0 ? 'var(--color-primary, #3b82f6)' : 'var(--color-border)',
                opacity: selectedHour === h.hour ? 1 : h.count > 0 ? 0.55 : 0.4,
                borderRadius: '2px 2px 0 0',
                cursor: h.count > 0 ? 'pointer' : 'default',
                transition: 'opacity 0.15s',
                outline: selectedHour === h.hour ? '2px solid var(--color-primary)' : 'none',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: '6px', fontSize: '10px', color: 'var(--color-text-muted)' }}>
          {slots.map((h, i) => {
            const show = i === 0 || i === 6 || i === 12 || i === 18 || i === 23;
            return (
              <div key={i} style={{ flex: 1, textAlign: i === 23 ? 'right' : i === 0 ? 'left' : 'center' }}>
                {show ? h.label : ''}
              </div>
            );
          })}
        </div>
      </div>

      {selectedHour && (
        <EventDetailPanel
          site={site}
          hour={selectedHour}
          onClose={() => setSelectedHour(null)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, sub, raw }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '14px 16px',
    }}>
      <div style={{ fontSize: '22px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
        {raw ? value : (typeof value === 'number' ? value.toLocaleString('nl-NL') : value)}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
        {label}{sub ? ` (${sub})` : ''}
      </div>
    </div>
  );
}

const btnStyle = {
  padding: '7px 14px', fontSize: '13px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)', background: 'var(--color-surface)',
  color: 'var(--color-text)', cursor: 'pointer',
};

const thStyle = {
  padding: '6px 10px', textAlign: 'left', fontSize: '11px',
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '6px 10px', verticalAlign: 'middle',
};
