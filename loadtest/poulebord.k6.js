// Poulebord loadtest — draait via GitHub Actions (workflow_dispatch) tegen acc.
// Doel: het omslagpunt vinden waarop board-reads/writes en scenario-simulaties
// last krijgen van elkaar (SQLite single-writer-lock), niet alleen ruwe CPU-load.
//
// Lokaal draaien:
//   k6 run -e BASE_URL=http://localhost:8081 loadtest/poulebord.k6.js
//
// Env vars (allemaal optioneel, hebben defaults):
//   BASE_URL        basis-URL van de backend (default http://localhost:8081)
//   READ_MAX_VUS    max gelijktijdige "board bekijken"-gebruikers (default 30)
//   WRITE_RATE      boards opslaan per seconde (default 2)
//   SIM_MAX_VUS     max gelijktijdige "scenario simuleren"-gebruikers (default 10)
//   STAGE_DURATION  duur van elke ramp-fase (default 1m)

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081'
const READ_MAX_VUS = Number(__ENV.READ_MAX_VUS || 30)
const WRITE_RATE = Number(__ENV.WRITE_RATE || 2)
const SIM_MAX_VUS = Number(__ENV.SIM_MAX_VUS || 10)
const STAGE_DURATION = __ENV.STAGE_DURATION || '1m'

// 3 gelijke ramp-fases (op/vasthouden/af) — alle scenario's lopen tegelijk,
// zodat writes en simulaties precies overlappen met de piek van de reads.
function stageDurationToSeconds(d) {
  const m = /^(\d+)(s|m|h)$/.exec(d)
  if (!m) throw new Error(`STAGE_DURATION moet vorm '<n>s|m|h' hebben, kreeg: ${d}`)
  const n = Number(m[1])
  return { s: n, m: n * 60, h: n * 3600 }[m[2]]
}
const TOTAL_DURATION = `${stageDurationToSeconds(STAGE_DURATION) * 3}s`

const boardWriteFailRate = new Rate('board_write_failed')
const simDuration = new Trend('scenario_simulate_duration', true)

export const options = {
  scenarios: {
    // "poulebord load" — bezoekers die een board openen en standen/wedstrijden bekijken.
    board_reads: {
      executor: 'ramping-vus',
      exec: 'browseBoard',
      startVUs: 1,
      stages: [
        { duration: STAGE_DURATION, target: READ_MAX_VUS },
        { duration: STAGE_DURATION, target: READ_MAX_VUS },
        { duration: STAGE_DURATION, target: 0 },
      ],
      gracefulRampDown: '10s',
    },
    // Concurrent geschreven boards, laag maar constant — dit is de test voor de
    // SQLite-writer-lock: als dit gaat falen/vertragen terwijl reads gezond
    // blijven, is dat het bewijs.
    board_writes: {
      executor: 'constant-arrival-rate',
      exec: 'saveBoard',
      rate: WRITE_RATE,
      timeUnit: '1s',
      duration: TOTAL_DURATION,
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
    // "scenario-functies" — de Monte Carlo/positie-simulaties zijn CPU-zwaar,
    // dit laat zien of één uvicorn-worker daar al onderuit gaat.
    scenario_calc: {
      executor: 'ramping-vus',
      exec: 'runScenario',
      startVUs: 0,
      stages: [
        { duration: STAGE_DURATION, target: SIM_MAX_VUS },
        { duration: STAGE_DURATION, target: SIM_MAX_VUS },
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

// setup() draait één keer, ontdekt een echte publicatie/poule/team op acc zodat
// het script niet met verzonnen IDs werkt.
export function setup() {
  const pubsRes = http.get(`${BASE_URL}/api/hockey/public/publications`)
  check(pubsRes, { 'publications 200': (r) => r.status === 200 })
  const pubs = pubsRes.json() || []
  const published = pubs.filter((p) => p.published)
  if (published.length === 0) {
    throw new Error('Geen gepubliceerde hockey-inside publicatie gevonden op ' + BASE_URL)
  }

  for (const pub of published) {
    const standingsRes = http.get(
      `${BASE_URL}/api/hockey/public/tournaments/${pub.id}/competition-standings`,
    )
    if (standingsRes.status !== 200) continue
    const data = standingsRes.json()
    for (const comp of data.competitions || []) {
      for (const poule of comp.poules || []) {
        if ((poule.standings || []).length >= 2) {
          return {
            tournamentId: pub.id,
            pouleId: poule.id,
            teamId: poule.standings[0].team_id,
          }
        }
      }
    }
  }
  throw new Error('Geen poule met minstens 2 teams in de standen gevonden om te testen')
}

export function browseBoard(data) {
  const { tournamentId, pouleId } = data
  const group = [
    () => http.get(`${BASE_URL}/api/hockey/public/publications`),
    () => http.get(`${BASE_URL}/api/hockey/public/tournaments/${tournamentId}/competition-standings`),
    () => http.get(`${BASE_URL}/api/hockey/public/hockey-poules/${pouleId}/standings`),
    () => http.get(`${BASE_URL}/api/hockey/public/hockey-poules/${pouleId}/matches`),
  ]
  for (const step of group) {
    const res = step()
    check(res, { 'read 200': (r) => r.status === 200 })
  }
  sleep(Math.random() * 2 + 1)
}

export function saveBoard(data) {
  const payload = JSON.stringify({
    name: `k6-loadtest-${__VU}-${__ITER}`,
    club: 'k6-loadtest',
    pins: [],
    pool_pins: [data.pouleId],
  })
  const createRes = http.post(`${BASE_URL}/api/tournix/public/boards`, payload, {
    headers: { 'Content-Type': 'application/json' },
  })
  const ok = check(createRes, { 'board create 201': (r) => r.status === 201 })
  boardWriteFailRate.add(!ok)
  if (ok) {
    const code = createRes.json('id')
    const readBack = http.get(`${BASE_URL}/api/tournix/public/boards/${code}`)
    check(readBack, { 'board read-back 200': (r) => r.status === 200 })
  }
}

export function runScenario(data) {
  const { pouleId, teamId } = data
  const start = Date.now()
  const res = http.get(
    `${BASE_URL}/api/hockey/public/hockey-poules/${pouleId}/simulate` +
      `?team_id=${teamId}&type=position_distribution&method=monte_carlo`,
  )
  simDuration.add(Date.now() - start)
  check(res, { 'simulate 200': (r) => r.status === 200 })
  sleep(Math.random() * 3 + 1)
}

// Naast de volledige k6-tekstsamenvatting op stdout (in de Actions-run-log) ook
// een compacte markdown-tabel wegschrijven, die de workflow in de GitHub
// Job Summary plakt — zo hoef je niet door de ruwe log te scrollen.
export function handleSummary(data) {
  const m = data.metrics
  const num = (metric, key) => (m[metric] && typeof m[metric].values[key] === 'number' ? m[metric].values[key] : null)
  const ms = (metric, key) => (num(metric, key) === null ? 'n/a' : num(metric, key).toFixed(0))
  const pct = (metric, key) => (num(metric, key) === null ? 'n/a' : (num(metric, key) * 100).toFixed(2))

  const md = `## k6 loadtest — poulebord (acc)

| Metric | Waarde |
|---|---|
| Requests totaal | ${num('http_reqs', 'count') ?? 'n/a'} |
| Requests gefaald | ${pct('http_req_failed', 'rate')}% |
| Checks geslaagd | ${pct('checks', 'rate')}% |
| Board-write gefaald | ${pct('board_write_failed', 'rate')}% |
| http_req_duration avg / p95 / max (ms) | ${ms('http_req_duration', 'avg')} / ${ms('http_req_duration', 'p(95)')} / ${ms('http_req_duration', 'max')} |
| scenario_simulate_duration avg / p95 (ms) | ${ms('scenario_simulate_duration', 'avg')} / ${ms('scenario_simulate_duration', 'p(95)')} |

Parameters: BASE_URL=${BASE_URL}, STAGE_DURATION=${STAGE_DURATION}, READ_MAX_VUS=${READ_MAX_VUS}, SIM_MAX_VUS=${SIM_MAX_VUS}, WRITE_RATE=${WRITE_RATE}
`
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    '/output/summary.md': md,
  }
}
