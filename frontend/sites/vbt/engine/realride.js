// Real Ride (prototype): bij een GPX-route met Mapillary-straatfoto's laat de UI (RealRideView) de foto van de
// plek waar je nu bent zien, in plaats van de getekende weg. De game zelf (fysica, opname, ghost) loopt gewoon
// door; dit is alleen een ander beeld. Waar geen foto is, zie je de gewone weg.
VBT.realride = (function () {
  const SECTION_M = 100, GAP_M = 400;
  let photos = null, slug = null, startM = 0, loading = false;

  async function start(route) {
    stop();
    loading = true;
    try {
      const list = await VBT.storage.routePhotos(route.id);
      photos = (list || []).sort((a, b) => a.i - b.i);
      slug = route.slug;
      startM = VBT.climbs.summitMeters(route) - route.segments.reduce((t, s) => t + s[0], 0);
      VBT.store && VBT.store.log('settings', 'Real Ride: ' + photos.length + ' photos for ' + route.name);
    } finally { loading = false; }
    return photos.length;
  }

  function stop() { photos = null; slug = null; }

  // foto bij een afstand (meter op het parcours): de laatste foto vóór je, de volgende, en hoe ver je ertussen bent
  function at(dist) {
    const g = VBT.game;
    if (!photos || !photos.length || !g.climb || g.climb.slug !== slug) return null;
    const m = dist - startM, sec = m / SECTION_M;
    let k = -1;
    for (let i = 0; i < photos.length && photos[i].i <= sec; i++) k = i;
    // in de aanloop (vóór de route) al de eerste foto als die aan het begin ligt
    if (k < 0) return m < 0 && photos[0].i === 0 ? { cur: photos[0], next: photos[1] || null, gap: false, frac: 0 } : { cur: null, next: photos[0], gap: true };
    const cur = photos[k], next = photos[k + 1] || null;
    const gap = m - cur.i * SECTION_M > GAP_M;
    const span = next ? (next.i - cur.i) * SECTION_M : SECTION_M;
    return { cur, next, gap, frac: VBT.util.clamp((m - cur.i * SECTION_M) / span, 0, 1) };
  }

  return { start, stop, at, active: () => !!photos, loading: () => loading };
})();
