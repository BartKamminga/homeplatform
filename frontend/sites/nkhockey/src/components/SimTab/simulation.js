// Simulation core — shared by O14 and O16

// ── Match primitives ──

export const simMatch = (ha) => {
  const a = (ha || 0) / 100
  const rW = 0.38 + a, rD = 0.23, rL = Math.max(0.39 - a, 0.05)
  const t = rW + rD + rL, pW = rW / t, pD = rD / t, r = Math.random()
  return r < pW ? [3, 0] : r < pW + pD ? [1, 1] : [0, 3]
}

const simGD = () => 1 + Math.floor(Math.random() * 4)

// Generate a realistic score for a given result
export function generateScore(result) {
  if (result === 'D') {
    const g = Math.random() < 0.4 ? 0 : Math.random() < 0.7 ? 1 : 2
    return [g, g]
  }
  const win = 1 + Math.floor(Math.random() * 4)  // 1-4 goals
  const lose = Math.max(0, win - 1 - Math.floor(Math.random() * 3))  // 0 to win-1
  return result === 'W' ? [win, lose] : [lose, win]
}

// Normalize lock value — supports both string ('W') and object ({result:'W', scoreH:3, scoreA:1})
function getLock(lock) {
  if (!lock) return null
  if (typeof lock === 'string') return { result: lock, scoreH: null, scoreA: null }
  return lock
}

function resolveMatch(ha, rawLock) {
  const lock = getLock(rawLock)
  if (lock) {
    const r = lock.result
    const hp = r === 'W' ? 3 : r === 'D' ? 1 : 0
    const ap = r === 'W' ? 0 : r === 'D' ? 1 : 3
    const gd = (lock.scoreH != null && lock.scoreA != null) ? lock.scoreH - lock.scoreA : (r === 'D' ? 0 : simGD())
    return { hp, ap, gd }
  }
  const [hp, ap] = simMatch(ha)
  return { hp, ap, gd: simGD() }
}

function simKOWithLock(locks, lockKey, home, away) {
  const lock = getLock(locks && locks[lockKey])
  if (lock) return lock.result === 'W' ? home : lock.result === 'L' ? away : (Math.random() < 0.5 ? home : away)
  return Math.random() < 0.5 ? home : away
}

// ── Prediction (for ✦ button) ──

export function predictMatches(matches, poule) {
  const N = 1000
  const results = {}
  for (const m of matches) {
    const hi = poule.teams.indexOf(m.h), ai = poule.teams.indexOf(m.a)
    if (hi < 0 || ai < 0) {
      const result = m.isKO ? (Math.random() < 0.5 ? 'W' : 'L') : null
      results[m.lockKey] = result ? { result, scoreH: null, scoreA: null } : null
      continue
    }
    const ptsH = poule.pts[hi] || 0, ptsA = poule.pts[ai] || 0
    const dsH = poule.ds[hi] || 0, dsA = poule.ds[ai] || 0
    const ha = Math.max(-30, Math.min(30, ((ptsH - ptsA) * 2 + (dsH - dsA) * 0.5) / 20 * 100))
    let wC = 0, lC = 0
    for (let i = 0; i < N; i++) { const [hp] = simMatch(ha); if (hp === 3) wC++; else if (hp === 0) lC++ }
    let result
    if (m.isKO) result = wC >= lC ? 'W' : 'L'
    else result = wC >= lC && wC >= N - wC - lC ? 'W' : lC >= wC && lC >= N - wC - lC ? 'L' : 'D'
    const [scoreH, scoreA] = generateScore(result)
    results[m.lockKey] = { result, scoreH, scoreA }
  }
  return results
}

// ── Poule simulation (with locks) ──

export function simPoule(poule, ha, locks) {
  const pts = [...poule.pts], ds = [...poule.ds]
  for (let mi = 0; mi < poule.remaining.length; mi++) {
    const [h, a] = poule.remaining[mi]
    const hi = poule.teams.indexOf(h), ai = poule.teams.indexOf(a)
    if (hi < 0 || ai < 0) continue
    const { hp, ap, gd } = resolveMatch(ha, locks && locks[`${h}_${a}`])
    pts[hi] += hp; pts[ai] += ap
    if (hp > ap) { ds[hi] += Math.abs(gd); ds[ai] -= Math.abs(gd) }
    else if (ap > hp) { ds[ai] += Math.abs(gd); ds[hi] -= Math.abs(gd) }
  }
  return pts.map((_, i) => i).sort((a, b) => pts[b] !== pts[a] ? pts[b] - pts[a] : ds[b] - ds[a])
}

// NK Poulefase simulation — optional locks via slot names
export function simNKPoule(names, nkLocks, slotNames) {
  const n = names.length, pts = Array(n).fill(0), ds = Array(n).fill(0)
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    let rawLock = null
    if (nkLocks && slotNames) {
      const l1 = nkLocks[`${slotNames[i]}_${slotNames[j]}`]
      const l2 = nkLocks[`${slotNames[j]}_${slotNames[i]}`]
      if (l1) rawLock = l1
      else if (l2) {
        const lk = getLock(l2)
        if (lk) rawLock = { result: lk.result === 'W' ? 'L' : lk.result === 'L' ? 'W' : 'D', scoreH: lk.scoreA, scoreA: lk.scoreH }
      }
    }
    const { hp, ap, gd } = resolveMatch(0, rawLock)
    pts[i] += hp; pts[j] += ap
    if (hp > ap) { ds[i] += Math.abs(gd); ds[j] -= Math.abs(gd) }
    else if (ap > hp) { ds[j] += Math.abs(gd); ds[i] -= Math.abs(gd) }
  }
  return pts.map((_, i) => i).sort((a, b) => pts[b] !== pts[a] ? pts[b] - pts[a] : ds[b] - ds[a])
}

// ── Shared poule-phase simulation loop ──

function simPoulePhase(data, N, ha, locks, pouleOrder) {
  const ss = {}
  for (const id of Object.keys(data)) ss[id] = data[id].teams.map(() => Array(6).fill(0))
  const pk = pouleOrder.filter(k => data[k])
  function runOnce() {
    const st = {}
    for (const id of pk) {
      const o = simPoule(data[id], ha, locks)
      st[id] = o.map(i => data[id].teams[i])
      for (let r = 0; r < data[id].teams.length; r++) ss[id][o[r]][r]++
    }
    return st
  }
  return { ss, pk, runOnce }
}

// ── O14 full simulation ──

export function runSimO14(data, N, ha, locks, nkSchedule) {
  const NK14_SLOTS = { A: ['A', 'B'], B: ['B', 'A'], C: ['A', 'B'], D: ['B', 'A'], E: ['A', 'B'] }
  const { ss, pk, runOnce } = simPoulePhase(data, N, ha, locks, ['A', 'B', 'C', 'D', 'E'])
  const nkAp = {}, nkBp = {}, nkAa = {}, nkBa = {}, fin = {}
  const ensF = t => { if (!fin[t]) fin[t] = { appear: 0, sfReach: 0, finalist: 0, p1: 0, p2: 0, p3: 0, p4: 0 } }

  const nkLocksA = {}, nkLocksB = {}
  if (locks && nkSchedule) {
    for (const m of (nkSchedule.schedA || [])) { const k = `nk_A_${m.home}_${m.away}`; if (locks[k]) nkLocksA[`${m.home}_${m.away}`] = locks[k] }
    for (const m of (nkSchedule.schedB || [])) { const k = `nk_B_${m.home}_${m.away}`; if (locks[k]) nkLocksB[`${m.home}_${m.away}`] = locks[k] }
  }
  const hasNKLocks = Object.keys(nkLocksA).length > 0 || Object.keys(nkLocksB).length > 0

  for (let s = 0; s < N; s++) {
    const st = runOnce()
    const buildNK = slot => pk.filter(k => NK14_SLOTS[k][0] === slot).map(k => st[k][0]).concat(pk.filter(k => NK14_SLOTS[k][1] === slot).map(k => st[k][1]))
    const buildSlots = slot => pk.filter(k => NK14_SLOTS[k][0] === slot).map(k => `${k} nr 1`).concat(pk.filter(k => NK14_SLOTS[k][1] === slot).map(k => `${k} nr 2`))
    const nkA = buildNK('A'), nkB = buildNK('B')
    const slotA = buildSlots('A'), slotB = buildSlots('B')

    for (const t of nkA) { nkAa[t] = (nkAa[t] || 0) + 1; if (!nkAp[t]) nkAp[t] = Array(5).fill(0); ensF(t); fin[t].appear++ }
    for (const t of nkB) { nkBa[t] = (nkBa[t] || 0) + 1; if (!nkBp[t]) nkBp[t] = Array(5).fill(0); ensF(t); fin[t].appear++ }

    const oA = hasNKLocks ? simNKPoule(nkA, nkLocksA, slotA) : simNKPoule(nkA)
    const oB = hasNKLocks ? simNKPoule(nkB, nkLocksB, slotB) : simNKPoule(nkB)
    for (let r = 0; r < nkA.length; r++) nkAp[nkA[oA[r]]][r]++
    for (let r = 0; r < nkB.length; r++) nkBp[nkB[oB[r]]][r]++

    const [a1, a2, b1, b2] = [nkA[oA[0]], nkA[oA[1]], nkB[oB[0]], nkB[oB[1]]]
    for (const t of [a1, a2, b1, b2]) fin[t].sfReach++

    const w1 = simKOWithLock(locks, 'nk_hf1', a1, b2), l1 = w1 === a1 ? b2 : a1
    const w2 = simKOWithLock(locks, 'nk_hf2', b1, a2), l2 = w2 === b1 ? a2 : b1
    fin[w1].finalist++; fin[w2].finalist++

    const fW = simKOWithLock(locks, 'nk_finale', w1, w2), fL = fW === w1 ? w2 : w1
    const tW = simKOWithLock(locks, 'nk_3e4e', l1, l2), tL = tW === l1 ? l2 : l1
    fin[fW].p1++; fin[fL].p2++; fin[tW].p3++; fin[tL].p4++
  }
  return { ss, nkAp, nkBp, nkAa, nkBa, fin }
}

// ── O16 full simulation ──

export function runSimO16(data, N, ha, locks) {
  const { ss, pk, runOnce } = simPoulePhase(data, N, ha, locks, ['A', 'B', 'C', 'D'])
  const fin = {}
  const ensF = t => { if (!fin[t]) fin[t] = { appear: 0, kf: 0, hf: 0, finalist: 0, p1: 0, p2: 0 } }

  for (let s = 0; s < N; s++) {
    const st = runOnce()
    const nr1s = pk.map(k => ({ team: st[k][0], pts: data[k].pts[data[k].teams.indexOf(st[k][0])] || 0, ds: data[k].ds[data[k].teams.indexOf(st[k][0])] || 0 }))
    const nr2s = pk.map(k => ({ team: st[k][1], pts: data[k].pts[data[k].teams.indexOf(st[k][1])] || 0, ds: data[k].ds[data[k].teams.indexOf(st[k][1])] || 0 }))
    nr1s.sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.ds !== a.ds ? b.ds - a.ds : Math.random() - 0.5)
    nr2s.sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.ds !== a.ds ? b.ds - a.ds : Math.random() - 0.5)

    const kf = [[nr1s[0].team, nr2s[3].team], [nr1s[1].team, nr2s[2].team], [nr1s[2].team, nr2s[1].team], [nr1s[3].team, nr2s[0].team]]
    for (const [h, a] of kf) { ensF(h); ensF(a); fin[h].appear++; fin[a].appear++; fin[h].kf++; fin[a].kf++ }

    const kfW = kf.map(([h, a], i) => simKOWithLock(locks, `nk_kf${i + 1}`, h, a))
    for (const t of kfW) fin[t].hf++

    const hf1w = simKOWithLock(locks, 'nk_hf1', kfW[0], kfW[3])
    const hf2w = simKOWithLock(locks, 'nk_hf2', kfW[1], kfW[2])
    fin[hf1w].finalist++; fin[hf2w].finalist++

    const fW = simKOWithLock(locks, 'nk_finale', hf1w, hf2w), fL = fW === hf1w ? hf2w : hf1w
    fin[fW].p1++; fin[fL].p2++
  }
  return { ss, fin }
}
