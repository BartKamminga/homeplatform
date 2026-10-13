// Climb Training: de beklimmingen van de Zwift climb portals (/api/vbt/climbs) als echt parcours.
// Een climb is geen ERG-workout: je rijdt in SIM (de trainer volgt de helling) en de rit stopt op de top.
// Tijd tot de top telt als 'lap' per climb (courseKey climb-<slug>), dus je beste tijd rijdt mee als ghost.
VBT.climbs = (function () {
  const $ = id => document.getElementById(id);
  const START_M = 150, RUNOUT_M = 300;
  let list = [];
  const cache = {};

  async function load() {
    if (!VBT.storage.listClimbs) return [];
    try { list = await VBT.storage.listClimbs(); } catch (e) { list = []; }
    return list;
  }

  async function get(slug) {
    if (!cache[slug]) cache[slug] = Object.assign({ climb: true }, await VBT.storage.getClimb(slug));
    return cache[slug];
  }

  // vlakke aanloop, de climb zelf (haarspeldbochten), finish op de top, uitloop
  function course(climb) {
    const secs = [{ m: START_M, g: 0, c: [0, 1], tag: 'start' }];
    let lastSign = null;
    climb.segments.forEach(([m, g], i) => {
      const bend = ((i * 7919) % 13) / 13 - 0.5;            // vast patroon, zelfde parcours bij elke rit
      const sign = g >= 4 && (lastSign === null || Math.abs(Math.round(g) - lastSign) >= 2);
      if (sign) lastSign = Math.round(g);
      secs.push({ m, g, c: [bend * 6, -bend * 4], sign, tag: i === climb.segments.length - 1 ? 'finish' : '' });
    });
    secs.push({ m: RUNOUT_M, g: 0, c: [0] });
    return secs;
  }

  const summitMeters = climb => START_M + climb.segments.reduce((t, s) => t + s[0], 0);

  // kleur per helling: groen (vlak) -> geel -> oranje -> rood -> paars (>= 12%)
  function gradeColor(g) {
    if (g < 2) return '#59bf59';
    if (g < 5) return '#ddbc42';
    if (g < 8) return '#ff7b24';
    if (g < 12) return '#ff3c3c';
    return '#b44cff';
  }

  // hoogteprofiel; zonder segmenten (lijst) een simpele helling van de gemiddelde steilheid
  function chart(climb, W, H, cls) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    if (cls) c.className = cls;
    const ctx = c.getContext('2d');
    const segs = climb.segments || [[climb.distance, climb.avgGrade]];
    const total = segs.reduce((t, s) => t + s[0], 0);
    let x = 0, y = 0;
    const pts = segs.map(([m, g]) => { x += m; y += m * g / 100; return [x, y, g]; });
    const top = Math.max(1, ...pts.map(p => p[1]));
    const sx = m => m / total * W, sy = h => H - 2 - Math.max(0, h) / top * (H - 4);
    let px = 0, py = 0;
    for (const [mx, my, g] of pts) {
      ctx.fillStyle = gradeColor(g);
      ctx.beginPath();
      ctx.moveTo(sx(px), H); ctx.lineTo(sx(px), sy(py)); ctx.lineTo(sx(mx), sy(my)); ctx.lineTo(sx(mx), H);
      ctx.fill();
      px = mx; py = my;
    }
    return c;
  }

  const km = m => (m / 1000).toFixed(1) + ' KM';
  const meta = cl => km(cl.distance) + ' · ' + cl.elevation + ' HM · ' + cl.avgGrade + '%';
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  function card(cl, onSelect) {
    const el = document.createElement('button');
    el.className = 'wcard libcard';
    el.innerHTML = '<span class="wdate">' + (cl.category ? 'CAT ' + cl.category : 'CLIMB') + '</span><b>' +
      cl.name.toUpperCase() + '</b><span class="wmeta">' + meta(cl) + '</span>';
    el.appendChild(chart(cl, 150, 32, 'wmini'));
    el.onclick = () => onSelect(el, cl);
    return el;
  }

  // detailpaneel (zelfde plek als bij workouts): profiel, beste tijd, RIDE
  async function select(cl) {
    const box = $('planDetail');
    let climb;
    try { climb = await get(cl.slug); } catch (e) { box.innerHTML = '<p class="hint">Climb not found.</p>'; return; }
    box.innerHTML = '<div class="dhead"><div><small>LIBRARY · CLIMB TRAINING' + (climb.category ? ' · CAT ' + climb.category : '') +
      '</small><h3>' + climb.name.toUpperCase() + '</h3><span>' + meta(climb) + ' · MAX ' + climb.maxGrade + '% · SIM</span>' +
      '<span id="climbPb" class="dres"></span></div><div class="dbtns"><button id="climbRide" class="ridebtn">RIDE &#9654;</button></div></div>';
    box.appendChild(chart(climb, 900, 110, 'dchart'));
    $('climbRide').onclick = () => VBT.session.startRide(climb);
    VBT.storage.bestLap('climb-' + climb.slug).then(best => {
      if (best && best.lapTime && $('climbPb')) $('climbPb').textContent = 'PB ' + fmt(best.lapTime) + ' · ' + best.avgW + ' W AVG';
    }).catch(() => { /* geen PB */ });
  }

  return { load, get, course, summitMeters, card, select, list: () => list };
})();
