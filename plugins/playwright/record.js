/**
 * record.js — headed Playwright recorder
 *
 * Gebruik: node record.js <naam> [start-url]
 *
 * Wat het doet:
 *   1. Opent een browser (headful) op de opgegeven URL
 *   2. Jij logt in en navigeert handmatig
 *   3. Alle XHR/fetch-calls worden gelogd (URL, method, status, JSON-body)
 *   4. Alle paginanavigaties worden bijgehouden
 *   5. Druk Enter → sessie + recipe worden opgeslagen
 *
 * Output (in recipes/ en sessions/):
 *   recipes/<naam>.json  — XHR-log + navigatiepaden
 *   sessions/<naam>.json — browser-state (cookies, localStorage) voor hergebruik
 */

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const RECIPES_DIR  = path.join(__dirname, 'recipes')
const SESSIONS_DIR = path.join(__dirname, 'sessions')

fs.mkdirSync(RECIPES_DIR, { recursive: true })
fs.mkdirSync(SESSIONS_DIR, { recursive: true })

const recipeName = process.argv[2]
if (!recipeName) {
  console.error('Gebruik: node record.js <naam> [start-url]')
  console.error('Voorbeeld: node record.js hockey-poules https://hockey.nl')
  process.exit(1)
}

const startUrl = process.argv[3] || 'https://hockey.nl'

;(async () => {
  console.log(`\nRecorder starten — naam: ${recipeName}`)
  console.log(`Start-URL: ${startUrl}\n`)

  const browser = await chromium.launch({ headless: false, slowMo: 0 })
  const context  = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const xhrLog = []
  const navLog = []

  // ── XHR/fetch responses ──────────────────────────────────────────────────────
  page.on('response', async (response) => {
    const req = response.request()
    if (!['xhr', 'fetch'].includes(req.resourceType())) return

    const url    = req.url()
    const method = req.method()
    const status = response.status()
    let reqBody  = null
    let body     = null

    try { reqBody = req.postData() } catch {}

    try {
      const ct = response.headers()['content-type'] || ''
      if (ct.includes('json')) body = await response.json()
    } catch {}

    xhrLog.push({ url, method, status, requestBody: reqBody, body, ts: Date.now() })
    console.log(`  [XHR] ${method} ${status} ${url}`)
  })

  // ── Paginanavigaties ─────────────────────────────────────────────────────────
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return
    const url = frame.url()
    if (!url || url === 'about:blank') return
    navLog.push({ url, ts: Date.now() })
    console.log(`  [NAV] ${url}`)
  })

  await page.goto(startUrl)

  console.log('\n──────────────────────────────────────────────────')
  console.log('  Navigeer in de browser en log in.')
  console.log('  Druk ENTER in dit venster als je klaar bent.')
  console.log('──────────────────────────────────────────────────\n')

  await new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question('', () => { rl.close(); resolve() })
  })

  // ── Opslaan ──────────────────────────────────────────────────────────────────
  const storageState = await context.storageState()
  const stateFile    = path.join(SESSIONS_DIR, `${recipeName}.json`)
  fs.writeFileSync(stateFile, JSON.stringify(storageState, null, 2))

  const recipe = {
    name: recipeName,
    startUrl,
    created: new Date().toISOString(),
    sessionFile: stateFile,
    navigations: navLog,
    requests: xhrLog,
  }
  const recipeFile = path.join(RECIPES_DIR, `${recipeName}.json`)
  fs.writeFileSync(recipeFile, JSON.stringify(recipe, null, 2))

  console.log(`\nKlaar.`)
  console.log(`  Recipe:     ${recipeFile}`)
  console.log(`  Sessie:     ${stateFile}`)
  console.log(`  Navigaties: ${navLog.length}`)
  console.log(`  XHR-calls:  ${xhrLog.length}`)
  console.log(`\nAfspelen: node play.js recipes/${recipeName}.json`)

  await browser.close()
})()
