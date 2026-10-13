// Virtueel peloton: een groep bots die als één blok rijdt (eigen fysica, met slipstream),
// met renners in een formatie van rijen die een beetje heen en weer zwalken.
VBT.peloton = (function () {
  const { cfg } = VBT;
  const COLS = 3, ROW_GAP = 2.2, COL_GAP = 0.24;

  function create(size = 15, startAhead = 14) {
    const bots = [];
    for (let i = 0; i < size; i++) {
      bots.push({
        row: Math.floor(i / COLS), col: i % COLS, seed: i * 1.73,
        kit: VBT.rider.teamKit(i), phase: i * 0.9, cadence: 84 + (i * 7) % 14,
        x: 0, dist: 0,
      });
    }
    return { v: 0, dist: startAhead, centerX: -0.05, rows: Math.ceil(size / COLS), bots };
  }

  // watts: in een workout rijdt het peloton het doelvermogen mee, anders ~80% FTP + extra op klimmen
  function update(pack, dt, t, gradeAt, moving, watts) {
    const grade = gradeAt(pack.dist);
    if (moving) {
      const w = watts || cfg.rider.ftp * 0.8 + Math.max(0, grade) * 1400 + Math.sin(t / 11) * 15;
      VBT.physics.step(pack, w, grade, dt, 0.75);
    }
    pack.centerX = -0.05 + Math.sin(t / 13) * 0.12;
    for (const b of pack.bots) {
      const stagger = (b.row % 2) * COL_GAP / 2;
      b.x = pack.centerX + (b.col - 1) * COL_GAP + stagger + Math.sin(t * 0.45 + b.seed) * 0.04;
      b.dist = pack.dist - b.row * ROW_GAP + Math.sin(t * 0.3 + b.seed * 2) * 0.5;
      b.phase += dt * (moving ? b.cadence : 0) / 60 * Math.PI * 2;
    }
  }

  // Zit de speler in de groep (of er vlak achter)? Dan scheelt dat flink luchtweerstand.
  function contains(pack, dist, x) {
    const front = pack.dist + 0.8;
    const back = pack.dist - (pack.rows - 1) * ROW_GAP - cfg.draftDistance * 0.6;
    const half = COL_GAP * 1.6 + 0.15;
    return dist < front && dist > back && Math.abs(x - pack.centerX - COL_GAP / 4) < half;
  }

  return { create, update, contains };
})();
