// Parcours in echte meters en hellingspercentages. Visueel wordt de hoogte overdreven
// (cfg.verticalExaggeration), fysica en HUD gebruiken de echte helling.
VBT.track = (function () {
  const { cfg, util } = VBT;
  const segments = [];
  const SEG_M = () => cfg.segmentLength / cfg.unitsPerMeter;          // meter per segment
  let minY = 0, maxY = 0;

  // m = lengte, g = helling (%), c = bochten (verdeeld over de sectie), tag = decor-haakje
  const COURSE = [
    { m: 250, g: 0, c: [0, 1.5], tag: 'start' },
    { m: 300, g: 2, c: [-2, 0] },
    { m: 250, g: -2, c: [2] },
    { m: 200, g: 0, c: [0] },
    { m: 800, g: 6, c: [3, -3, 0, -4, 2], tag: 'climb' },
    { m: 300, g: 2, c: [0, 1] },
    { m: 700, g: -6, c: [-3, 4, -2, 0] },
    { m: 400, g: 0, c: [0, 2, 0] },
    { m: 400, g: 8, c: [-2, 3], tag: 'climb' },
    { m: 300, g: 10, c: [-4, 4] },
    { m: 300, g: 7, c: [0, -2], tag: 'kom' },
    { m: 900, g: -7, c: [3, -4, 3, 0] },
    { m: 500, g: 0, c: [0], tag: 'sprint' },
  ];
  const RAMP_M = 40;   // overgang tussen twee hellingen

  function lastY() { return segments.length === 0 ? 0 : segments[segments.length - 1].p2.world.y; }

  function addSegment(curve, y) {
    const n = segments.length;
    segments.push({
      index: n,
      p1: { world: { y: lastY(), z: n * cfg.segmentLength }, camera: {}, screen: {} },
      p2: { world: { y, z: (n + 1) * cfg.segmentLength }, camera: {}, screen: {} },
      curve,
      sprites: [],
    });
  }

  function curveAt(curves, p) {
    const k = Math.min(curves.length - 1, Math.floor(p * curves.length));
    const local = p * curves.length - k;
    const c = curves[k];
    if (local < 0.25) return util.easeIn(0, c, local / 0.25);
    if (local > 0.75) return util.easeInOut(c, 0, (local - 0.75) / 0.25);
    return c;
  }

  function addSection(sec, fromGrade) {
    const n = Math.round(sec.m / SEG_M());
    const ramp = Math.min(Math.round(RAMP_M / SEG_M()), n / 2);
    const g = sec.g / 100;
    for (let i = 0; i < n; i++) {
      const grade = i < ramp ? util.easeInOut(fromGrade, g, i / ramp) : g;
      addSegment(curveAt(sec.c, i / n), lastY() + grade * cfg.segmentLength * cfg.verticalExaggeration);
    }
    return g;
  }

  // course: lijst secties; zonder argument het vaste vrije-rit-parcours.
  // loop: false = niet terug naar starthoogte (climb: anders kilometers afdaling achter de top)
  function build(course = COURSE, { loop = true } = {}) {
    segments.length = 0;
    const marks = [];
    let grade = 0;
    for (const sec of course) {
      marks.push({ at: segments.length, sec });
      grade = addSection(sec, grade);
    }
    // slot: rustig terug naar startniveau, zodat de lus naadloos sluit
    const startY = lastY(), closeN = loop ? Math.round(Math.max(400, Math.abs(altitude(startY)) / 0.06) / SEG_M()) : 0;
    for (let i = 1; i <= closeN; i++) addSegment(0, util.easeInOut(startY, 0, i / closeN));
    marks.push({ at: segments.length, sec: { tag: 'end' } });

    placeDecor(marks);
    minY = Infinity; maxY = -Infinity;
    for (const s of segments) { minY = Math.min(minY, s.p1.world.y); maxY = Math.max(maxY, s.p1.world.y); }
  }

  function addSprite(n, sprite, offset) {
    if (segments[n]) segments[n].sprites.push({ source: sprite, offset });
  }

  function placeDecor(marks) {
    const S = VBT.sprites;
    const N = segments.length;
    addSprite(4, S.GANTRY, -1.3);
    for (let n = 10; n < N; n += 12) {
      addSprite(n, S.LAMP_L, -1.12);
      addSprite(n, S.LAMP_R, 1.12);
    }
    for (let n = 16; n < N; n += 18 + (n % 7)) {
      addSprite(n, S.PALM_L, -1.45 - (n % 3) * 0.35);
      addSprite(n + 9, S.PALM_R, 1.45 + (n % 4) * 0.3);
    }
    marks.forEach((mk, i) => {
      const { sec, at } = mk;
      if (sec.g >= 4 && sec.sign !== false) addSprite(Math.max(0, at - 60), S.gradeSign(Math.round(sec.g) + '%'), 1.25);
      if (sec.tag === 'finish' && marks[i + 1]) addSprite(marks[i + 1].at, S.GANTRY, -1.3);
      if (sec.tag === 'climb') addSprite(at - 300, S.BILL_WATT, -1.9);
      if (sec.tag === 'kom' && marks[i + 1]) addSprite(marks[i + 1].at - 20, S.BILL_KOM, 1.9);
      if (sec.tag === 'sprint') addSprite(at + 40, S.BILL_SPRINT, -1.9);
    });
    addSprite(60, S.BILL_VBT, 1.9);
    VBT.scenery.place(addSprite, segments, marks);     // publiek, km-bordjes, wereld-decor, tunnels/bruggen (1361)
  }

  function find(z) {
    return segments[Math.floor(z / cfg.segmentLength) % segments.length];
  }

  // Echte helling (fractie) op een segment
  function gradeAt(index) {
    const s = segments[util.wrap(index, segments.length)];
    const g = (s.p2.world.y - s.p1.world.y) / cfg.segmentLength / cfg.verticalExaggeration;
    return util.clamp(g, -cfg.maxGrade, cfg.maxGrade);
  }

  // Echte hoogte in meters bij een wereld-y
  function altitude(y) { return y / (cfg.unitsPerMeter * cfg.verticalExaggeration); }

  return {
    segments,
    build,
    addSprite,
    find,
    gradeAt,
    altitude,
    length: () => segments.length * cfg.segmentLength,
    lapMeters: () => segments.length * SEG_M(),
    heightRange: () => [minY, maxY],
  };
})();
