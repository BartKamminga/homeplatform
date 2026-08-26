function ItemRow({ label, note }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px',
      padding: '6px 0', borderBottom: '1px solid var(--color-border)', alignItems: 'baseline',
    }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>{label}</span>
      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{note}</span>
    </div>
  );
}

function MiniTable({ title, color, items }) {
  return (
    <div>
      <div style={{
        fontSize: '11px', fontWeight: 600, color, textTransform: 'uppercase',
        letterSpacing: '0.05em', marginBottom: '6px',
      }}>{title}</div>
      {items.map((it) => <ItemRow key={it.key} label={it.label} note={it.note} />)}
    </div>
  );
}

export default function AgentRegistryCard({ agent }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '18px 22px', marginTop: '14px',
    }}>
      <div style={{ fontWeight: 600, fontSize: '14px' }}>{agent.label}</div>
      <p style={{ fontSize: '11px', color: 'var(--color-text-light)', margin: '4px 0 16px' }}>{agent.routine}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <MiniTable title="Data sources (context in)" color="#16a085" items={agent.dataSources} />
        <MiniTable title="Post-processes (actie uit)" color="#8e44ad" items={agent.postProcesses} />
      </div>
    </div>
  );
}
