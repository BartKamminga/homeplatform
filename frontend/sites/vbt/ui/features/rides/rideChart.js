// Ritgrafiek: vermogen als staafjes in zonekleur, hoogte als vlak, hartslag als lijn (samples 1 Hz)
export function drawRide(ctx, W, H, S) {
  if (!S || S.length < 2) {
    ctx.fillStyle = 'rgba(255,255,255,.5)'
    ctx.font = '13px Orbitron, sans-serif'
    ctx.fillText('Too short for a chart', 12, H / 2)
    return
  }
  const VBT = window.VBT
  const maxW = Math.max(100, ...S.map(s => s[3])) * 1.1
  const alts = S.map(s => s[7]), aMin = Math.min(...alts), aMax = Math.max(...alts)
  const x = i => i / (S.length - 1) * W
  ctx.fillStyle = 'rgba(155,92,255,.18)'
  ctx.beginPath()
  ctx.moveTo(0, H)
  S.forEach((s, i) => ctx.lineTo(x(i), H - (s[7] - aMin) / (aMax - aMin || 1) * H * 0.6))
  ctx.lineTo(W, H)
  ctx.fill()
  const bw = Math.max(1, W / S.length)
  S.forEach((s, i) => {
    ctx.fillStyle = VBT.util.zoneFor(s[3]).color
    const h = s[3] / maxW * H
    ctx.fillRect(x(i) - bw / 2, H - h, bw, h)
  })
  if (S.some(s => s[5] > 0)) {
    ctx.strokeStyle = '#ff2e88'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    S.forEach((s, i) => { const y = H - s[5] / 200 * H; if (i) ctx.lineTo(x(i), y); else ctx.moveTo(x(i), y) })
    ctx.stroke()
  }
}
