// Workout-paneel (geen DOM): doelwatt, doelcadans, resterende tijd en volgend interval als model voor het snapshot.
VBT.workoutHud = (function () {
  const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function stepText(st) {
    if (!st) return 'FINISH';
    const pct = st.a === st.b ? st.a + '%' : st.a + '-' + st.b + '%';
    return pct + ' · ' + fmt(st.d) + (st.c ? ' · ' + st.c + ' RPM' : '');
  }

  function model(game) {
    const run = game.run;
    if (!run) return null;
    const out = {
      name: run.wo.name.toUpperCase(), left: fmt(run.total - run.elapsed) + ' LEFT',
      score: run.cadTotal > 0 ? Math.round(run.cadOk / run.cadTotal * 100) : 100,
      progress: run.total ? run.elapsed / run.total : 0, free: !!run.wo.free,
    };
    if (run.wo.free) {
      return Object.assign(out, { watts: '—', pct: 'FREE RIDE', cad: '', cadOff: false, remain: fmt(run.total - run.elapsed), next: 'RIDE AS YOU LIKE' });
    }
    const cur = VBT.workout.current(run, VBT.cfg.rider.ftp);
    return Object.assign(out, {
      watts: cur.step.allOut ? 'MAX' : cur.watts,
      pct: cur.step.allOut ? 'ALL OUT - YOUR PACE' : Math.round(cur.pct) + '% FTP',
      cad: cur.cadence ? cur.cadence + ' RPM' : 'ANY RPM',
      cadOff: !!cur.cadence && Math.abs(game.sensors.cadence - cur.cadence) > 6,
      remain: fmt(cur.remaining), next: 'NEXT ' + stepText(cur.next),
    });
  }

  return { model, stepText };
})();
