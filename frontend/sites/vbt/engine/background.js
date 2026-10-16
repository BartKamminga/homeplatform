// Achtergrond per wereld (worlds.js): lucht, sterren, zon (gestreept / ring / rond), bergen (parallax, met
// sneeuwtoppen in de Alpen) en de horizon. Dag/nacht (1361): de lucht loopt tijdens de rit naar het nachtpalet,
// de zon zakt onder de horizon en de sterren komen op.
VBT.background = (function () {
  const P = VBT.palette;
  let w = 0, h = 0, horizon = 0;
  let stars, sun, mountFar, mountNear;

  function canvas(cw, ch) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(cw));
    c.height = Math.max(1, Math.ceil(ch));
    return c;
  }

  function buildStars() {
    stars = canvas(w, horizon);
    const ctx = stars.getContext('2d');
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 260; i++) {
      const y = Math.pow(rnd(), 1.6) * horizon * 0.85;
      ctx.globalAlpha = 0.25 + rnd() * 0.75 * (1 - y / horizon);
      ctx.fillStyle = rnd() > 0.85 ? P.cyan : '#ffffff';
      const s = rnd() > 0.92 ? 2.5 : 1.4;
      ctx.fillRect(rnd() * w, y, s, s);
    }
  }

  function buildSun(style) {
    const R = Math.round(h * (style === 'round' ? 0.09 : 0.23));
    sun = canvas(R * 2 + 120, R * 2 + 120);
    const ctx = sun.getContext('2d');
    const cx = sun.width / 2, cy = sun.height / 2;
    ctx.shadowColor = P.sunGlow;
    ctx.shadowBlur = style === 'round' ? 50 : 80;
    if (style === 'ring') {
      ctx.strokeStyle = P.sunTop;
      ctx.lineWidth = Math.max(3, R * 0.05);
      for (const f of [1, 0.78, 0.56]) { ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke(); }
    } else {
      const g = ctx.createLinearGradient(0, cy - R, 0, cy + R);
      g.addColorStop(0, P.sunTop);
      g.addColorStop(0.55, style === 'round' ? P.sunTop : '#ff8a3d');
      g.addColorStop(1, P.sunBottom);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
    }
    if (style === 'stripes') {
      // de bekende uitgesneden strepen in de onderste helft
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 9; i++) ctx.fillRect(0, cy + R * 0.05 + i * R * 0.11, sun.width, 2 + i * R * 0.012);
    }
    sun.R = R;
    sun.style = style;
  }

  // Periodieke bergrug (som van sinussen met gehele frequenties -> naadloos te herhalen); snow = sneeuwtoppen
  function buildMountains(height, seed, fill, line, snow) {
    const mw = Math.round(w * 1.5);
    const c = canvas(mw, height + 10);
    const ctx = c.getContext('2d');
    const freqs = [[2, 0.35], [5, 0.22], [9, 0.14], [17, 0.07], [31, 0.04]];
    const pts = [];
    for (let x = 0; x <= mw; x += 4) {
      const t = x / mw * Math.PI * 2;
      let v = 0;
      freqs.forEach(([f, a], i) => { v += Math.sin(t * f + seed * (i + 1)) * a; });
      pts.push([x, height * (0.55 - v * 0.75)]);
    }
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, fill[0]);
    g.addColorStop(1, fill[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, height + 10);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(mw, height + 10);
    ctx.fill();
    if (snow) {
      // sneeuw: alles boven 40% van de hoogte, met een gekartelde onderrand
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#f4f8ff';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= mw; x += 12) ctx.lineTo(x, height * 0.4 + Math.sin(x * 0.21) * height * 0.06);
      ctx.lineTo(mw, 0);
      ctx.fill();
      ctx.restore();
      return c;
    }
    ctx.shadowColor = line;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    return c;
  }

  function resize(W, H) {
    const sky = VBT.worlds.get().sky;
    w = W; h = H; horizon = H / 2;
    buildStars();
    buildSun(sky.sun);
    mountFar = buildMountains(h * (sky.snowcaps ? 0.24 : 0.16), 1.3, P.mtnFar, P.mtnFarLine, sky.snowcaps);
    mountNear = buildMountains(h * (sky.snowcaps ? 0.13 : 0.1), 4.1, P.mtnNear, P.mtnNearLine, false);
  }

  function tile(ctx, img, offset, y) {
    const iw = img.width;
    let x = -VBT.util.wrap(offset, iw);
    for (; x < w; x += iw) ctx.drawImage(img, x, y);
  }

  const mixHex = (a, b, f) => {
    if (f <= 0) return a;
    const A = VBT.util.rgb(a), B = VBT.util.rgb(b);
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * f)).join(',') + ')';
  };

  // alt = echte hoogte in meters: hoe hoger je rijdt, hoe verder de bergen wegzakken; night = 0..1 (dag/nacht)
  function render(ctx, skyX, t, alt = 0, night = 0) {
    const world = VBT.worlds.get(), N = world.night;
    const sink = VBT.util.clamp(alt / 60, -0.3, 1);
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, mixHex(P.skyTop, N.skyTop, night));
    g.addColorStop(0.45, mixHex(P.skyMid, N.skyMid, night));
    g.addColorStop(0.85, mixHex(P.skyLow, N.skyLow, night));
    g.addColorStop(1, mixHex(P.horizon, N.horizon, night));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizon + 2);

    const starAlpha = (world.sky.stars ? 0.75 + Math.sin(t * 1.7) * 0.1 : 0) * (1 - night) + night * 0.95;
    if (starAlpha > 0.02) { ctx.globalAlpha = starAlpha; ctx.drawImage(stars, 0, 0); ctx.globalAlpha = 1; }

    const show = VBT.settings.show('sky');
    if (show) {
      const sx = w / 2 - sun.width / 2 - skyX * 0.05;
      const sy = horizon - sun.height / 2 - sun.R * (sun.style === 'round' ? 2.4 : 0.55) + night * sun.R * 3;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, horizon);
      ctx.clip();
      ctx.drawImage(sun, sx, sy);
      ctx.restore();
      tile(ctx, mountFar, skyX * 0.25, horizon - mountFar.height + 6 + sink * mountFar.height * 0.45);
      tile(ctx, mountNear, skyX * 0.5, horizon - mountNear.height + 8 + sink * mountNear.height * 0.75);
      if (night > 0) {                                          // bergen donkerder 's nachts
        ctx.fillStyle = 'rgba(2,0,10,' + (night * 0.55).toFixed(3) + ')';
        ctx.fillRect(0, horizon - mountFar.height - 10, w, mountFar.height + 12);
      }
    }

    // grond onder de horizon + gloeiende horizonlijn
    ctx.fillStyle = P.ground;
    ctx.fillRect(0, horizon, w, h - horizon);
    const hg = ctx.createLinearGradient(0, horizon - 30, 0, horizon + 30);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(0.5, P.horizonGlow);
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.globalAlpha = 1 - night * 0.6;
    ctx.fillRect(0, horizon - 30, w, 60);
    ctx.globalAlpha = 1;
  }

  return { resize, render };
})();
