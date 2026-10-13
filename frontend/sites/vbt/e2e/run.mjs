// VBT e2e-regressie: tijdelijke DB + backend (:8000) + Vite (:5180), dan alle scenario's in scenarios/*.json.
// Gebruik (vanuit frontend/sites):  node vbt/e2e/run.mjs            alle scenario's
//                                    node vbt/e2e/run.mjs A-stop      alleen scenario's waarvan de naam zo begint
// Screenshots en logs komen in de map die aan het eind wordt getoond.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runScenario } from './cdp.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const sites = path.resolve(here, '../..')
const backend = path.resolve(sites, '../../backend')
const PYTHON = process.env.PYTHON || path.resolve(backend, '../.venv/Scripts/python.exe')
const VITE_PORT = 5180
const filter = process.argv[2] || ''
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vbt-e2e-'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const procs = []

async function waitFor(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try { await fetch(url); return } catch { await sleep(500) }
  }
  throw new Error('niet bereikbaar: ' + url)
}

function stopAll() { for (const p of procs) { try { p.kill() } catch { /* al weg */ } } }

async function main() {
  try { await fetch('http://127.0.0.1:8000/api/health'); throw new Error('poort 8000 is al in gebruik - stop eerst je lokale backend') }
  catch (e) { if (e.message.startsWith('poort')) throw e }

  const db = path.join(out, 'e2e.sqlite')
  // nep-Strava-config: alleen zodat de koppelknoppen verschijnen; de tests roepen Strava zelf nooit aan
  const env = { STRAVA_CLIENT_ID: '1', STRAVA_CLIENT_SECRET: 'e2e', ...process.env, DATABASE_URL: 'sqlite:///' + db.replace(/\\/g, '/'), SENTRY_DSN: '' }
  const setup = spawnSync(PYTHON, [path.join(here, 'setup_db.py'), db], { cwd: backend, env, encoding: 'utf8' })
  const token = (setup.stdout.match(/TOKEN=(\S+)/) || [])[1]
  if (!token) throw new Error('setup_db mislukt:\n' + setup.stderr.slice(-2000))

  const log = fs.openSync(path.join(out, 'servers.log'), 'a')
  procs.push(spawn(PYTHON, ['-m', 'uvicorn', 'main:app', '--port', '8000'], { cwd: backend, env, stdio: ['ignore', log, log] }))
  procs.push(spawn(process.execPath, [path.join(sites, 'node_modules/vite/bin/vite.js'), '--config', 'vite.config.js', '--port', String(VITE_PORT), '--strictPort'],
    { cwd: sites, stdio: ['ignore', log, log] }))
  const base = `http://localhost:${VITE_PORT}`
  await waitFor('http://127.0.0.1:8000/api/vbt/plans')
  await waitFor(base + '/vbt/')

  const files = fs.readdirSync(path.join(here, 'scenarios')).filter(f => f.endsWith('.json') && f.startsWith(filter)).sort()
  let failed = 0
  for (const f of files) {
    const scenario = JSON.parse(fs.readFileSync(path.join(here, 'scenarios', f), 'utf8'))
    scenario.name = scenario.name || f.replace('.json', '')
    const results = await runScenario({ baseUrl: base, token, scenario, outDir: out })
    const bad = results.filter(r => !r.ok)
    failed += bad.length
    console.log(`${bad.length ? 'FAIL' : 'ok  '} ${scenario.name} - ${scenario.title || ''}`)
    for (const r of results) console.log(`     ${r.ok ? '+' : 'x'} ${r.step}${r.ok ? '' : '  -> ' + JSON.stringify(r.value)}`)
  }
  console.log(`\n${files.length} scenario's, ${failed} mislukte checks. Screenshots/logs: ${out}`)
  return failed
}

main().then(failed => { stopAll(); process.exit(failed ? 1 : 0) })
  .catch(e => { console.error(e.message); stopAll(); process.exit(2) })
