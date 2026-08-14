/**
 * play.js — Playwright player (altijd fresh sessie)
 *
 * Gebruik: node play.js <recipe-file> [output-file] [--head]
 *
 * Wat het doet:
 *   1. Start altijd met een schone browser (geen opgeslagen cookies)
 *   2. Speelt de opgenomen events af: goto → fill → click
 *   3. Na een click wacht hij kort op eventuele navigatie
 *   4. Vangt alle XHR/fetch-responses op
 *   5. Schrijft resultaat naar JSON
 *
 * Tip: gebruik --head om de browser zichtbaar te maken.
 */

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const args       = process.argv.slice(2).filter(a => !a.startsWith('--'))
const flags      = process.argv.slice(2).filter(a => a.startsWith('--'))
const headless   = !flags.includes('--head')
const recipeFile = args[0]

if (!recipeFile || !fs.existsSync(recipeFile)) {
  console.error('Gebruik: node play.js <recipe-file> [output-file] [--head]')
  console.error('Voorbeeld: node play.js recipes/hockey-poules.json --head')
  process.exit(1)
}

const recipe = JSON.parse(fs.readFileSync(recipeFile, 'utf8'))

;(async () => {
  console.log(`\nPlayer starten — recipe: ${recipe.name}`)
  console.log(`  Aangemaakt: ${recipe.created}`)
  console.log(`  Events:     ${recipe.events.length}`)
  console.log(`  Modus:      ${headless ? 'headless' : 'headed (browser zichtbaar)'}`)
  console.log(`  Sessie:     fresh (geen opgeslagen cookies)\n`)

  const browser = await chromium.launch({ headless })
  const context  = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const captured = []

  page.on('response', async (response) => {
    const req = response.request()
    if (!['xhr', 'fetch'].includes(req.resourceType())) return
    let body = null
    try {
      if ((response.headers()['content-type'] || '').includes('json')) body = await response.json()
    } catch {}
    const entry = { url: req.url(), method: req.method(), status: response.status(), body, ts: Date.now() }
    captured.push(entry)
    console.log(`  [XHR] ${entry.method} ${entry.status} ${entry.url}`)
  })

  // ── Events afspelen ───────────────────────────────────────────────────────────
  let lastWasClick = false

  for (const event of recipe.events) {

    // Sla een goto over als we er net naartoe navigeerden via een click
    if (event.type === 'goto' && lastWasClick) {
      lastWasClick = false
      console.log(`  [SKIP] goto ${event.url}  (nav via click)`)
      await page.waitForLoadState('domcontentloaded').catch(() => {})
      continue
    }
    lastWasClick = false

    if (event.type === 'goto') {
      console.log(`  [GOTO] ${event.url}`)
      await page.goto(event.url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(e => {
        console.warn(`    Fout: ${e.message}`)
      })
      await page.waitForTimeout(800)

    } else if (event.type === 'fill') {
      const masked = event.inputType === 'password' ? '••••' : event.value
      console.log(`  [FILL] ${event.selector}  "${masked}"`)
      try {
        await page.locator(event.selector).first().fill(event.value, { timeout: 5000 })
      } catch {
        console.warn(`    Veld niet gevonden: ${event.selector}`)
      }
      await page.waitForTimeout(200)

    } else if (event.type === 'click') {
      console.log(`  [CLICK] ${event.selector || ''}  ${event.text ? `"${event.text}"` : ''}`)
      try {
        const loc = event.selector
          ? page.locator(event.selector).first()
          : page.getByText(event.text, { exact: false }).first()

        // Wacht kort op navigatie na de click (niet verplicht)
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 4000 }).catch(() => {}),
          loc.click({ timeout: 5000 }),
        ])
        lastWasClick = true
      } catch {
        console.warn(`    Knop niet gevonden: ${event.selector || event.text}`)
      }
      await page.waitForTimeout(800)
    }
  }

  // Extra wachttijd voor late XHR-calls
  await page.waitForTimeout(2000)
  await browser.close()

  // ── Output ────────────────────────────────────────────────────────────────────
  const ts = Date.now()
  const outFile = args[1] || path.join(path.dirname(recipeFile), `${recipe.name}-play-${ts}.json`)

  const unauthorized = captured.filter(r => r.status === 401).length
  const output = {
    recipe: recipe.name,
    playedAt: new Date().toISOString(),
    requests: captured,
  }
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2))

  console.log(`\nKlaar.`)
  console.log(`  Output:     ${outFile}`)
  console.log(`  XHR-calls:  ${captured.length}`)

  if (unauthorized > 0) {
    console.log(`\n  Let op: ${unauthorized} call(s) gaven 401 — login mislukt of sessie verlopen.`)
    console.log(`  Probeer opnieuw op te nemen: node record.js ${recipe.name} ${recipe.startUrl}`)
  }
})()
