import * as s from './styles.js'

const pre = { whiteSpace: 'pre-wrap', background: 'var(--color-surface-2)', padding: 8, borderRadius: 'var(--radius-md)', fontSize: 12 }
const h = { fontWeight: 600, marginTop: 6 }

export default function RunLogEntry({ entry }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={h}>Reasoning</div>
      <div style={{ fontSize: 12 }}>{entry.reasoning}</div>

      {entry.notes && (<>
        <div style={h}>Notes (kennis)</div>
        <div style={{ fontSize: 12 }}>{entry.notes}</div>
      </>)}

      {entry.notification && (<>
        <div style={h}>Melding</div>
        <div style={{ fontSize: 12 }}>{entry.notification}</div>
      </>)}

      <div style={h}>Input (context naar Claude)</div>
      <pre style={pre}>{JSON.stringify(entry.input_payload, null, 2)}</pre>

      {entry.cmds?.length > 0 && (<>
        <div style={h}>Cmds toegevoegd</div>
        <pre style={pre}>{JSON.stringify(entry.cmds, null, 2)}</pre>
      </>)}

      <div style={h}>Afhandeling (post-processing)</div>
      <pre style={pre}>{JSON.stringify(entry.post_process_result, null, 2)}</pre>
    </div>
  )
}
