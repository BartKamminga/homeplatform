// Uitleg van de open v1-API, met voorbeelden voor dit huis.
export default function ApiPage({ home }) {
  const base = `${window.location.origin}/api/myhome/v1`
  const endpoints = [
    ['GET', '/homes', 'Your homes'],
    ['GET', `/homes/${home.id}`, 'The whole model: floors, rooms (polygon, area, HA area), devices per room, unassigned devices'],
    ['GET', `/homes/${home.id}/rooms?floor=ground&kind=bedroom&ha_area=Kitchen`, 'Flat list of rooms, all filters optional'],
    ['GET', `/homes/${home.id}/devices?unassigned=true&source=hue`, 'Devices, filter by room_id, source or unassigned'],
  ]
  return (
    <div className="mh-page">
      <div>
        <h2>Open API (v1)</h2>
        <p className="mh-muted">
          Read-only and stable: existing fields are never renamed, new ones are only added. Authenticate with a personal
          API key (starts with <span className="mh-mono">hp_</span>, create one under Account) as a Bearer token.
        </p>
      </div>
      <div className="mh-scroll">
        <table className="mh-table">
          <thead><tr><th>Method</th><th>Path</th><th>Returns</th></tr></thead>
          <tbody>
            {endpoints.map(([m, p, d]) => (
              <tr key={p}><td className="mh-mono">{m}</td><td className="mh-mono">{p}</td><td>{d}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <section>
        <h3>Example</h3>
        <pre>{`curl -H "Authorization: Bearer hp_..." \\\n  ${base}/homes/${home.id}/rooms?floor=attic`}</pre>
      </section>
      <section>
        <h3>Sync devices in (for adapters)</h3>
        <p className="mh-muted">Upsert on source + external_id. Existing room links stay unless you send a room.</p>
        <pre>{`PUT /api/myhome/homes/${home.id}/devices/import
{ "devices": [
  { "name": "Kitchen panel", "kind": "light", "source": "hue",
    "external_id": "<hue light id>", "room_key": "ground/kitchen" }
] }`}</pre>
      </section>
    </div>
  )
}
