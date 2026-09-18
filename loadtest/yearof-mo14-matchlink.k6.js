// Gerichte loadtest voor een korte wedstrijdlink (/l/<code>) - simuleert een
// groep die binnen een kort tijdsvenster dezelfde standalone wedstrijdpagina
// opent (StandaloneMatchView, geen navigatiebalk), inclusief het laden van
// alle fotominiaturen op die pagina - dat is realistisch de zwaarste last,
// niet de JSON-API-calls zelf.
//
// Lokaal draaien:
//   k6 run -e BASE_URL=http://localhost:8081 -e SHORT_CODE=03kdtn loadtest/yearof-mo14-matchlink.k6.js
//
// Env vars:
//   BASE_URL      basis-URL van de backend (default http://localhost:8081)
//   SHORT_CODE    de code uit /l/<code> die getest wordt (verplicht)
//   MAX_VUS       max gelijktijdige bezoekers (default 110)
//   WINDOW        totale duur van het bezoekersvenster, bv. 5m (default 5m)

import http from 'k6/http'
import { check, sleep } from 'k6'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081'
const SHORT_CODE = __ENV.SHORT_CODE || ''
const MAX_VUS = Number(__ENV.MAX_VUS || 110)
const WINDOW = __ENV.WINDOW || '5m'

export const options = {
  scenarios: {
    match_link_burst: {
      executor: 'ramping-vus',
      exec: 'visitMatch',
      startVUs: 0,
      // Ramp geleidelijk op binnen het venster (mensen kijken niet allemaal
      // exact tegelijk), houdt de piek kort vast, ramp weer af.
      stages: [
        { duration: scaleStage(0.4), target: MAX_VUS },
        { duration: scaleStage(0.2), target: MAX_VUS },
        { duration: scaleStage(0.4), target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<5000'],
  },
}

function scaleStage(fraction) {
  const totalSeconds = parseWindowToSeconds(WINDOW)
  return `${Math.max(1, Math.round(totalSeconds * fraction))}s`
}

function parseWindowToSeconds(w) {
  const m = String(w).match(/^(\d+)(s|m|h)$/)
  if (!m) return 300
  const n = Number(m[1])
  return m[2] === 'h' ? n * 3600 : m[2] === 'm' ? n * 60 : n
}

// setup() volgt de korte link 1x zonder redirects te volgen, leest de
// Location-header uit om match_ref + teamcode te kennen voor de rest van de
// test - exact wat de browser server-side ook krijgt.
export function setup() {
  if (!SHORT_CODE) {
    throw new Error('SHORT_CODE ontbreekt - geef de code uit /l/<code> mee, bv. -e SHORT_CODE=03kdtn')
  }
  const res = http.get(`${BASE_URL}/l/${SHORT_CODE}`, { redirects: 0 })
  check(res, { 'short link redirect 307': (r) => r.status === 307 })
  const location = res.headers['Location'] || ''
  const entryMatch = location.match(/entry=([^&]+)/)
  const codeMatch = location.match(/code=([^&]+)/)
  if (!entryMatch || !codeMatch) {
    throw new Error('Kon match_ref/code niet uit de redirect halen: ' + location)
  }
  const matchRef = decodeURIComponent(entryMatch[1])
  const teamCode = decodeURIComponent(codeMatch[1])

  const photosRes = http.get(`${BASE_URL}/api/yearof-mo14/photos?match_ref=${encodeURIComponent(matchRef)}&code=${teamCode}`)
  check(photosRes, { 'photos 200 in setup': (r) => r.status === 200 })
  const photoIds = (photosRes.json() || []).map((p) => p.id)

  return { matchRef, teamCode, photoIds }
}

// Zelfde volgorde als StandaloneMatchView + PublicEntry echt ophaalt: eerst
// de korte link (redirect), dan wedstrijd-info, verslagen/blokken, de
// fotolijst, en dan elke thumbnail op de pagina - plus een paar keer een
// full-size foto (lightbox-klik), niet elke bezoeker doet dat.
export function visitMatch(data) {
  const { matchRef, teamCode, photoIds } = data

  check(http.get(`${BASE_URL}/l/${SHORT_CODE}`), { 'short link volgt door 200': (r) => r.status === 200 })

  check(http.get(`${BASE_URL}/api/yearof-mo14/timeline/${encodeURIComponent(matchRef)}?code=${teamCode}`), {
    'timeline item 200': (r) => r.status === 200,
  })
  check(http.get(`${BASE_URL}/api/yearof-mo14/reports?match_ref=${encodeURIComponent(matchRef)}&code=${teamCode}`), {
    'reports 200': (r) => r.status === 200,
  })
  check(http.get(`${BASE_URL}/api/yearof-mo14/photos?match_ref=${encodeURIComponent(matchRef)}&code=${teamCode}`), {
    'photos 200': (r) => r.status === 200,
  })

  sleep(Math.random() * 1.5 + 0.5) // pagina "bekijken" voor de thumbnails laden

  for (const id of photoIds) {
    check(http.get(`${BASE_URL}/api/yearof-mo14/photos/${id}/thumb.jpg`), { 'thumb 200': (r) => r.status === 200 })
  }

  // ~30% van de bezoekers klikt een paar fotos open (lightbox, full-size)
  if (Math.random() < 0.3 && photoIds.length > 0) {
    const opens = Math.min(3, photoIds.length)
    for (let i = 0; i < opens; i++) {
      const id = photoIds[Math.floor(Math.random() * photoIds.length)]
      check(http.get(`${BASE_URL}/api/yearof-mo14/photos/${id}/full.jpg`), { 'full 200': (r) => r.status === 200 })
    }
  }

  sleep(Math.random() * 2 + 1)
}

export function handleSummary(data) {
  const m = data.metrics
  const num = (metric, key) => (m[metric] && typeof m[metric].values[key] === 'number' ? m[metric].values[key] : null)
  const ms = (metric, key) => (num(metric, key) === null ? 'n/a' : num(metric, key).toFixed(0))
  const pct = (metric, key) => (num(metric, key) === null ? 'n/a' : (num(metric, key) * 100).toFixed(2))

  const md = `## k6 loadtest — yearof-mo14 wedstrijdlink (/l/${SHORT_CODE})

| Metric | Waarde |
|---|---|
| Requests totaal | ${num('http_reqs', 'count') ?? 'n/a'} |
| Requests gefaald | ${pct('http_req_failed', 'rate')}% |
| Checks geslaagd | ${pct('checks', 'rate')}% |
| http_req_duration avg / p95 / max (ms) | ${ms('http_req_duration', 'avg')} / ${ms('http_req_duration', 'p(95)')} / ${ms('http_req_duration', 'max')} |

Parameters: BASE_URL=${BASE_URL}, SHORT_CODE=${SHORT_CODE}, MAX_VUS=${MAX_VUS}, WINDOW=${WINDOW}
`
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    '/output/summary.md': md,
  }
}
