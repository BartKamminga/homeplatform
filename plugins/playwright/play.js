/**
 * play.js — headless Playwright player
 *
 * Gebruik: node play.js <recipe-file> [output-file]
 *
 * Wat het doet:
 *   1. Laadt het opgeslagen recipe (navigaties + XHR-log uit recorder)
 *   2. Hergebruikt de opgeslagen sessie als die <1 uur oud is
 *   3. Bezoekt alle unieke pagina-URLs uit de recording
 *   4. Vangt alle XHR/fetch-responses op (frisse data)
 *   5. Schrijft resultaat naar een JSON-bestand
 *
 * Output (in recipes/):
 *   <recipe-naam>-play-<ts>.json  — verse XHR-responses
 */

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const recipeFile = process.argv[2]
if (!recipeFile || !fs.existsSync(recipeFile)) {
  console.error('Gebruik: node play.js <recipe-file> [output-file]')
  console.error('Voorbeeld: node play.js recipes/hockey-poules.json')
  process.exit(1)
}

const recipe   = JSON.parse(fs.readFileSync(recipeFile, 'utf8'))
const ageMs    = Date.now() - new Date(recipe.created).getTime()
const SESSION_TTL = 60 * 60 * 1000  // 1 uur

const sessionValid = ageMs < SESSION_TTL && fs.existsSync(recipe.sessionFile)

;(async () => {
  console.log(`\nPlayer starten — recipe: ${recipe.name}`)
  console.log(`  Aangemaakt: ${recipe.created}`)
  console.log(`  Sessie:     ${sessionValid ? 'geldig (hergebruik)' : 'verlopen — anoniem'}`)

  const storageState = sessionValid
    ? JSON.parse(fs.readFileSync(recipe.sessionFile, 'utf8'))
    : undefined

  const browser = await chromium.launch({ headless: true })
  const context  = await browser.newContext({
    storageState,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const captured = []

  page.on('response', async (response) => {
    const req = response.request()
    if (!['xhr', 'fetch'].includes(req.resourceType())) return

    const url    = req.url()
    const method = req.method()
    const status = response.status()
    let body     = null

    try {
      const ct = response.headers()['content-type'] || ''
      if (ct.includes('json')) body = await response.json()
    } catch {}

    captured.push({ url, method, status, body, ts: Date.now() })
    console.log(`  [XHR] ${method} ${status} ${url}`)
  })

  // Bezoek elke unieke hoofd-URL uit de recording
  const urls = [...new Set(
    recipe.navigations
      .map(n => n.url)
      .filter(u => u && u.startsWith('http'))
  )]

  console.log(`\n${urls.length} pagina('s) te bezoeken:`)
  for (const url of urls) {
    console.log(`  [VISIT] ${url}`)
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
      // Extra wachttijd zodat async-calls ook binnenkomen
      await page.waitForTimeout(1500)
    } catch (e) {
      console.warn(`    Waarschuwing: ${e.message}`)
    }
  }

  await browser.close()

  // ── Output schrijven ─────────────────────────────────────────────────────────
  const ts = Date.now()
  const defaultOut = path.join(
    path.dirname(recipeFile),
    `${recipe.name}-play-${ts}.json`
  )
  const outFile = process.argv[3] || defaultOut

  const output = {
    recipe: recipe.name,
    playedAt: new Date().toISOString(),
    sessionUsed: sessionValid,
    urlsVisited: urls,
    requests: captured,
  }
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2))

  console.log(`\nKlaar.`)
  console.log(`  Output:     ${outFile}`)
  console.log(`  XHR-calls:  ${captured.length}`)

  if (!sessionValid) {
    console.log('\n  Let op: sessie was verlopen — maak een nieuwe recording.')
    console.log(`  node record.js ${recipe.name} ${recipe.startUrl}`)
  }
})()
