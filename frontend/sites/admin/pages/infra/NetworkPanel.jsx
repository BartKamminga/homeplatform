import { Chip, cardStyle, labelStyle } from './ui.jsx';

const th = { ...labelStyle, textAlign: 'left', padding: '8px 14px', borderBottom: '1px solid var(--color-border)' };
const td = { padding: '8px 14px', fontSize: 13, borderBottom: '1px solid var(--color-border)' };

// Tunnel-routes komen live uit de cloudflared-log van prod; de poorttabel is de vaste referentie.
export default function NetworkPanel({ routes, prodIp, accIp }) {
  // Beheertools (Bugsink/Portainer/Cockpit) en sponsordeck blijven bewust op de acc-machine (G4), besluit cutover 06-10.
  const ports = [
    { port: 8080, service: 'HomePlatform prod (Caddy)', url: `http://${prodIp}:8080` },
    { port: 8081, service: 'HomePlatform acc (Caddy)', url: `http://${accIp}:8081` },
    { port: 8082, service: 'Sponsor deck (mo14.webheaven.nl)', url: `http://${accIp}:8082` },
    { port: 8090, service: 'Bugsink (error monitoring)', url: `http://${accIp}:8090` },
    { port: 9000, service: 'Portainer', url: `http://${accIp}:9000` },
    { port: 9091, service: 'Cockpit (system service)', url: `http://${accIp}:9091` },
    { port: 61208, service: 'Glances (both machines)', url: `http://${prodIp}:61208` },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Public hostname</th><th style={th}>Tunnel target</th></tr></thead>
          <tbody>
            {routes?.length ? routes.map(r => (
              <tr key={r.hostname}>
                <td style={td}><Chip href={`https://${r.hostname}`} color="#22c55e">{r.hostname}</Chip></td>
                <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.service}</td>
              </tr>
            )) : (
              <tr><td style={{ ...td, color: 'var(--color-text-muted)' }} colSpan={2}>Tunnel configuration not found in the cloudflared log</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Port</th><th style={th}>Service</th></tr></thead>
          <tbody>
            {ports.map(p => (
              <tr key={p.port}>
                <td style={{ ...td, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{p.port}</a>
                </td>
                <td style={td}>{p.service}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
