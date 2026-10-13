// HUD tijdens een workout: doelwatt, doelcadans, resterende tijd, volgend interval en blokkengrafiek
VBT.workoutHud = (function () {
  const $ = id => document.getElementById(id);
  const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  let last = 0;

  function stepText(st) {
    if (!st) return 'FINISH';
    const pct = st.a === st.b ? st.a + '%' : st.a + '-' + st.b + '%';
    return pct + ' · ' + fmt(st.d) + (st.c ? ' · ' + st.c + ' RPM' : '');
  }

  function update(game, t) {
    const run = game.run;
    document.body.classList.toggle('workout', !!run);
    if (!run || t - last < 0.1) return;
    last = t;
    const ftp = VBT.cfg.rider.ftp;
    const s = game.sensors;
    $('wName').textContent = run.wo.name.toUpperCase();
    $('wLeft').textContent = fmt(run.total - run.elapsed) + ' LEFT';
    if (run.wo.free) {
      $('wWatts').textContent = '—';
      $('wPct').textContent = 'FREE RIDE';
      $('wCad').textContent = '';
      $('wRemain').textContent = fmt(run.total - run.elapsed);
      $('wNext').textContent = 'RIDE AS YOU LIKE';
    } else {
      const cur = VBT.workout.current(run, ftp);
      $('wWatts').textContent = cur.step.allOut ? 'MAX' : cur.watts;
      $('wPct').textContent = cur.step.allOut ? 'ALL OUT - YOUR PACE' : Math.round(cur.pct) + '% FTP';
      const cad = $('wCad');
      cad.textContent = cur.cadence ? cur.cadence + ' RPM' : 'ANY RPM';
      cad.className = 'wcad' + (cur.cadence && Math.abs(s.cadence - cur.cadence) > 6 ? ' off' : '');
      $('wRemain').textContent = fmt(cur.remaining);
      $('wNext').textContent = 'NEXT ' + stepText(cur.next);
    }
    const score = run.cadTotal > 0 ? Math.round(run.cadOk / run.cadTotal * 100) : 100;
    $('wScore').textContent = 'CADENCE ' + score + '%';
    const c = $('wChart');
    VBT.workout.drawChart(c.getContext('2d'), run.wo, c.width, c.height, run.elapsed / run.total);
  }

  // Eindscherm met de samenvatting van de opgeslagen rit
  function showFinish(ride, heading, sub) {
    if (VBT.ftp) setTimeout(() => VBT.ftp.showProposal(ride), 0);   // FTP-test: nieuwe FTP voorstellen
    $('finishTitle').textContent = heading;
    $('finishName').textContent = sub;
    $('finishStats').innerHTML =
      '<div><b>' + fmt(ride.duration) + '</b><small>TIME</small></div>' +
      '<div><b>' + (ride.distance / 1000).toFixed(1) + '</b><small>KM</small></div>' +
      '<div><b>' + ride.avgW + '</b><small>AVG W</small></div>' +
      '<div><b>' + ride.kj + '</b><small>KJ</small></div>' +
      '<div><b>' + ride.elevation + '</b><small>M UP</small></div>' +
      (ride.score !== undefined ? '<div><b>' + ride.score + '%</b><small>CADENCE</small></div>' : '') +
      (ride.lapTime ? '<div><b>' + fmt(ride.lapTime) + '</b><small>BEST LAP</small></div>' : '');
  }

  return { update, showFinish, stepText };
})();
