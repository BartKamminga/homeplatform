// Effecten over het beeld (item 1361): vuurwerk bij een PB/top, weer per rit (helder / regen / mist), seizoenen
// op basis van de echte datum (herfstbladeren, sneeuw, bloesem; 's zomers vuurvliegjes in de nacht) en het
// donkere tunnelgevoel. Testhaakjes: ?weather=rain|mist|clear, ?season=autumn|winter|spring|summer.
VBT.fx = (function () {
  const params = new URLSearchParams(location.search);
  let rockets = [], sparks = [], drops = [], flakes = [], weather = 'clear', lastRideTime = 0, baseFog = null;

  // ── vuurwerk ────────────────────────────────────────────────────────────────────────────────
  function fireworks() {
    if (!VBT.settings.show('fireworks')) return;
    for (let i = 0; i < 7; i++) rockets.push({ x: 0.15 + Math.random() * 0.7, y: 1, vy: -(0.55 + Math.random() * 0.25), delay: i * 0.35, life: 0 });
  }
  const COLORS = () => VBT.zones.map(z => z.color);

  function renderSky(ctx, w, h, dt) {
    const horizon = h / 2;
    rockets = rockets.filter(r => {
      if ((r.delay -= dt) > 0) return true;
      r.y += r.vy * dt;
      r.life += dt;
      ctx.fillStyle = '#fff';
      ctx.fillRect(r.x * w, r.y * horizon, 3, 8);
      if (r.life < 0.9) return true;
      const col = COLORS()[Math.floor(Math.random() * 7)];
      for (let k = 0; k < 46; k++) {
        const a = k / 46 * Math.PI * 2, v = 0.12 + Math.random() * 0.1;
        sparks.push({ x: r.x * w, y: r.y * horizon, vx: Math.cos(a) * v * w, vy: Math.sin(a) * v * w, life: 1.4, col });
      }
      return false;
    });
    sparks = sparks.filter(s => {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 60 * dt; s.vx *= 0.98;
      ctx.globalAlpha = Math.max(0, s.life / 1.4);
      ctx.fillStyle = s.col;
      ctx.fillRect(s.x, s.y, 3, 3);
      return s.life > 0;
    });
    ctx.globalAlpha = 1;
  }

  // ── weer: bij de start van elke rit opnieuw kiezen (55% helder, 30% regen, 15% mist) ─────────────
  function pickWeather() {
    const forced = params.get('weather');
    if (forced) return forced;
    if (!VBT.settings.show('weather')) return 'clear';
    const r = Math.random();
    return r < 0.55 ? 'clear' : r < 0.85 ? 'rain' : 'mist';
  }

  function season() {
    const forced = params.get('season');
    if (forced) return forced;
    const d = new Date(), md = (d.getMonth() + 1) * 100 + d.getDate();
    if (md >= 921 && md < 1221) return 'autumn';
    if (md >= 1221 || md < 320) return 'winter';
    if (md < 621) return 'spring';
    return 'summer';
  }

  function update(game) {
    if (game.rideTime < lastRideTime || (game.rideTime > 0 && lastRideTime === 0)) {
      weather = pickWeather();
      if (VBT.store && weather !== 'clear') VBT.store.log('settings', 'Weather this ride: ' + weather, 'debug');
    }
    lastRideTime = game.rideTime;
    if (baseFog === null) baseFog = VBT.cfg.fogDensity;
    const riding = game.isRiding();
    VBT.cfg.fogDensity = riding && weather === 'mist' ? baseFog * 2.2 : baseFog;
  }

  // ── deeltjes over het beeld: regen, seizoen ──────────────────────────────────────────────────
  const SEASON = {
    autumn: { n: 40, colors: ['#ff9e3d', '#e8642c', '#ffd65a', '#b8452a'], size: 7, fall: 55, sway: 40 },
    winter: { n: 110, colors: ['#ffffff', '#e9f4ff'], size: 3.5, fall: 70, sway: 25 },
    spring: { n: 45, colors: ['#ffc4dd', '#ff9ec7', '#ffffff'], size: 5, fall: 40, sway: 45 },
  };

  function renderOverlay(ctx, w, h, dt, game) {
    const riding = game.isRiding();
    if (game.inTunnel) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, 0, w, h); }
    if (riding && weather === 'rain' && !game.inTunnel) {
      ctx.fillStyle = 'rgba(20,30,60,0.12)'; ctx.fillRect(0, 0, w, h);
      while (drops.length < 220) drops.push({ x: Math.random() * w, y: Math.random() * h, v: 0.9 + Math.random() * 0.5 });
      ctx.strokeStyle = 'rgba(190,220,255,0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const d of drops) {
        d.y += d.v * h * dt * 1.6; d.x -= d.v * w * dt * 0.12;
        if (d.y > h) { d.y = -20; d.x = Math.random() * w * 1.1; }
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 4, d.y + 18);
      }
      ctx.stroke();
    }
    const s = season(), cfg = SEASON[s];
    if (VBT.settings.show('seasons') && cfg && !game.inTunnel) {
      while (flakes.length < cfg.n) flakes.push({ x: Math.random() * w, y: Math.random() * h, p: Math.random() * 6, c: cfg.colors[flakes.length % cfg.colors.length] });
      flakes.length = cfg.n;
      for (const f of flakes) {
        f.p += dt;
        f.y += cfg.fall * dt * (h / 900);
        f.x += Math.sin(f.p * 1.3) * cfg.sway * dt;
        if (f.y > h) { f.y = -10; f.x = Math.random() * w; }
        ctx.fillStyle = f.c;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(f.x, f.y, cfg.size, s === 'winter' ? cfg.size : cfg.size * 0.6);
      }
      ctx.globalAlpha = 1;
    }
    // zomer: vuurvliegjes als het nacht wordt (dag/nacht)
    const night = VBT.worlds.nightFactor(game);
    if (VBT.settings.show('seasons') && s === 'summer' && night > 0.3) {
      const t = performance.now() / 1000;
      for (let i = 0; i < 24; i++) {
        const a = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
        ctx.fillStyle = 'rgba(220,255,120,' + (a * night).toFixed(2) + ')';
        ctx.fillRect((i * 173 + Math.sin(t * 0.3 + i) * 40) % w, h * 0.55 + ((i * 97) % (h * 0.3)), 3, 3);
      }
    }
  }

  return { fireworks, renderSky, renderOverlay, update, weather: () => weather, season };
})();
