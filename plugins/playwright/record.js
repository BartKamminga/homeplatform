/**
 * record.js — headed Playwright recorder
 *
 * Gebruik: node record.js <naam> [start-url]
 *
 * Legt vast:
 *   - Paginanavigaties (goto)
 *   - Klikken op links/buttons
 *   - Formulier-invullingen (blur op input/textarea/select)
 *   - XHR/fetch-responses
 *
 * Output:
 *   recipes/<naam>.json  — event-log + XHR-log (alles voor replay)
 *   Geen sessiebestand meer — player start altijd fresh.
 */

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const RECIPES_DIR = path.join(__dirname, 'recipes')
fs.mkdirSync(RECIPES_DIR, { recursive: true })

const recipeName = process.argv[2]
if (!recipeName) {
  console.error('Gebruik: node record.js <naam> [start-url]')
  console.error('Voorbeeld: node record.js hockey-poules https://hockey.nl/mijn-hockey')
  process.exit(1)
}

const startUrl = process.argv[3] || 'https://hockey.nl'

// Betrouwbare selector voor een DOM-element
function makeSelector(el) {
  if (!el) return null
  const id   = el.id ? `#${el.id}` : null
  const name = el.getAttribute?.('name') ? `[name="${el.getAttribute('name')}"]` : null
  const tid  = el.getAttribute?.('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : null
  return id || tid || name || null
}

;(async () => {
  console.log(`\nRecorder starten — naam: ${recipeName}`)
  console.log(`Start-URL: ${startUrl}\n`)

  const browser = await chromium.launch({ headless: false })
  const context  = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const eventLog = []   // geordend: goto + fill + click
  const xhrLog   = []

  // ── Acties via geïnjecteerd script ────────────────────────────────────────────
  await page.exposeFunction('__rec', (action) => {
    eventLog.push({ ...action, ts: Date.now() })
    if (action.type === 'fill') {
      const masked = action.inputType === 'password' ? '••••' : action.value
      console.log(`  [ACT] fill  ${action.selector}  "${masked}"`)
    } else {
      console.log(`  [ACT] click ${action.selector || ''}  ${action.text ? `"${action.text}"` : ''}`)
    }
  })

  await page.addInitScript(() => {
    function sel(el) {
      if (!el) return null
      if (el.id)                              return '#' + el.id
      if (el.getAttribute('name'))            return `[name="${el.getAttribute('name')}"]`
      if (el.getAttribute('data-testid'))     return `[data-testid="${el.getAttribute('data-testid')}"]`
      if (el.getAttribute('aria-label'))      return `[aria-label="${el.getAttribute('aria-label')}"]`
      return null
    }

    // Klikken op interactieve elementen
    document.addEventListener('click', e => {
      const el = e.target.closest('a, button, input[type="submit"], input[type="button"], [role="button"]')
      if (!el) return
      const s = sel(el)
      const text = el.textContent?.trim()?.slice(0, 60) || el.value || ''
      window.__rec({ type: 'click', selector: s, text })
    }, true)

    // Invullen van formuliervelden (bij verlaten van het veld)
    document.addEventListener('blur', e => {
      const el = e.target
      if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return
      if (!el.value) return
      const s = sel(el)
      if (!s) return
      window.__rec({ type: 'fill', selector: s, value: el.value, inputType: el.type || 'text' })
    }, true)
  })

  // ── Paginanavigaties ──────────────────────────────────────────────────────────
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return
    const url = frame.url()
    if (!url || url === 'about:blank') return
    eventLog.push({ type: 'goto', url, ts: Date.now() })
    console.log(`  [NAV] ${url}`)
  })

  // ── XHR/fetch responses ───────────────────────────────────────────────────────
  page.on('response', async (response) => {
    const req = response.request()
    if (!['xhr', 'fetch'].includes(req.resourceType())) return
    const url    = req.url()
    const method = req.method()
    const status = response.status()
    let body = null
    try {
      if ((response.headers()['content-type'] || '').includes('json')) body = await response.json()
    } catch {}
    xhrLog.push({ url, method, status, requestBody: req.postData() || null, body, ts: Date.now() })
    console.log(`  [XHR] ${method} ${status} ${url}`)
  })

  await page.goto(startUrl)

  console.log('\n──────────────────────────────────────────────────')
  console.log('  Log in en navigeer in de browser.')
  console.log('  Druk ENTER in dit venster als je klaar bent.')
  console.log('──────────────────────────────────────────────────\n')

  await new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question('', () => { rl.close(); resolve() })
  })

  const recipe = {
    name: recipeName,
    startUrl,
    created: new Date().toISOString(),
    events: eventLog,
    requests: xhrLog,
  }
  const recipeFile = path.join(RECIPES_DIR, `${recipeName}.json`)
  fs.writeFileSync(recipeFile, JSON.stringify(recipe, null, 2))

  console.log(`\nKlaar.`)
  console.log(`  Recipe:     ${recipeFile}`)
  console.log(`  Events:     ${eventLog.length} (${eventLog.filter(e => e.type === 'goto').length} navigaties, ${eventLog.filter(e => e.type === 'fill').length} invullingen, ${eventLog.filter(e => e.type === 'click').length} klikken)`)
  console.log(`  XHR-calls:  ${xhrLog.length}`)
  console.log(`\nAfspelen: node play.js recipes/${recipeName}.json`)

  await browser.close()
})()
