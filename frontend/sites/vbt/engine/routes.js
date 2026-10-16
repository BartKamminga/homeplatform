// Routes (item 1365): gegenereerde parcoursen en eigen GPX-routes. Een route rijdt als een climb: SIM (de trainer
// volgt de helling), finish aan het eind, je beste tijd rijdt mee als ghost. Slugs: gen-<type> en gpx-<id>;
// climbs.get() stuurt die hierheen. Secties: [[meter, helling%], ...] plus een bocht per sectie.
VBT.routes = (function () {
  const SECTION_M = 100;
  const GEN = {
    'flat-tt': { name: 'Flat Time Trial', km: 20 },
    rolling: { name: 'Rolling Hills', km: 25 },
    hilly: { name: 'Hill Every 3 km', km: 21 },
    criterium: { name: 'Criterium · 10 Laps', km: 15 },
  };
  const cache = {};

  // vaste pseudo-random reeks per type: elke keer hetzelfde parcours (ghost/PB blijft eerlijk)
  function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  function generate(type) {
    const g = GEN[type];
    if (!g) return null;
    const n = Math.round(g.km * 1000 / SECTION_M), r = rng(type.length * 7919 + 13), segs = [], curves = [];
    for (let i = 0; i < n; i++) {
      const km = i * SECTION_M / 1000;
      let grade = 0, curve = Math.sin(i / 9) * 1.2 + (r() - 0.5);
      if (type === 'rolling') grade = Math.sin(km / 1.5 * Math.PI * 2) * 3 + (r() - 0.5);
      if (type === 'hilly') { const p = km % 3; grade = p >= 1.5 && p < 2.5 ? 6 + (r() - 0.5) * 2 : p >= 2.5 ? -5 : 0.5; }
      if (type === 'flat-tt') grade = (r() - 0.5) * 0.8;
      if (type === 'criterium') { const p = i % 15; curve = p === 3 || p === 7 || p === 11 || p === 14 ? 7 : 0; grade = p < 7 ? 1 : -1; }
      segs.push([SECTION_M, Math.round(grade * 10) / 10]);
      curves.push(Math.round(curve * 10) / 10);
    }
    return finish({ slug: 'gen-' + type, name: g.name, source: 'generated', segments: segs, curves });
  }

  function finish(r) {
    const distance = r.segments.reduce((t, s) => t + s[0], 0);
    const elevation = Math.round(r.segments.reduce((t, s) => t + Math.max(0, s[0] * s[1] / 100), 0));
    return Object.assign({ climb: true, route: true, distance, elevation, avgGrade: +(elevation / distance * 100).toFixed(1) }, r);
  }

  // ── GPX -> secties ──────────────────────────────────────────────────────────────────────────
  const R = 6371000, rad = d => d * Math.PI / 180;
  function haversine(a, b) {
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const bearing = (a, b) => Math.atan2(Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat)),
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon)));

  function parseGpx(text, fallbackName) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('This is not a valid GPX file');
    const pts = [...doc.querySelectorAll('trkpt, rtept')].map(p => ({
      lat: +p.getAttribute('lat'), lon: +p.getAttribute('lon'), ele: p.querySelector('ele') ? +p.querySelector('ele').textContent : null,
    })).filter(p => isFinite(p.lat) && isFinite(p.lon));
    if (pts.length < 10) throw new Error('The GPX file has too few points');
    if (pts.every(p => p.ele === null)) throw new Error('The GPX file has no elevation data');
    // afstand langs de route, hoogte gladstrijken (GPS-ruis), dan per 100 m: helling en bocht
    let d = 0;
    pts.forEach((p, i) => { if (i) d += haversine(pts[i - 1], p); p.d = d; if (p.ele === null) p.ele = pts[i - 1].ele; });
    const smooth = pts.map((p, i) => { const w = pts.slice(Math.max(0, i - 3), i + 4); return w.reduce((t, q) => t + q.ele, 0) / w.length; });
    const at = m => { let i = pts.findIndex(p => p.d >= m); if (i < 1) i = Math.max(1, i < 0 ? pts.length - 1 : 1); return i; };
    const segs = [], curves = [];
    for (let m = 0; m + SECTION_M <= d; m += SECTION_M) {
      const i = at(m), j = at(m + SECTION_M), k = at(Math.min(d, m + 2 * SECTION_M));
      const grade = (smooth[j] - smooth[i]) / Math.max(1, pts[j].d - pts[i].d) * 100;
      let turn = bearing(pts[j - 1], pts[j]) - bearing(pts[i - 1], pts[i]);
      if (k > j) turn = bearing(pts[j], pts[k]) - bearing(pts[i], pts[j]);
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));                      // -pi..pi
      segs.push([SECTION_M, Math.round(Math.max(-25, Math.min(25, grade)) * 10) / 10]);
      curves.push(Math.round(Math.max(-8, Math.min(8, turn * 8)) * 10) / 10);
    }
    if (segs.length > 3000) throw new Error('Routes up to 300 km are supported');
    const name = (doc.querySelector('trk > name, rte > name, metadata > name')?.textContent || fallbackName || 'My route').trim().slice(0, 120);
    return { name, segments: segs, curves };
  }

  async function importGpx(file) {
    const parsed = parseGpx(await file.text(), file.name.replace(/\.gpx$/i, ''));
    return finish(Object.assign(await VBT.storage.saveRoute(parsed), { climb: true, route: true }));
  }

  async function list() {
    const gen = Object.keys(GEN).map(generate);
    let mine = [];
    try { mine = VBT.storage.listRoutes ? await VBT.storage.listRoutes() : []; } catch (e) { mine = []; }
    return gen.concat(mine.map(r => Object.assign({ climb: true, route: true }, r)));
  }

  async function get(slug) {
    if (slug.startsWith('gen-')) return generate(slug.slice(4));
    if (!cache[slug]) cache[slug] = finish(Object.assign(await VBT.storage.getRoute(slug.slice(4)), { climb: true, route: true }));
    return cache[slug];
  }

  return { list, get, generate, parseGpx, importGpx, remove: id => VBT.storage.deleteRoute(id) };
})();
