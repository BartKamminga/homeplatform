// FTP-tests: herkennen (Ramp Test / FTP Test), het 20-min-blok vrij rijden (niet ERG), ramp test stopt als je
// het doel niet meer haalt, nieuwe FTP berekenen (het finish-scherm stelt hem voor: ACCEPT / KEEP) + FTP-historie.
//   Ramp Test:  75% van het beste 1-minuut-gemiddelde
//   FTP Test:   95% van het beste 20-minuten-gemiddelde
VBT.ftp = (function () {
  const FAIL_RATIO = 0.6, FAIL_S = 5;
  let failFor = 0, finishing = false;

  function testType(nameOrWo) {
    const name = typeof nameOrWo === 'string' ? nameOrWo : (nameOrWo && nameOrWo.name) || '';
    if (/ramp test/i.test(name)) return 'ramp';
    if (/ftp test/i.test(name)) return 'ftp20';
    return null;
  }

  // 20-min FTP test: het lange all-out blok wordt vrij (geen ERG) - in ERG zou de trainer het vermogen afdwingen
  function prepare(wo) {
    if (testType(wo) !== 'ftp20') return wo;
    return Object.assign({}, wo, { steps: wo.steps.map(s => (s.d >= 1200 && Math.max(s.a, s.b) >= 100 ? Object.assign({}, s, { free: true, allOut: true }) : s)) });
  }

  // beste gemiddelde over n seconden (samples 1 Hz, watt op index 3)
  function bestAvg(samples, n) {
    if (samples.length < n) return null;
    let sum = 0, best = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i][3];
      if (i >= n) sum -= samples[i - n][3];
      if (i >= n - 1) best = Math.max(best, sum / n);
    }
    return best;
  }

  function compute(ride) {
    const type = testType(ride.name), S = ride.samples || [];
    if (type === 'ramp') { const b = bestAvg(S, 60); return b ? { type, ftp: Math.round(0.75 * b), basis: Math.round(b), label: 'best 1 min' } : null; }
    if (type === 'ftp20') { const b = bestAvg(S, 1200); return b ? { type, ftp: Math.round(0.95 * b), basis: Math.round(b), label: 'best 20 min' } : null; }
    return null;
  }

  // ramp test: blijft het vermogen 5 s onder 60% van het doel (boven 100% FTP), dan is de test klaar
  function monitor(game, dt) {
    const run = game.run;
    if (game.state !== 'ride' || !run || run.done || testType(run.wo) !== 'ramp') { failFor = 0; finishing = false; return; }
    const cur = VBT.workout.current(run, VBT.cfg.rider.ftp);
    if (cur.pct <= 100 || finishing) { failFor = 0; return; }
    failFor = game.sensors.watts < cur.watts * FAIL_RATIO ? failFor + dt : 0;
    if (failFor >= FAIL_S) {
      finishing = true;
      VBT.store.log('lap', 'Ramp test finished at ' + cur.watts + ' W target');
      VBT.hud.message('RAMP TEST DONE!', VBT.palette.yellow);
      VBT.session.finish(true);
    }
  }

  // FTP instellen + historie (bron: test-naam of 'manual')
  function setFtp(value, source) {
    const prev = VBT.cfg.rider.ftp;
    const ftp = VBT.calendar.setFtp(value);
    if (ftp !== prev) {
      const history = (VBT.settings.values.ftpHistory || []).concat([{ date: new Date().toISOString().slice(0, 10), ftp, prev, source }]).slice(-50);
      VBT.settings.save({ ftpHistory: history });
      VBT.store.log('save', 'FTP ' + prev + ' -> ' + ftp + ' W (' + source + ')');
    }
    return ftp;
  }

  return { testType, prepare, bestAvg, compute, monitor, setFtp };
})();
