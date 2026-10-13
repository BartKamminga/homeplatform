// Rit-opname: 1 sample per seconde rijtijd (pauzes tellen niet mee).
// sample = [t, pos, odo, watt, cadans, hartslag, snelheid, hoogte]
//   pos = plek op het parcours (voor de ghost), odo = echt gereden afstand (springen telt niet mee)
VBT.recorder = (function () {
  let rec = null;

  function start(meta) {
    rec = Object.assign({ startedAt: new Date().toISOString(), samples: [], odo: 0, acc: 0, lapTime: null, jumped: false }, meta);
  }

  function sample(game, dt) {
    if (!rec) return null;
    rec.odo += game.player.v * dt;
    rec.acc += dt;
    let lap = null;
    if (rec.kind === 'free' && rec.lapTime === null && game.player.dist >= VBT.track.lapMeters()) {
      rec.lapTime = game.rideTime;
      lap = rec.lapTime;
    }
    if (rec.acc >= 1) {
      rec.acc -= 1;
      const s = game.sensors, T = VBT.track;
      rec.samples.push([
        +game.rideTime.toFixed(1), +game.player.dist.toFixed(1), +rec.odo.toFixed(1),
        Math.round(s.watts), Math.round(s.cadence), Math.round(s.hr), +game.player.v.toFixed(2),
        +T.altitude(game.playerY - T.heightRange()[0]).toFixed(1),
      ]);
    }
    return lap;   // eerste volle ronde net gereden -> rondetijd
  }

  function markJump() { if (rec) rec.jumped = true; }

  function stop(extra) {
    if (!rec) return null;
    const r = Object.assign(rec, extra || {});
    rec = null;
    const S = r.samples, n = Math.max(1, S.length);
    const sum = i => S.reduce((a, s) => a + s[i], 0);
    let gain = 0;
    for (let i = 1; i < S.length; i++) gain += Math.max(0, S[i][7] - S[i - 1][7]);
    Object.assign(r, {
      id: 'r' + Date.now(),
      duration: S.length,
      distance: Math.round(r.odo),
      avgW: Math.round(sum(3) / n),
      maxW: S.reduce((a, s) => Math.max(a, s[3]), 0),
      avgCad: Math.round(sum(4) / n),
      avgHr: Math.round(sum(5) / n),
      kj: Math.round(sum(3) / 1000),
      elevation: Math.round(gain),
    });
    delete r.acc;
    return r;
  }

  return { start, sample, markJump, stop, active: () => !!rec };
})();
