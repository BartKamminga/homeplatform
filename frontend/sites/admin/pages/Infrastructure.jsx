import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { api } from '@core/api.js';
import InfraServicesStrip from './InfraServicesStrip.jsx';
import HostPanel from './infra/HostPanel.jsx';
import BackupTable from './infra/BackupTable.jsx';
import PipelinePanel from './infra/PipelinePanel.jsx';
import NetworkPanel from './infra/NetworkPanel.jsx';
import { Section, fmtAgo } from './infra/ui.jsx';

// Item 1190: prod (g5) en acc + beheer (G4) naast elkaar. De eigen machine komt lokaal,
// de andere via het peer-endpoint - dus prod- en acc-admin tonen allebei beide machines.
export default function Infrastructure() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/admin/infra/overview')
      .then(d => { setData(d); setError(''); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const self = data?.self;
  const peer = data?.peer;
  const selfIsProd = self?.role === 'production';
  // Prod altijd links, ongeacht welke admin je bekijkt
  const prod = selfIsProd ? self : peer;
  const acc  = selfIsProd ? peer : self;
  const routes = [self, peer].find(h => h?.available && h.tunnel_routes)?.tunnel_routes;

  const refresh = (
    <button onClick={load} disabled={loading}
      style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-text)', opacity: loading ? 0.5 : 1 }}>
      {loading ? 'Refreshing…' : 'Refresh'}
    </button>
  );

  return (
    <AdminLayout>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Infrastructure</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 24, fontSize: 13 }}>
        Production and acceptance + management, side by side · {self ? `collected ${fmtAgo(self.collected_at)}` : '…'}
      </p>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}
      {!data && !error && <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>}

      {data && (<>
        <Section title="Machines" right={refresh}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 16 }}>
            <HostPanel host={prod} isSelf={selfIsProd} fallbackTitle="Production (g5)" adminLink={data.links?.prod_admin} />
            <HostPanel host={acc} isSelf={!selfIsProd} fallbackTitle="Acceptance + management (G4)" adminLink={data.links?.acc_admin} />
          </div>
        </Section>

        <Section title="Deploys — GitHub Actions">
          <PipelinePanel runs={data.pipeline} actionsUrl={data.links?.actions} />
        </Section>

        <Section title="Backups per day">
          <BackupTable hosts={[prod, acc]} />
        </Section>

        <Section title="Actions on this machine">
          <InfraServicesStrip />
        </Section>

        <Section title="Network">
          <NetworkPanel routes={routes} prodIp={data.ips?.prod} accIp={data.ips?.acc} />
        </Section>
      </>)}
    </AdminLayout>
  );
}
