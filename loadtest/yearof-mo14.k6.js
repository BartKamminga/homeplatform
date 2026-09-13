// yearof-mo14 loadtest — draait via GitHub Actions (workflow_dispatch) tegen acc.
// Doel: het bezoekerspad simuleren zoals PublicSite.jsx het echt aanroept
// (home -> team/speler, wedstrijden/pouletabel, in de kijker) - de site staat
// sinds 2026-09-13 open (geen teamcode meer), dus dit is puur lezen, geen writes.
//
// Lokaal draaien:
//   k6 run -e BASE_URL=http://localhost:8081 loadtest/yearof-mo14.k6.js
//
// Env vars (optioneel, hebben defaults):
//   BASE_URL        basis-URL van de backend (default http://localhost:8081)
//   READ_MAX_VUS    max gelijktijdige bezoekers (default 30)
//   STAGE_DURATION  duur van elke ramp-fase (default 1m)

import http from 'k6/http'
import { check, sleep } from 'k6'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081'
const READ_MAX_VUS = Number(__ENV.READ_MAX_VUS || 30)
const STAGE_DURATION = __ENV.STAGE_DURATION || '1m'

export const options = {
  scenarios: {
    visitor_browse: {
      executor: 'ramping-vus',
      exec: 'browseSite',
      startVUs: 1,
      stages: [
        { duration: STAGE_DURATION, target: READ_MAX_VUS },
        { duration: STAGE_DURATION, target: READ_MAX_VUS },
        { duration: STAGE_DURATION, target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Informatief, niet hard falend — we willen de cijfers zien, niet de build blokkeren.
    http_req_duration: ['p(95)<5000'],
  },
}

// setup() draait één keer, ontdekt een echte speler + wedstrijd/dag op acc
// zodat het script niet met verzonnen IDs werkt.
export function setup() {
  const playersRes = http.get(`${BASE_URL}/api/yearof-mo14/players`)
  check(playersRes, { 'players 200': (r) => r.status === 200 })
  const players = playersRes.json() || []
  if (players.length === 0) {
    throw new Error('Geen spelers gevonden op ' + BASE_URL)
  }

  const timelineRes = http.get(`${BASE_URL}/api/yearof-mo14/timeline`)
  check(timelineRes, { 'timeline 200': (r) => r.status === 200 })
  const items = timelineRes.json() || []
  if (items.length === 0) {
    throw new Error('Geen wedstrijden/dagen gevonden op ' + BASE_URL)
  }

  return {
    playerId: players[Math.floor(Math.random() * players.length)].id,
    matchRef: items[items.length - 1].match_ref,
  }
}

// Zelfde volgorde als een echte bezoeker: home (actie + in de kijker-preview +
// pouletabel + laatste/volgende wedstrijd), dan team -> speler, dan wedstrijden
// -> 1 wedstrijdpagina (verslagen + fotos), dan het volledige In de kijker-overzicht.
export function browseSite(data) {
  const { playerId, matchRef } = data

  const home = [
    () => http.get(`${BASE_URL}/api/yearof-mo14/action`),
    () => http.get(`${BASE_URL}/api/yearof-mo14/reports?report_type=interview`),
    () => http.get(`${BASE_URL}/api/yearof-mo14/standings`),
    () => http.get(`${BASE_URL}/api/yearof-mo14/timeline`),
  ]
  for (const step of home) {
    check(step(), { 'home read 200': (r) => r.status === 200 })
  }
  sleep(Math.random() * 2 + 1)

  const team = [
    () => http.get(`${BASE_URL}/api/yearof-mo14/players`),
    () => http.get(`${BASE_URL}/api/yearof-mo14/players/${playerId}`),
    () => http.get(`${BASE_URL}/api/yearof-mo14/photos?player_id=${playerId}`),
  ]
  for (const step of team) {
    check(step(), { 'team read 200': (r) => r.status === 200 })
  }
  sleep(Math.random() * 2 + 1)

  const match = [
    () => http.get(`${BASE_URL}/api/yearof-mo14/timeline/${encodeURIComponent(matchRef)}`),
    () => http.get(`${BASE_URL}/api/yearof-mo14/reports?match_ref=${encodeURIComponent(matchRef)}`),
    () => http.get(`${BASE_URL}/api/yearof-mo14/photos?match_ref=${encodeURIComponent(matchRef)}`),
  ]
  for (const step of match) {
    check(step(), { 'match read 200': (r) => r.status === 200 })
  }
  sleep(Math.random() * 2 + 1)

  check(http.get(`${BASE_URL}/api/yearof-mo14/reports?report_type=interview`), {
    'spotlight read 200': (r) => r.status === 200,
  })
  sleep(Math.random() * 2 + 1)
}

// Naast de volledige k6-tekstsamenvatting op stdout (in de Actions-run-log) ook
// een compacte markdown-tabel wegschrijven, die de workflow in de GitHub
// Job Summary plakt — zo hoef je niet door de ruwe log te scrollen.
export function handleSummary(data) {
  const m = data.metrics
  const num = (metric, key) => (m[metric] && typeof m[metric].values[key] === 'number' ? m[metric].values[key] : null)
  const ms = (metric, key) => (num(metric, key) === null ? 'n/a' : num(metric, key).toFixed(0))
  const pct = (metric, key) => (num(metric, key) === null ? 'n/a' : (num(metric, key) * 100).toFixed(2))

  const md = `## k6 loadtest — yearof-mo14 (acc)

| Metric | Waarde |
|---|---|
| Requests totaal | ${num('http_reqs', 'count') ?? 'n/a'} |
| Requests gefaald | ${pct('http_req_failed', 'rate')}% |
| Checks geslaagd | ${pct('checks', 'rate')}% |
| http_req_duration avg / p95 / max (ms) | ${ms('http_req_duration', 'avg')} / ${ms('http_req_duration', 'p(95)')} / ${ms('http_req_duration', 'max')} |

Parameters: BASE_URL=${BASE_URL}, STAGE_DURATION=${STAGE_DURATION}, READ_MAX_VUS=${READ_MAX_VUS}
`
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    '/output/summary.md': md,
  }
}
