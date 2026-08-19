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

  // ── Logging naar bestand (naast console) — zodat runs achteraf te diffen zijn ──
  const logLines = []
  const origLog  = console.log
  const origWarn = console.warn
  console.log  = (...a) => { logLines.push(a.join(' ')); origLog(...a) }
  console.warn = (...a) => { logLines.push(a.join(' ')); origWarn(...a) }

  // ── Navigatielog — bewijs van daadwerkelijke runtime-navigatie (i.t.t. de
  // afgespeelde recipe-goto's, die na een klik juist worden overgeslagen) ──
  const navLog = []
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return
    const url = frame.url()
    if (!url || url === 'about:blank') return
    navLog.push({ url, ts: Date.now() })
  })

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
  // Na een click slaan we ALLE opeenvolgende goto's over: de browser handelt
  // navigatie (inclusief OAuth-redirects met eenmalige codes) zelf af.
  let skipGotos = false

  // Usercentrics-cookiebanner wegklikken — met een fresh (cookieloos) profiel
  // verschijnt die na elke volledige paginanavigatie opnieuw en overlapt de hele
  // pagina (pointer-events), waardoor daaropvolgende clicks op de verkeerde
  // (onderliggende) elementen kunnen landen.
  async function dismissConsent() {
    try {
      const btn = page.getByRole('button', { name: 'Accepteer alles' })
      await btn.click({ timeout: 2500 })
      console.log('  [CONSENT] cookiebanner geaccepteerd')
    } catch {}
  }

  for (const event of recipe.events) {

    if (event.type === 'goto' && skipGotos) {
      console.log(`  [SKIP] goto ${event.url}  (nav na click)`)
      continue
    }
    if (event.type !== 'goto') skipGotos = false

    if (event.type === 'goto') {
      console.log(`  [GOTO] ${event.url}`)
      await page.goto(event.url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(e => {
        console.warn(`    Fout: ${e.message}`)
      })
      await page.waitForTimeout(800)
      await dismissConsent()

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
      await dismissConsent()
      try {
        // Probeer eerst een button/link op rol, val terug op tekst
        const byRole = page.getByRole('button', { name: event.text, exact: true })
          .or(page.getByRole('link', { name: event.text, exact: true }))
        const loc = event.selector
          ? page.locator(event.selector).first()
          : await byRole.count() > 0
            ? byRole.first()
            : page.getByText(event.text, { exact: false }).first()

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 4000 }).catch(() => {}),
          loc.click({ timeout: 5000 }),
        ])
        skipGotos = true
      } catch {
        console.warn(`    Knop niet gevonden: ${event.selector || event.text}`)
      }
      await page.waitForTimeout(800)
      await dismissConsent()
    }
  }

  // Extra wachttijd voor late XHR-calls
  await page.waitForTimeout(2000)

  const ts      = Date.now()
  const outFile = args[1] || path.join(path.dirname(recipeFile), `${recipe.name}-play-${ts}.json`)
  const logFile = outFile.replace(/\.json$/, '.log')
  const screenshotFile = outFile.replace(/\.json$/, '.png')

  // ── DOM-check ─────────────────────────────────────────────────────────────────
  // Harde controle op de daadwerkelijke pagina-inhoud, i.p.v. alleen afleiden uit
  // URL's/netwerkcalls: staat de "Inloggen"-knop nog in de pagina, dan is de
  // gebruiker (zichtbaar voor de site zelf) niet ingelogd — ongeacht wat de
  // navigatie- of netwerklog suggereert.
  let domShowsLoginButton = null
  try {
    domShowsLoginButton = await page.evaluate(() => document.body.innerText.includes('Inloggen'))
  } catch {}
  try { await page.screenshot({ path: screenshotFile, fullPage: true }) } catch {}

  if (!headless) {
    console.log('\n  Browser blijft nog 10s open voor handmatige check...')
    await page.waitForTimeout(10000)
  }

  await browser.close()

  // ── Login-check ───────────────────────────────────────────────────────────────
  // De DOM-check (staat "Inloggen" nog op de pagina?) is leidend: dat is wat de
  // site zelf denkt over de sessie. Navigatie/netwerk-signalen (auth/callback,
  // account/dashboard bereikt) zijn alleen een ondersteunende indicatie — bleek
  // in de praktijk niet betrouwbaar genoeg als enige bewijs.
  const sawAuthCallback  = navLog.some(n => /\/auth\/callback\?code=/.test(n.url))
  const sawDashboard     = navLog.some(n => /login\.hockeyweerelt\.nl\/account\/dashboard/.test(n.url))
  const finalUrl         = page.url()
  const stillOnLogin     = /inloggen|login\.hockeyweerelt\.nl/.test(finalUrl)
  const loginOk          = domShowsLoginButton === false && !stillOnLogin
  const authTs           = (navLog.find(n => /\/auth\/callback\?code=/.test(n.url))
                          || navLog.find(n => /login\.hockeyweerelt\.nl\/account\/dashboard/.test(n.url))
                          || {}).ts
  const unauthorizedAfterLogin = authTs
    ? captured.filter(r => r.status === 401 && r.ts > authTs).length
    : 0

  // ── Output ────────────────────────────────────────────────────────────────────
  const output = {
    recipe: recipe.name,
    playedAt: new Date().toISOString(),
    loginOk,
    domShowsLoginButton,
    finalUrl,
    navLog,
    requests: captured,
  }
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2))

  console.log(`\nKlaar.`)
  console.log(`  Output:      ${outFile}`)
  console.log(`  Log:         ${logFile}`)
  console.log(`  Screenshot:  ${screenshotFile}`)
  console.log(`  XHR-calls:   ${captured.length}`)
  console.log(`  Eind-URL:    ${finalUrl}`)
  console.log(`  "Inloggen"-knop nog zichtbaar: ${domShowsLoginButton}`)
  console.log(loginOk ? `  LOGIN:       OK` : `  LOGIN:       FAILED (auth/callback gezien: ${sawAuthCallback}, dashboard gezien: ${sawDashboard}, eind-URL is login-pagina: ${stillOnLogin})`)

  if (unauthorizedAfterLogin > 0) {
    console.log(`\n  Let op: ${unauthorizedAfterLogin} call(s) gaven 401 ná de login — sessie mogelijk niet volledig geldig.`)
  }
  if (!loginOk) {
    console.log(`  Probeer opnieuw op te nemen: node record.js ${recipe.name} ${recipe.startUrl}`)
  }

  fs.writeFileSync(logFile, logLines.join('\n') + '\n')
})()
