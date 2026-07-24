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
  const [data, setData]         = useState(null);
  const [error, setError]       = useState('');
  const [autoRefresh, setAuto]  = useState(false);
  const intervalRef = useRef(null);

  const load = useCallback(() => {
    api.get('/api/admin/api-stats')
      .then(setData)
      .catch(e => setError(e.message));
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
    </AdminLayout>
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
