// Chrome bedienen via het DevTools-protocol: headless starten, inloggen (token in localStorage),
// en een scenario afspelen op vaste momenten in echte tijd (toetsen, klikken, crash, netwerk blokkeren, asserts).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const KEYS = { Escape: 27, Enter: 13, Space: 32, KeyY: 89, KeyN: 78, KeyR: 82, KeyK: 75, KeyM: 77, KeyL: 76, KeyH: 72, KeyT: 84 }
const sleep = ms => new Promise(r => setTimeout(r, ms))

export async function runScenario({ baseUrl, token, scenario, outDir, port = 9335 }) {
  const prof = path.join(outDir, 'profile-' + scenario.name)
  fs.rmSync(prof, { recursive: true, force: true })
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
    '--window-size=1600,900', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
  const results = []
  try {
    let ws
    for (let i = 0; i < 60 && !ws; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
        ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl)
      } catch { await sleep(250) }
    }
    await new Promise(r => ws.addEventListener('open', r))
    let id = 0
    const pending = {}
    ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending[m.id]) { pending[m.id](m.result); delete pending[m.id] } })
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })) })
    const evalJs = async expr => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      return r && r.result ? r.result.value : undefined
    }
    const go = async url => { await send('Page.navigate', { url }); await sleep(500) }

    await send('Page.enable')
    // inloggen: token op dezelfde origin zetten, dan pas naar /vbt/
    await go(baseUrl + '/favicon.svg')
    await evalJs(`localStorage.setItem('hp_token', ${JSON.stringify(token)})`)
    await go(baseUrl + '/vbt/' + (scenario.query ? '?' + scenario.query : ''))
    const t0 = Date.now()

    for (const st of scenario.steps) {
      await sleep(Math.max(0, st.at * 1000 - (Date.now() - t0)))
      if (st.key) {
        const key = st.key.startsWith('Key') ? st.key.slice(3).toLowerCase() : st.key
        for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, code: st.key, key, windowsVirtualKeyCode: KEYS[st.key] })
      }
      if (st.block) { await send('Network.enable'); await send('Network.setBlockedURLs', { urls: st.block }) }
      if (st.unblock) await send('Network.setBlockedURLs', { urls: [] })
      if (st.click) await evalJs(`document.querySelector(${JSON.stringify(st.click)})?.click()`)
      if (st.run) await evalJs(st.run)
      if (st.crash) { ws.send(JSON.stringify({ id: ++id, method: 'Page.crash' })); await sleep(1000) }
      if (st.reload) { await go(baseUrl + '/vbt/' + (st.reload === true ? '' : '?' + st.reload)); await sleep(st.wait || 5000) }
      if (st.crash && !st.reload) continue
      await sleep(250)
      if (st.assert) {
        const value = await evalJs(`(async () => { try { return await (${st.assert}) } catch (e) { return 'ERR ' + e.message } })()`)
        results.push({ step: st.name || st.assert, ok: value === true, value })
      }
      if (st.shot) {
        const shot = await send('Page.captureScreenshot', { format: 'png' })
        fs.writeFileSync(path.join(outDir, `${scenario.name}-${st.shot}.png`), Buffer.from(shot.data, 'base64'))
      }
    }
    ws.close()
  } finally {
    chrome.kill()
  }
  return results
}
