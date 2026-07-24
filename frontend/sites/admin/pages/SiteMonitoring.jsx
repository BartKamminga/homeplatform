import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { api } from '@core/api.js';

const SITE_LABELS = {
  scrapster: 'Scrapster',
  poulebord: 'Poulebord',
};

export default function SiteMonitoring() {
  const [sites, setSites]       = useState(null);
  const [autoRefresh, setAuto]  = useState(false);
  const intervalRef = useRef(null);

  const load = useCallback(() => {
    api.get('/api/admin/site-stats')
      .then(d => setSites(d.sites || {}))
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
          <SitePanel key={site} site={site} s={sites[site]} />
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

function SitePanel({ site, s }) {
  const slots = buildHourlySlots(s.hourly);
  const maxCount = Math.max(...slots.map(h => h.count), 1);
  const fmtDt = (iso) => iso
    ? new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('nl-NL')
    : '—';

  return (
    <div style={{ marginBottom: '40px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text)' }}>
        {SITE_LABELS[site] || site}
      </h2>

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
          Events per uur — laatste 24u
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '60px' }}>
          {slots.map((h, i) => (
            <div key={i} title={`${h.label}: ${h.count}`} style={{
              flex: 1, minWidth: 0,
              height: h.count > 0 ? `${Math.max(4, Math.round((h.count / maxCount) * 60))}px` : '2px',
              background: h.count > 0 ? 'var(--color-primary, #3b82f6)' : 'var(--color-border)',
              opacity: h.count > 0 ? 0.75 : 0.4,
              borderRadius: '2px 2px 0 0',
            }} />
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
