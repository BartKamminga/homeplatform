import { Badge, Chip, OK, WARN, BAD, MUTED, StatCells, cardStyle, fmtAgo, labelStyle } from './ui.jsx';

// Item 1191: acc.webheaven.nl staat via de tunnel op internet; Caddy laat alleen het LAN, het thuis-IP
// (bijgehouden door scripts/acc-home-ip.sh op G4, elke 30 min) en extra IP's (GitHub-variabele) door.
const STALE_S = 75 * 60;     // cron elke 30 min: twee gemiste runs = stale

export default function AccAccessPanel({ access }) {
  const ageS = access?.checked_at ? (Date.now() - new Date(access.checked_at)) / 1000 : null;
  const stale = ageS != null && ageS > STALE_S;
  const state = !access ? { color: MUTED, text: 'No status' }
    : access.status === 'error' ? { color: BAD, text: 'Error' }
    : stale ? { color: WARN, text: 'Stale' }
    : { color: OK, text: 'Protected' };
  const ips = list => (list?.length ? list.join(' ') : '—');

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <Chip href="https://acc.webheaven.nl" color="#8b5cf6">acc.webheaven.nl</Chip>
        <Badge color={state.color}>{state.text}</Badge>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Allowed: LAN, home IP and extra IPs - everyone else gets 403
        </span>
      </div>
      {!access ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
          No acc_access.json yet - is the cron for <code>acc-home-ip.sh</code> running on G4?
        </p>
      ) : (<>
        <StatCells cells={[
          { label: 'Home IP', value: ips(access.home_ips) },
          { label: 'Extra IPs', value: ips(access.extra_ips) },
          { label: 'Home IP changed', value: fmtAgo(access.changed_at || null) },
          { label: 'Last check', value: fmtAgo(access.checked_at), color: stale ? WARN : undefined },
        ]} />
        {access.message && <p style={{ fontSize: 12, color: BAD, margin: '8px 0 0' }}>{access.message}</p>}
        <p style={{ ...labelStyle, textTransform: 'none', letterSpacing: 0, fontWeight: 400, margin: '8px 0 0' }}>
          Extra IPs: GitHub variable ACC_ALLOWED_IPS (environment acceptance), active after the next acc deploy.
        </p>
      </>)}
    </div>
  );
}
