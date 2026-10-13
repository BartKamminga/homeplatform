// Ritoverzicht (tab RIDES in het planscherm, of MY RIDES / toets R): alle gereden ritten, hoe kort ook.
// Klik = detail met grafiek (vermogen per zone, hartslag, hoogte), FIT-download en verwijderen.
VBT.rides = (function () {
  const $ = id => document.getElementById(id);
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  let items = [], selectedId = null, trash = false;

  const fmtDur = s => {
    s = Math.round(s || 0);
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
  };
  const fmtDate = iso => {
    const d = new Date(iso);
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ' · ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };

  // server-ritten + ritten die nog in de outbox staan (nog niet gesynchroniseerd)
  async function load() {
    let server = [];
    const canTrash = !!VBT.storage.listTrash;
    $('ridesTrash').hidden = !canTrash;
    $('ridesTrash').textContent = trash ? '\u2190 BACK TO RIDES' : '\u{1F5D1} TRASH';
    if (trash) {
      try { items = await VBT.storage.listTrash(); } catch (e) { items = []; }
      renderList();
      $('ridesCount').textContent = items.length + ' IN TRASH';
      if (items[0]) select(items[0].id); else $('rideDetail').innerHTML = '<p class="hint">The trash is empty.</p>';
      return;
    }
    try { server = await VBT.storage.listRides(); } catch (e) { VBT.toast && VBT.toast('RIDES: ' + e.message, 6000); }
    const synced = new Set(server.map(r => r.clientId).filter(Boolean));
    const local = (await VBT.safety.pending())
      .filter(r => !synced.has(r.clientId))
      .map(r => Object.assign({}, r, { id: 'local:' + r.clientId, pending: true }));
    items = [...local, ...server].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    renderList();
    if (!selectedId && items[0]) select(items[0].id);
    else if (!items.length) $('rideDetail').innerHTML = '<p class="hint">No rides yet - every ride you start ends up here, however short.</p>';
  }

  function renderList() {
    const box = $('rideList');
    box.innerHTML = '';
    $('ridesCount').textContent = items.length + (items.length === 1 ? ' RIDE' : ' RIDES');
    for (const r of items) {
      const el = document.createElement('button');
      el.className = 'riderow' + (r.id === selectedId ? ' selected' : '');
      const live = r.inProgress && !(VBT.recorder.current() && VBT.recorder.current().clientId === r.clientId);
      const tags = (r.pending ? '<i class="tag pending">NOT SYNCED</i>' : '') +
        (r.inProgress ? '<i class="tag ' + (live ? 'pending">INTERRUPTED' : 'wo">IN PROGRESS') + '</i>' : '') + (r.recovered ? '<i class="tag wo">RECOVERED</i>' : '') +
        (r.pb ? '<i class="tag pb">PB</i>' : '') + (r.kind === 'workout' ? '<i class="tag wo">WORKOUT</i>' : '') +
        (r.stravaActivityId ? '<i class="tag strava">STRAVA</i>' : '');
      el.innerHTML = '<span class="rdate">' + fmtDate(r.startedAt) + '</span><b>' + (r.name || 'Ride').toUpperCase() + tags + '</b>' +
        '<span class="rmeta">' + fmtDur(r.duration) + ' · ' + (r.distance / 1000).toFixed(1) + ' KM · ' + r.avgW + ' W · ' + r.kj + ' KJ</span>';
      el.onclick = () => select(r.id);
      box.appendChild(el);
    }
  }

  async function select(id) {
    selectedId = id;
    renderList();
    const box = $('rideDetail');
    box.innerHTML = '<p class="hint">Loading…</p>';
    let ride;
    try { ride = id.startsWith('local:') ? items.find(r => r.id === id) : await VBT.storage.getRide(id); } catch (e) { box.innerHTML = '<p class="hint">Could not load ride: ' + e.message + '</p>'; return; }
    if (!ride || selectedId !== id) return;
    const stat = (v, l) => '<div><b>' + v + '</b><small>' + l + '</small></div>';
    const paused = Math.max(0, (ride.elapsed || 0) - ride.duration);
    const pauses = (ride.pauses || []).map(p => '<li>' + fmtDur(p.t) + ' &middot; ' + p.reason + ' &middot; ' + fmtDur(p.dur) + '</li>').join('');
    const events = (ride.events || []).map(e => '<li data-level="' + e.level + '"><i>' + new Date(e.t).toTimeString().slice(0, 8) +
      '</i> ' + e.type + ' &middot; ' + String(e.msg).replace(/</g, '&lt;') + '</li>').join('');
    box.innerHTML = '<div class="dhead"><div><small>' + fmtDate(ride.startedAt) + (ride.jumped ? ' · INTERVALS SKIPPED' : '') + '</small>' +
      '<h3>' + (ride.name || 'Ride').toUpperCase() + '</h3></div><div class="dbtns">' +
      (ride.deletedAt ? '<button id="rideRestore" class="ridebtn">&#8634; RESTORE</button>' : '<button id="rideDelete" class="ghostbtn">DELETE</button>') +
      '<button id="rideFit" class="ghostbtn">&#11015; .FIT</button>' +
      '<button id="rideContinue" class="ridebtn">CONTINUE RIDE &#9654;</button></div></div>' +
      '<div class="ridestats">' + stat(fmtDur(ride.duration), 'TIME') + stat((ride.distance / 1000).toFixed(2), 'KM') +
      stat(ride.avgW, 'AVG W') + stat(ride.maxW, 'MAX W') + stat(ride.kj, 'KJ') + stat(ride.avgCad, 'AVG RPM') +
      stat(ride.avgHr || '-', 'AVG BPM') + stat(ride.elevation, 'M UP') +
      (ride.elapsed ? stat(fmtDur(ride.elapsed), 'ELAPSED') + stat(fmtDur(paused), 'PAUSED') : '') + (ride.lapTime ? stat(fmtDur(ride.lapTime), 'BEST LAP') : '') +
      (ride.score !== null && ride.score !== undefined ? stat(ride.score + '%', 'CADENCE') : '') + '</div>';
    const c = document.createElement('canvas');
    c.width = 1100; c.height = 220; c.className = 'ridechart';
    box.appendChild(c);
    drawChart(c, ride.samples || []);
    if (pauses || events) {
      box.insertAdjacentHTML('beforeend', '<div class="ridelogs">' +
        (pauses ? '<details open><summary>PAUSES (' + ride.pauses.length + ')</summary><ul>' + pauses + '</ul></details>' : '') +
        (events ? '<details><summary>EVENT LOG (' + ride.events.length + ')</summary><ul class="rideevents">' + events + '</ul></details>' : '') + '</div>');
    }
    $('rideFit').onclick = () => VBT.fit.download(ride);
    $('rideFit').disabled = !(ride.samples && ride.samples.length);
    if ($('rideDelete')) $('rideDelete').onclick = () => remove(ride);
    if ($('rideRestore')) $('rideRestore').onclick = () => restore(ride);
    $('rideContinue').onclick = () => VBT.session.resumeRide(ride);
    $('rideContinue').disabled = !(ride.clientId && ride.samples && ride.samples.length);
    if ($('rideDelete')) $('rideDelete').hidden = !!ride.pending;     // wat nog niet op de server staat, kun je niet weggooien
  }

  // vermogen als staafjes in zonekleur, hoogte als vlak, hartslag als lijn
  function drawChart(c, S) {
    const ctx = c.getContext('2d'), W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    if (S.length < 2) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '14px Orbitron, sans-serif'; ctx.fillText('Too short for a chart', 16, H / 2); return; }
    const maxW = Math.max(100, ...S.map(s => s[3])) * 1.1;
    const alts = S.map(s => s[7]), aMin = Math.min(...alts), aMax = Math.max(...alts) || 1;
    const x = i => i / (S.length - 1) * W;
    ctx.fillStyle = 'rgba(155,92,255,.18)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    S.forEach((s, i) => ctx.lineTo(x(i), H - (s[7] - aMin) / (aMax - aMin || 1) * H * 0.6));
    ctx.lineTo(W, H);
    ctx.fill();
    const bw = Math.max(1, W / S.length);
    S.forEach((s, i) => {
      ctx.fillStyle = VBT.util.zoneFor(s[3]).color;
      const h = s[3] / maxW * H;
      ctx.fillRect(x(i) - bw / 2, H - h, bw, h);
    });
    if (S.some(s => s[5] > 0)) {
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      S.forEach((s, i) => { const y = H - s[5] / 200 * H; if (i) ctx.lineTo(x(i), y); else ctx.moveTo(x(i), y); });
      ctx.stroke();
    }
  }

  async function remove(ride) {
    if (!window.confirm('Move this ride (' + fmtDate(ride.startedAt) + ') to the trash? You can restore it from TRASH.')) return;
    try { await VBT.storage.deleteRide(ride.id); } catch (e) { VBT.toast && VBT.toast(e.message, 6000); return; }
    selectedId = null;
    load();
  }

  async function restore(ride) {
    try { await VBT.storage.restoreRide(ride.id); } catch (e) { VBT.toast && VBT.toast(e.message, 6000); return; }
    VBT.toast && VBT.toast('RIDE RESTORED');
    trash = false;
    selectedId = ride.id;
    load();
  }

  function toggleTrash() { trash = !trash; selectedId = null; load(); }

  return { load, select, toggleTrash };
})();
