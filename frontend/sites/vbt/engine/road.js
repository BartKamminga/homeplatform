// Weg-renderer: projecteert segmenten (dichtbij -> ver) en tekent ze ver -> dichtbij
VBT.road = (function () {
  const { cfg, util } = VBT;
  const P = VBT.palette;

  function drawRoad(ctx, w, seg) {
    const p1 = seg.p1.screen, p2 = seg.p2.screen;
    const c = hex => util.fogMix(hex, seg.fog);
    const light = Math.floor(seg.index / cfg.rumbleLength) % 2 === 0;
    const r1 = p1.w / 9, r2 = p2.w / 9;
    util.polygon(ctx, p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, c(light ? P.rumble : P.rumbleAlt));
    util.polygon(ctx, p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, c(light ? P.rumble : P.rumbleAlt));
    // dunne cyaan rand tussen rumble en asfalt
    const e1 = p1.w / 60, e2 = p2.w / 60;
    util.polygon(ctx, p1.x - p1.w, p1.y, p1.x - p1.w + e1, p1.y, p2.x - p2.w + e2, p2.y, p2.x - p2.w, p2.y, c(P.cyan));
    util.polygon(ctx, p1.x + p1.w, p1.y, p1.x + p1.w - e1, p1.y, p2.x + p2.w - e2, p2.y, p2.x + p2.w, p2.y, c(P.cyan));

    const start = seg.index < 3;
    util.polygon(ctx, p1.x - p1.w + e1, p1.y, p1.x + p1.w - e1, p1.y, p2.x + p2.w - e2, p2.y, p2.x - p2.w + e2, p2.y,
      start ? (seg.index % 2 ? '#eeeeee' : '#111111') : c(light ? P.road : P.roadAlt));

    if (light && !start) {
      const l1 = p1.w / 40, l2 = p2.w / 40;
      for (let lane = 1; lane < cfg.lanes; lane++) {
        const x1 = p1.x - p1.w + (2 * p1.w * lane) / cfg.lanes;
        const x2 = p2.x - p2.w + (2 * p2.w * lane) / cfg.lanes;
        util.polygon(ctx, x1 - l1 / 2, p1.y, x1 + l1 / 2, p1.y, x2 + l2 / 2, p2.y, x2 - l2 / 2, p2.y, c(P.lane));
      }
    }
  }

  function drawSprite(ctx, w, sprite, scale, x, y, anchorX, alpha) {
    const dw = sprite.worldW * scale * w / 2;
    if (dw < 2 || dw > w * 4) return;
    const dh = dw * sprite.canvas.height / sprite.canvas.width;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite.canvas, x + dw * anchorX, y - dh, dw, dh);
    ctx.globalAlpha = 1;
  }

  function drawSprites(ctx, w, seg, game) {
    const s = seg.p1.screen;
    const alpha = Math.min(1, 0.25 + seg.fog);
    for (const sp of seg.sprites) {
      if (sp.source.kind && !VBT.settings.show(sp.source.kind)) continue;     // decor uit in Settings
      const x = s.x + s.scale * sp.offset * cfg.roadWidth * w / 2;
      drawSprite(ctx, w, sp.source, s.scale, x, s.y, sp.offset < 0 ? -1 : 0, alpha);
    }
    const riders = game.riderBuckets && game.riderBuckets.get(seg.index);
    if (riders) riders.forEach(r => drawRider(ctx, w, r, alpha));
  }

  // Positie van een renner binnen zijn segment (geïnterpoleerd, dus vloeiend)
  function placeRider(r, w) {
    const p1 = r.seg.p1.screen, p2 = r.seg.p2.screen;
    const scale = VBT.util.lerp(p1.scale, p2.scale, r.pct);
    return {
      scale,
      x: VBT.util.lerp(p1.x, p2.x, r.pct) + scale * r.x * cfg.roadWidth * w / 2,
      y: VBT.util.lerp(p1.y, p2.y, r.pct),
    };
  }

  function drawRider(ctx, w, r, fogAlpha = 1) {
    const p = placeRider(r, w);
    const size = cfg.riderUnitsPerMeter * p.scale * w / 2;
    if (size > w) return;
    if (r.vehicle) {
      VBT.vehicles.draw(ctx, p.x, p.y, size, { vehicle: r.vehicle, time: r.time, speaking: r.speaking, alpha: fogAlpha });
      return;
    }
    VBT.rider.draw(ctx, p.x, p.y, size, {
      phase: r.phase, time: r.time, kit: r.kit, ghost: r.ghost, sprint: r.sprint, alpha: (r.alpha || 1) * fogAlpha,
    });
  }

  function render(ctx, w, h, game) {
    const T = VBT.track;
    const segs = T.segments, N = segs.length, trackLength = T.length();
    const base = T.find(game.position);
    const basePercent = util.percentRemaining(game.position, cfg.segmentLength);
    const camX = game.playerX * cfg.roadWidth;
    const camY = game.playerY + cfg.cameraHeight;
    let x = 0, dx = -(base.curve * basePercent);
    let maxy = h;
    const visible = [], all = [];
    const baseY = T.heightRange()[0];

    // renners die vóór de speler rijden, per segment bakken (ver -> dichtbij gesorteerd)
    game.riderBuckets = new Map();
    for (const r of game.riders) {
      if (r.relZ <= game.playerZ || r.relZ > cfg.drawDistance * cfg.segmentLength * 0.95) continue;
      const z = util.wrap(game.position + r.relZ, trackLength);
      r.seg = T.find(z);
      r.pct = util.percentRemaining(z, cfg.segmentLength);
      if (!game.riderBuckets.has(r.seg.index)) game.riderBuckets.set(r.seg.index, []);
      game.riderBuckets.get(r.seg.index).push(r);
    }
    game.riderBuckets.forEach(list => list.sort((a, b) => b.relZ - a.relZ));

    for (let n = 0; n < cfg.drawDistance; n++) {
      const seg = segs[(base.index + n) % N];
      const camZ = game.position - (seg.index < base.index ? trackLength : 0);
      seg.fog = util.exponentialFog(n / cfg.drawDistance, cfg.fogDensity);
      util.project(seg.p1, camX - x, camY, camZ, game.cameraDepth, w, h, cfg.roadWidth);
      util.project(seg.p2, camX - x - dx, camY, camZ, game.cameraDepth, w, h, cfg.roadWidth);
      x += dx;
      dx += seg.curve;
      if (seg.p1.camera.z <= game.cameraDepth) continue;
      VBT.terrain.prepare(seg, camY, baseY, h);
      all.push(seg);
      if (seg.p1.camera.z <= game.cameraDepth || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      visible.push(seg);
      maxy = seg.p2.screen.y;
    }

    // eerst het dal (ook achter heuveltoppen), daarna flanken + weg + sprites
    for (let i = all.length - 1; i >= 0; i--) VBT.terrain.drawValley(ctx, w, all[i]);
    for (let i = visible.length - 1; i >= 0; i--) {
      const seg = visible[i];
      VBT.terrain.drawFlanks(ctx, seg);
      drawRoad(ctx, w, seg);
      drawSprites(ctx, w, seg, game);
    }
  }

  // renners tussen camera en speler: na de speler tekenen, ver -> dichtbij
  function renderNear(ctx, w, game) {
    const T = VBT.track, trackLength = T.length();
    game.riders
      .filter(r => r.relZ <= game.playerZ && r.relZ > game.playerZ * 0.35)
      .sort((a, b) => b.relZ - a.relZ)
      .forEach(r => {
        const z = util.wrap(game.position + r.relZ, trackLength);
        r.seg = T.find(z);
        r.pct = util.percentRemaining(z, cfg.segmentLength);
        drawRider(ctx, w, r);
      });
  }

  return { render, renderNear };
})();
