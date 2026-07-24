import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { api } from '@core/api.js';

const METHOD_COLORS = {
  GET:    '#3b82f6',
  POST:   '#22c55e',
  PATCH:  '#f59e0b',
  PUT:    '#8b5cf6',
  DELETE: '#ef4444',
};

export default function ApiStats() {
  const [data, setData]             = useState(null);
  const [error, setError]           = useState('');
  const [autoRefresh, setAuto]      = useState(false);
  const [scrapster, setScrapster]   = useState(null);
  const intervalRef = useRef(null);

  const load = useCallback(() => {
    api.get('/api/admin/api-stats')
      .then(setData)
      .catch(e => setError(e.message));
    api.get('/api/admin/site-stats')
      .then(d => setScrapster(d.sites || {}))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 5000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, load]);

  const maxCalls = data?.endpoints?.length ? data.endpoints[0].calls : 1;

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>API statistieken</h1>
          {data && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              {data.total.toLocaleString('nl-NL')} calls sinds{' '}
              {new Date(data.since).toLocaleString('nl-NL')}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAuto(e.target.checked)}
            />
            Auto-refresh (5s)
          </label>
          <button onClick={load} style={btnStyle}>↻ Verversen</button>
        </div>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>{error}</p>}

      {!data ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Laden…</p>
      ) : data.endpoints.length === 0 ? (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: '40px', textAlign: 'center',
          color: 'var(--color-text-muted)', fontSize: '14px',
        }}>
          Nog geen API-calls vastgelegd (de teller herstart bij elke backend-herstart).
        </div>
      ) : (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-background)', borderBottom: '2px solid var(--color-border)' }}>
                <Th style={{ width: '80px' }}>Methode</Th>
                <Th>Endpoint</Th>
                <Th style={{ width: '90px', textAlign: 'right' }}>Calls</Th>
                <Th style={{ width: '55px', textAlign: 'right' }}>%</Th>
                <Th style={{ width: '200px' }}></Th>
              </tr>
            </thead>
            <tbody>
              {data.endpoints.map((ep, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '9px 16px' }}>
                    <MethodBadge method={ep.method} />
                  </td>
                  <td style={{ padding: '9px 16px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    {ep.path}
                  </td>
                  <td style={{ padding: '9px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>
                    {ep.calls.toLocaleString('nl-NL')}
                  </td>
                  <td style={{ padding: '9px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {ep.pct}%
                  </td>
                  <td style={{ padding: '9px 16px' }}>
                    <div style={{ height: '6px', background: 'var(--color-border)', borderRadius: '3px' }}>
                      <div style={{
                        height: '100%', borderRadius: '3px',
                        background: METHOD_COLORS[ep.method] || 'var(--color-primary)',
                        width: `${(ep.calls / maxCalls) * 100}%`,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {scrapster && Object.keys(scrapster).map(site => (
        <SitePanel key={site} site={site} s={scrapster[site]} />
      ))}
    </AdminLayout>
  );
}

const SITE_LABELS = {
  scrapster: 'Scrapster',
  poulebord: 'Poulebord',
};

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
    <div style={{ marginTop: '40px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text)' }}>
        {SITE_LABELS[site] || site} — monitoring
      </h2>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Bezoekers vandaag"   value={s.today.unique_visitors} />
        <StatCard label="Paginabezoeken"       value={s.today.page_views} sub="vandaag" />
        <StatCard label="Paginabezoeken"       value={s.week.page_views} sub="7 dagen" />
        <StatCard label="API-calls"            value={s.today.api_calls} sub="vandaag" />
        {s.source.last_fetch_at && (
          <StatCard label="Gem. brontijd"      value={`${s.source.avg_duration_ms || 0} ms`} raw />
        )}
        {s.source.last_fetch_at && (
          <StatCard label="Bron succesratio"   value={`${s.source.success_rate || 0}%`} raw />
        )}
      </div>

      {/* Last fetch — only when source calls are tracked */}
      {s.source.last_fetch_at && (
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
          Laatste ophaalmoment bron: <strong>{fmtDt(s.source.last_fetch_at)}</strong>
        </p>
      )}

      {/* Hourly bar chart — always 24 slots */}
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

function Th({ children, style }) {
  return (
    <th style={{
      padding: '10px 16px', textAlign: 'left',
      fontSize: '12px', fontWeight: 600,
      color: 'var(--color-text-muted)', letterSpacing: '0.04em',
      ...style,
    }}>{children}</th>
  );
}

function MethodBadge({ method }) {
  const color = METHOD_COLORS[method] || '#888';
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em',
      padding: '2px 7px', borderRadius: '4px',
      background: color + '22', color, border: `1px solid ${color}44`,
      fontFamily: 'var(--font-mono)',
    }}>{method}</span>
  );
}

const btnStyle = {
  padding: '7px 14px', fontSize: '13px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)', background: 'var(--color-surface)',
  color: 'var(--color-text)', cursor: 'pointer',
};
