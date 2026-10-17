// Climb Training: de beklimmingen van de Zwift climb portals (/api/vbt/climbs) als echt parcours.
// Een climb is geen ERG-workout: je rijdt in SIM (de trainer volgt de helling) en de rit stopt op de top.
// Tijd tot de top telt als 'lap' per climb (courseKey climb-<slug>), dus je beste tijd rijdt mee als ghost.
VBT.climbs = (function () {
  const START_M = 150, RUNOUT_M = 300;
  let list = [];
  const cache = {};

  async function load() {
    if (!VBT.storage.listClimbs) return [];
    try { list = await VBT.storage.listClimbs(); } catch (e) { list = []; }
    return list;
  }

  async function get(slug) {
    if (/^(gen|gpx)-/.test(slug)) return VBT.routes.get(slug);            // routes (1365) rijden als een climb
    if (!cache[slug]) cache[slug] = Object.assign({ climb: true }, await VBT.storage.getClimb(slug));
    return cache[slug];
  }

  // vlakke aanloop, de climb zelf (haarspeldbochten), finish op de top, uitloop
  function course(climb) {
    // echte GPX-route: geen verzonnen tunnels/bruggen (scenery.autoStructures kijkt naar real)
    const secs = [{ m: START_M, g: 0, c: [0, 1], tag: 'start', real: climb.source === 'gpx' }];
    let lastSign = null;
    climb.segments.forEach(([m, g], i) => {
      const bend = ((i * 7919) % 13) / 13 - 0.5;            // vast patroon, zelfde parcours bij elke rit
      const sign = g >= 4 && (lastSign === null || Math.abs(Math.round(g) - lastSign) >= 2);
      if (sign) lastSign = Math.round(g);
      const c = climb.curves ? [climb.curves[i]] : [bend * 6, -bend * 4];   // route: echte bochten (GPX)
      secs.push({ m, g, c, sign, tag: i === climb.segments.length - 1 ? 'finish' : '' });
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

  // hoogteprofiel (gekleurd per helling) op een bestaand canvas; zonder segmenten een rechte helling
  function drawProfile(ctx, climb, W, H) {
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
  }

  const meta = cl => (cl.distance / 1000).toFixed(1) + ' KM · ' + cl.elevation + ' HM · ' + cl.avgGrade + '%';

  return { load, get, course, summitMeters, drawProfile, meta };
})();
