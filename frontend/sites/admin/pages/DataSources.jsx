import AdminLayout from '../AdminLayout.jsx';
import { EXTERNAL_GROUPS } from './dataSources/externalData.js';
import { INTERNAL_GROUPS } from './dataSources/internalApiData.js';
import { AGENT_REGISTRY } from './dataSources/agentRegistryData.js';
import { GroupedTable, SectionCard } from './dataSources/shared.jsx';
import AgentRegistryCard from './dataSources/AgentRegistryCard.jsx';

const SOURCE_COLS = ['Bron', 'Doel', 'Bestand', 'Als agent-context'];

export default function DataSources() {
  return (
    <AdminLayout>
      <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>Databronnen &amp; API&apos;s</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '28px', fontSize: 'var(--font-size-sm)' }}>
        Externe bronnen, eigen /api/-endpoints en de agent-registry — met per bron een inschatting of
        de call direct als context-input voor een (smart) agent gebruikt kan worden.
      </p>

      <SectionCard title="Externe databronnen & API's" subtitle="Bronnen buiten het eigen platform, ingedeeld per site/agent.">
        <GroupedTable groups={EXTERNAL_GROUPS} cols={SOURCE_COLS} />
      </SectionCard>

      <SectionCard title="Interne HomePlatform-API's" subtitle="Eigen /api/-endpoints, ingedeeld per module. CRUD-/mutatie-endpoints zijn gegroepeerd.">
        <GroupedTable groups={INTERNAL_GROUPS} cols={SOURCE_COLS} />
      </SectionCard>

      <SectionCard
        title="Agent-registry — data sources & post-processes"
        subtitle={"Ground truth uit backend/services/agents/*.py — elke agent heeft een gesloten set databronnen (context) " +
          "en post-processes (schrijfacties), hard afgedwongen in routers/agent_control.py. \"none\" (alleen melding) is bij elke agent de fallback."}
      >
        {AGENT_REGISTRY.map((agent) => (
          <AgentRegistryCard key={agent.key} agent={agent} />
        ))}
      </SectionCard>

      <SectionCard title="Samenvatting">
        <div style={{ marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a085' }}>Direct kansrijk</span>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            Open-Meteo (Fiets), GitHub Pages NK-hockey-data, interne roadmap-API, Bugsink/Docker Engine API en
            /api/admin/system/overview — gestructureerd, geen sessie nodig, direct in een prompt te gebruiken.
          </p>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#c8961a' }}>Eerst een tussenstap nodig</span>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            Hockeyweerelt-data, AltiusRT-scrape en de Beatport-API zijn al via de bestaande pipeline naar de
            eigen database gebracht — pas ná opslag/parsing geschikt als agent-context.
          </p>
        </div>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#8e44ad' }}>Al verankerd in code</span>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            De 4 bestaande agents (fiets, hockey scan, poulebord, roadmap) gebruiken elk al een vaste set
            data_sources en post_processes — zie de agent-registry hierboven voor de exacte koppeling.
          </p>
        </div>
      </SectionCard>
    </AdminLayout>
  );
}
