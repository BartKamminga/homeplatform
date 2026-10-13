// Terrein rond de weg: een grid-dal op het laagste niveau van het parcours, en een berghelling (flank)
// van de wegrand naar het dal. Zo zie je bij een klim de weg oprijzen en het dal onder je wegzakken.
VBT.terrain = (function () {
  const { cfg, util } = VBT;
  const P = VBT.palette;
  const GRID_SPACING = 0.55;   // in halve wegbreedtes
  const GRID_LINES = 16;
  const FLANK_SLOPE = 1.3;     // horizontale uitloop per eenheid hoogte
  const FLANK = '#170536';

  // schermhoogte van het dal onder een geprojecteerd wegpunt
  function valleyY(p, camY, baseY, h) {
    return Math.round(h / 2 - p.screen.scale * (baseY - camY) * h / 2);
  }

  function prepare(seg, camY, baseY, h) {
    seg.v1 = valleyY(seg.p1, camY, baseY, h);
    seg.v2 = valleyY(seg.p2, camY, baseY, h);
    seg.foot1 = 1.11 + (seg.p1.world.y - baseY) / cfg.roadWidth * FLANK_SLOPE;
    seg.foot2 = 1.11 + (seg.p2.world.y - baseY) / cfg.roadWidth * FLANK_SLOPE;
  }

  function drawValley(ctx, w, seg) {
    const p1 = seg.p1.screen, p2 = seg.p2.screen;
    if (seg.v1 <= seg.v2) return;
    ctx.fillStyle = util.fogMix(P.ground, seg.fog);
    ctx.fillRect(0, seg.v2, w, seg.v1 - seg.v2 + 1);
    const alpha = 0.12 + 0.7 * seg.fog;
    ctx.strokeStyle = P.grid;
    ctx.globalAlpha = alpha * 0.5;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 1; k <= GRID_LINES; k++) {
      const o = 1.25 + k * GRID_SPACING;
      for (const side of [-1, 1]) {
        ctx.moveTo(p1.x + side * p1.w * o, seg.v1);
        ctx.lineTo(p2.x + side * p2.w * o, seg.v2);
      }
    }
    ctx.stroke();
    if (seg.index % 8 === 0) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = P.grid;
      ctx.fillRect(0, seg.v1 - 1, w, Math.max(1, p1.w / 400));
    }
    ctx.globalAlpha = 1;
  }

  function drawFlanks(ctx, seg) {
    if (seg.foot1 < 1.13 && seg.foot2 < 1.13) return;      // weg ligt op dalniveau
    const p1 = seg.p1.screen, p2 = seg.p2.screen;
    const color = util.fogMix(FLANK, seg.fog);
    for (const side of [-1, 1]) {
      util.polygon(ctx,
        p1.x + side * p1.w * 1.1, p1.y,
        p1.x + side * p1.w * seg.foot1, seg.v1,
        p2.x + side * p2.w * seg.foot2, seg.v2,
        p2.x + side * p2.w * 1.1, p2.y, color);
    }
    // contourlijnen langs de helling, zoals een wireframe-berg
    if (seg.index % 8 === 0) {
      ctx.strokeStyle = P.purple;
      ctx.globalAlpha = 0.15 + 0.5 * seg.fog;
      ctx.lineWidth = Math.max(1, p1.w / 500);
      ctx.beginPath();
      for (const side of [-1, 1]) {
        ctx.moveTo(p1.x + side * p1.w * 1.1, p1.y);
        ctx.lineTo(p1.x + side * p1.w * seg.foot1, seg.v1);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  return { prepare, drawValley, drawFlanks };
})();
