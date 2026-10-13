// Synthwave-achtergrond: lucht, sterren, gestreepte zon en neon-bergen (parallax)
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

  function buildSun() {
    const R = Math.round(h * 0.23);
    sun = canvas(R * 2 + 120, R * 2 + 120);
    const ctx = sun.getContext('2d');
    const cx = sun.width / 2, cy = sun.height / 2;
    ctx.shadowColor = P.pink;
    ctx.shadowBlur = 80;
    const g = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    g.addColorStop(0, P.sunTop);
    g.addColorStop(0.55, '#ff8a3d');
    g.addColorStop(1, P.sunBottom);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    // de bekende uitgesneden strepen in de onderste helft
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) {
      const y = cy + R * 0.05 + i * R * 0.11;
      ctx.fillRect(0, y, sun.width, 2 + i * R * 0.012);
    }
    sun.R = R;
  }

  // Periodieke bergrug (som van sinussen met gehele frequenties -> naadloos te herhalen)
  function buildMountains(height, seed, fill, line) {
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
    w = W; h = H; horizon = H / 2;
    buildStars();
    buildSun();
    mountFar = buildMountains(h * 0.16, 1.3, ['#2b0b52', '#140330'], 'rgba(155,92,255,0.8)');
    mountNear = buildMountains(h * 0.1, 4.1, ['#1b0438', '#0b0120'], P.pink);
  }

  function tile(ctx, img, offset, y) {
    const iw = img.width;
    let x = -VBT.util.wrap(offset, iw);
    for (; x < w; x += iw) ctx.drawImage(img, x, y);
  }

  // alt = echte hoogte in meters: hoe hoger je rijdt, hoe verder de bergen wegzakken
  function render(ctx, skyX, t, alt = 0) {
    const sink = VBT.util.clamp(alt / 60, -0.3, 1);
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, P.skyTop);
    g.addColorStop(0.45, P.skyMid);
    g.addColorStop(0.85, P.skyLow);
    g.addColorStop(1, P.horizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizon + 2);

    ctx.globalAlpha = 0.75 + Math.sin(t * 1.7) * 0.1;
    ctx.drawImage(stars, 0, 0);
    ctx.globalAlpha = 1;

    const sx = w / 2 - sun.width / 2 - skyX * 0.05;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, horizon);
    ctx.clip();
    if (VBT.settings.show('sky')) ctx.drawImage(sun, sx, horizon - sun.height / 2 - sun.R * 0.55);
    ctx.restore();

    if (VBT.settings.show('sky')) tile(ctx, mountFar, skyX * 0.25, horizon - mountFar.height + 6 + sink * mountFar.height * 0.45);
    if (VBT.settings.show('sky')) tile(ctx, mountNear, skyX * 0.5, horizon - mountNear.height + 8 + sink * mountNear.height * 0.75);

    // grond onder de horizon + gloeiende horizonlijn
    ctx.fillStyle = P.ground;
    ctx.fillRect(0, horizon, w, h - horizon);
    const hg = ctx.createLinearGradient(0, horizon - 30, 0, horizon + 30);
    hg.addColorStop(0, 'rgba(255,46,136,0)');
    hg.addColorStop(0.5, 'rgba(255,122,61,0.55)');
    hg.addColorStop(1, 'rgba(255,46,136,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, horizon - 30, w, 60);
  }

  return { resize, render };
})();
