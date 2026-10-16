// Extra net aangezet in SETTINGS -> meteen laten zien in de game, zodat je weet wat het is:
// voertuig/ploegleider rijdt meteen langs, de stem zegt iets, een voorbeeldmelding, of de HUD verschijnt 5 s
// (ook buiten een rit) met het aangezette paneel oplichtend. Decor, peloton en ghost zie je al direct op de weg.
const HUD = {
  hud_power: '.panel.power', hud_hr: '.heartpanel', hud_cadence: '.cadpanel', hud_speed: '.speedo', hud_time: '.panel.right',
  hud_elevation: '.elev', hud_top: '.panel.center', hud_chips: '.devchip', hud_music: '#music',
  messages: '#message', coach: '#coach', voice: '#coach',
}
const PREVIEW_MS = 5000
let hudTimer = null

function showHud(selector, ms = PREVIEW_MS) {
  document.body.classList.add('hud-preview')
  clearTimeout(hudTimer)
  hudTimer = setTimeout(() => document.body.classList.remove('hud-preview'), ms)
  // even wachten tot React/CSS het onderdeel weer toont, dan laten oplichten
  setTimeout(() => document.querySelectorAll(selector).forEach(el => {
    el.classList.remove('flash')
    void el.offsetWidth
    el.classList.add('flash')
    setTimeout(() => el.classList.remove('flash'), 2600)
  }), 120)
}

export function previewExtra(key) {
  const VBT = window.VBT
  VBT.store?.log('settings', 'Preview: ' + key, 'debug')
  if (key === 'fireworks') { VBT.fx.fireworks(); return }
  if (key === 'hud_workout') { VBT.toast?.('WORKOUT PANEL: VISIBLE DURING A WORKOUT'); return }
  if (key === 'voice') VBT.coach.say('Team director here. This is how I sound during your ride!')
  else if (key === 'messages') VBT.hud.message('DRAFT!', VBT.palette.cyan)
  else if (VBT.traffic.preview(key) && key !== 'coach') return
  if (HUD[key]) showHud(HUD[key], key === 'coach' ? 14000 : PREVIEW_MS)   // teamwagen moet nog naast je komen
}
