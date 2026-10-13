// Rit-opname: 1 sample per seconde rijtijd (pauzes tellen niet mee).
// sample = [t, pos, odo, watt, cadans, hartslag, snelheid, hoogte]
//   pos = plek op het parcours (voor de ghost), odo = echt gereden afstand (springen telt niet mee)
VBT.recorder = (function () {
  let rec = null;

  function start(meta) {
    const clientId = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);   // zelfde id in journal en outbox
    rec = Object.assign({ clientId, startedAt: new Date().toISOString(), samples: [], odo: 0, acc: 0, lapTime: null, jumped: false,
      elapsed: 0, pauses: [] }, meta);
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

  // laatste (deel)seconde ook bewaren, zodat zelfs een rit van een paar tellen data heeft
  function flush(game) {
    if (!rec || rec.acc < 0.05) return;
    rec.acc = 1;
    sample(game, 0);
  }

  // oude rit hervatten: verder opnemen in dezelfde rit (zelfde clientId, bestaande samples)
  function resume(r) {
    const S = r.samples || [], last = S[S.length - 1];
    rec = {
      clientId: r.clientId, startedAt: r.startedAt, kind: r.kind, courseKey: r.courseKey, name: r.name, woId: r.woId,
      ftp: r.ftp, samples: S.slice(), odo: last ? last[2] : 0, acc: 0, lapTime: r.lapTime || null, jumped: !!r.jumped,
      elapsed: r.elapsed || S.length, pauses: (r.pauses || []).slice(),
    };
    return rec;
  }

  // elke update (ook in pauze): klok-tijd bijhouden en pauzes met reden vastleggen, zodat altijd
  // terug te zien is waar tijd bleef (bv. 'trainer signal lost')
  const REASONS = { paused: 'paused', confirm: 'stop question', countdown: 'countdown' };
  function tick(game, dt) {
    if (!rec) return;
    rec.elapsed = (rec.elapsed || 0) + dt;
    const riding = game.state === 'ride';
    if (!riding && !rec.openPause) {
      rec.openPause = { t: +game.rideTime.toFixed(1), at: Date.now(),
        reason: game.autoPaused ? 'trainer signal lost' : REASONS[game.state] || game.state };
      if (rec.openPause.reason !== 'countdown' && VBT.store) VBT.store.log('pause', 'Paused: ' + rec.openPause.reason, game.autoPaused ? 'warn' : 'info');
    } else if (!riding && rec.openPause && game.autoPaused && rec.openPause.reason !== 'trainer signal lost') {
      rec.openPause.reason = 'trainer signal lost';
      if (VBT.store) VBT.store.log('pause', 'Paused: trainer signal lost', 'warn');
    } else if (riding && rec.openPause) {
      closePause();
    }
  }
  function closePause() {
    const p = rec.openPause;
    rec.openPause = null;
    const dur = Math.round((Date.now() - p.at) / 100) / 10;
    if (p.reason !== 'countdown' && dur >= 1) {
      rec.pauses.push({ t: p.t, dur, reason: p.reason });
      if (VBT.store) VBT.store.log('resume', 'Resumed after ' + dur + ' s (' + p.reason + ')');
    }
  }

  function markJump() { if (rec) rec.jumped = true; }

  function stop(extra) {
    if (!rec) return null;
    const r = Object.assign(rec, extra || {});
    if (r.openPause) { rec = r; closePause(); }
    rec = null;
    return finalize(r);
  }

  // samenvatting berekenen; werkt ook op een rit uit het journal (na een crash)
  function finalize(r) {
    const S = r.samples, n = Math.max(1, S.length);
    const sum = i => S.reduce((a, s) => a + s[i], 0);
    let gain = 0;
    for (let i = 1; i < S.length; i++) gain += Math.max(0, S[i][7] - S[i - 1][7]);
    Object.assign(r, {
      id: r.clientId || 'r' + Date.now(),
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
    delete r.openPause;
    r.elapsed = Math.round(r.elapsed || S.length);
    r.pauses = r.pauses || [];
    // eventlog van deze rit meenemen (zonder backup-ticks), zodat we later kunnen terugzien wat er gebeurde
    const since = Date.parse(r.startedAt) - 5000;
    r.events = VBT.store ? VBT.store.getEvents().filter(e => e.t >= since && e.level !== 'debug').slice(-500)
      .map(e => ({ t: e.t, rideTime: e.rideTime, type: e.type, level: e.level, msg: e.msg })) : [];
    return r;
  }

  return { start, resume, tick, sample, flush, markJump, stop, finalize, current: () => rec, active: () => !!rec };
})();
