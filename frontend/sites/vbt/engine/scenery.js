// Omgevings-extra's langs de weg (item 1361): publiek op de klim (juicht harder boven je FTP), km-bordjes met
// je eigen cijfers, bevoorradingszone op lange ritten, tunnels en bruggen (met water), en losse decor per wereld
// (chalets en koeien in de Alpen). Elk onderdeel is aan/uit in SETTINGS (settings.js, groep World).
VBT.scenery = (function () {
  const { cfg, util } = VBT;
  const SEG_M = () => cfg.segmentLength / cfg.unitsPerMeter;
  const FEED_FIRST = 2400, FEED_EVERY = 2400;               // s rijtijd: na 40 min, daarna elke 40 min
  let fanFrames = null, feedSprites = null, kmCache = new Map(), nextFeed = FEED_FIRST, placedFeed = [], lastT = 0;
  const stats = { sumW: 0, t: 0 };

  function make(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  }

  // ── publiek: drie frames (staan / armen omhoog / springen) ─────────────────────────────────────
  function buildFans() {
    const colors = ['#ff2e88', '#24e8ff', '#ffe66d', '#5dff9e', '#ff9e3d'];
    return [0, 1, 2].map(f => make(420, 200, ctx => {
      for (let i = 0; i < 7; i++) {
        const x = 20 + i * 56, jump = f === 2 && i % 2 ? 18 : f === 1 && i % 3 === 0 ? 8 : 0, y = 190 - jump;
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x, y - 90, 30, 60);                                  // lijf
        ctx.fillStyle = '#f2c9a0';
        ctx.fillRect(x + 7, y - 114, 16, 20);                             // hoofd
        ctx.fillStyle = '#1a1030';
        ctx.fillRect(x + 4, y - 30, 9, 30); ctx.fillRect(x + 17, y - 30, 9, 30);     // benen
        ctx.fillStyle = colors[(i + 2) % colors.length];
        if (f === 0) { ctx.fillRect(x - 6, y - 84, 6, 34); ctx.fillRect(x + 30, y - 84, 6, 34); }
        else { ctx.fillRect(x - 8, y - 132, 6, 46); ctx.fillRect(x + 32, y - 132, 6, 46); }    // armen omhoog
        if (i === 3) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 30, y - 160, 90, 30); ctx.fillStyle = '#ff2e88';
          ctx.font = '900 22px Orbitron, Arial'; ctx.fillText('ALLEZ!', x - 26, y - 137); }
      }
    }));
  }
  const fans = {
    worldW: 2200, kind: 'fans',
    get canvas() {
      if (!fanFrames) fanFrames = buildFans();
      const g = VBT.game, f = g && g.sensors.watts / VBT.cfg.rider.ftp;
      const speed = f > 1 ? 7 : f > 0.8 ? 4 : 1.5;                         // boven je FTP: wild
      return fanFrames[Math.floor(performance.now() / 1000 * speed) % 3];
    },
  };

  // ── km-bordjes: "KM 12" + jouw gemiddelde tot nu toe ──────────────────────────────────────────
  function kmSign(text, sub) {
    const key = text + '|' + sub;
    if (kmCache.has(key)) return kmCache.get(key);
    if (kmCache.size > 60) kmCache.clear();
    const c = make(300, 420, (ctx, w) => {
      ctx.fillStyle = '#2a1d4a'; ctx.fillRect(w / 2 - 7, 180, 14, 240);
      ctx.fillStyle = '#f4f4f4'; ctx.fillRect(20, 20, w - 40, 170);
      ctx.fillStyle = '#e33b3b'; ctx.fillRect(20, 20, w - 40, 22);
      ctx.fillStyle = '#111'; ctx.textAlign = 'center';
      ctx.font = '900 64px Orbitron, Arial'; ctx.fillText(text, w / 2, 112);
      ctx.font = '700 26px Orbitron, Arial'; ctx.fillText(sub, w / 2, 165);
    });
    kmCache.set(key, c);
    return c;
  }
  function kmSprite(lapM) {
    return {
      worldW: 650, kind: 'kmsigns',
      get canvas() {
        const g = VBT.game, lap = VBT.track.lapMeters(), pos = g.player.dist % lap;
        const total = Math.floor(g.player.dist / lap) * lap + lapM + (lapM < pos ? lap : 0);
        const avg = stats.t > 30 ? Math.round(stats.sumW / stats.t) + ' W AVG' : 'VBT';
        return kmSign('KM ' + Math.round(total / 1000), avg);
      },
    };
  }

  // ── decor plaatsen bij het bouwen van een parcours (track.js) ─────────────────────────────────
  function place(addSprite, segments, marks) {
    const N = segments.length, perKm = Math.round(1000 / SEG_M());
    for (let n = perKm; n < N - 20; n += perKm) addSprite(n, kmSprite(n * SEG_M()), 1.3);
    marks.forEach((mk, i) => {
      const end = marks[i + 1] ? marks[i + 1].at : N;
      if (!(mk.sec.tag === 'climb' || mk.sec.tag === 'kom' || mk.sec.g >= 6)) return;
      for (let n = mk.at + 30; n < end; n += 70) addSprite(n, fans, n % 140 < 70 ? -1.35 : 1.35);
    });
    for (const [world, build] of Object.entries(VBT.worldDecor || {})) {
      build().forEach((d, k) => {
        const sp = { canvas: d.canvas, worldW: d.worldW, kind: 'world_decor', world };
        for (let n = 40 + k * 37; n < N; n += d.every) addSprite(n, sp, d.offset * (n % (d.every * 2) < d.every ? 1 : -1));
      });
    }
    autoStructures(segments, marks);
  }

  // tunnels (~elke 2,5 km, 200 m) en bruggen (~elke 3,7 km, 150 m) op niet te steile stukken, tenzij het
  // parcours ze zelf aangeeft (sec.tunnel / sec.bridge)
  function autoStructures(segments, marks) {
    const tagged = marks.some(m => m.sec.tunnel || m.sec.bridge);
    marks.forEach((mk, i) => {
      const end = marks[i + 1] ? marks[i + 1].at : segments.length;
      for (let n = mk.at; n < end; n++) { segments[n].tunnel = !!mk.sec.tunnel; segments[n].bridge = !!mk.sec.bridge; }
    });
    const m = n => n * SEG_M();
    if (!tagged) segments.forEach((s, n) => {
      const flat = Math.abs(VBT.track.gradeAt(n)) < 0.035;
      if (m(n) % 2500 >= 1200 && m(n) % 2500 < 1400) s.tunnel = true;
      else if (flat && m(n) % 3700 >= 600 && m(n) % 3700 < 750) s.bridge = true;
    });
    segments.forEach((s, n) => { s.tunnelStart = s.tunnel && !(segments[n - 1] && segments[n - 1].tunnel); });
  }

  // ── tunnel: wanden, plafond en een portaal bij de ingang ─────────────────────────────────────
  // far = het vorige (verder weg) getekende tunnelsegment: wanden daar tegenaan, anders vallen er gaten
  function drawTunnel(ctx, w, h, seg, far) {
    if (!VBT.settings.show('structures')) return;
    const p1 = seg.p1.screen, p2 = far ? far.p1.screen : seg.p2.screen, P = VBT.palette;
    const W1 = p1.w * 1.25, W2 = p2.w * 1.25, c1 = p1.y - p1.w * 1.05, c2 = p2.y - p2.w * 1.05;
    const wall = '#1c1a24', roof = '#0a0614';                              // binnen is het donker, ook in de mist
    util.polygon(ctx, p1.x - W1, p1.y, p2.x - W2, p2.y, p2.x - W2, c2, p1.x - W1, c1, wall);
    util.polygon(ctx, p1.x + W1, p1.y, p2.x + W2, p2.y, p2.x + W2, c2, p1.x + W1, c1, wall);
    util.polygon(ctx, p1.x - W1, c1, p1.x + W1, c1, p2.x + W2, c2, p2.x - W2, c2, roof);
    if (seg.index % 6 === 0) {                                             // lampjes op de wanden
      ctx.fillStyle = util.fogMix('#ffe66d', seg.fog);
      const lw = Math.max(1, p1.w / 30), ly = (p1.y + c1) / 2;
      ctx.fillRect(p1.x - W1 - lw, ly, lw * 2, lw); ctx.fillRect(p1.x + W1 - lw, ly, lw * 2, lw);
    }
  }

  // portaal bij de ingang: rotswand (heuvelvorm) met een opening, getekend waar de tunnel begint
  function drawPortal(ctx, seg) {
    if (!VBT.settings.show('structures')) return;
    const p1 = seg.p1.screen, P = VBT.palette, W1 = p1.w * 1.25, c1 = p1.y - p1.w * 1.05;
    const FACE = { alps: '#7a7f8a', tron: '#03060c', outrun: '#1b0b3a' };
    ctx.fillStyle = util.fogMix(FACE[VBT.worlds.current()] || FACE.outrun, Math.max(0.6, seg.fog));
    const fw = W1 * 3.2, top = c1 - W1 * 0.9;
    ctx.beginPath();
    ctx.moveTo(p1.x - fw, p1.y);
    ctx.quadraticCurveTo(p1.x - fw * 0.6, top, p1.x, top);
    ctx.quadraticCurveTo(p1.x + fw * 0.6, top, p1.x + fw, p1.y);
    ctx.closePath();
    ctx.rect(p1.x + W1, c1, -2 * W1, p1.y - c1);
    ctx.fill('evenodd');
    ctx.strokeStyle = util.fogMix(P.edge, seg.fog);
    ctx.lineWidth = Math.max(1, p1.w / 120);
    ctx.strokeRect(p1.x - W1, c1, 2 * W1, p1.y - c1);
  }
  // ── brug: reling langs de weg, water in het dal ──────────────────────────────────────────────
  function drawRailing(ctx, seg, far) {
    if (!VBT.settings.show('structures')) return;
    const p1 = seg.p1.screen, p2 = far ? far.p1.screen : seg.p2.screen;
    const col = util.fogMix('#c8c8d0', seg.fog), r1 = p1.w * 0.1, r2 = p2.w * 0.1;
    for (const side of [-1, 1]) {
      const x1 = p1.x + side * p1.w * 1.12, x2 = p2.x + side * p2.w * 1.12;
      util.polygon(ctx, x1, p1.y - r1, x2, p2.y - r2, x2, p2.y - r2 * 0.8, x1, p1.y - r1 * 0.8, col);
      if (seg.index % 4 === 0) util.polygon(ctx, x1 - 1, p1.y, x1 + Math.max(1, p1.w / 150), p1.y, x1 + Math.max(1, p1.w / 150), p1.y - r1, x1 - 1, p1.y - r1, col);
    }
  }
  function drawWater(ctx, w, seg) {
    if (!VBT.settings.show('structures')) return;
    const alps = VBT.worlds.current() === 'alps';
    ctx.fillStyle = util.fogMix(alps ? '#2f6fae' : '#0b2a5c', seg.fog);
    ctx.fillRect(0, seg.v2, w, seg.v1 - seg.v2 + 1);
    if (seg.index % 3 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.1 + 0.3 * seg.fog).toFixed(2) + ')';
      const x = (seg.index * 97) % w;
      ctx.fillRect(x, seg.v1 - 1, Math.max(4, seg.p1.screen.w / 8), 1.5);
    }
  }

  // ── bevoorradingszone: na 40 min (en elke 40 min) staan er verzorgers met bidons langs de weg ──────
  function buildFeed() {
    const soigneur = make(160, 320, ctx => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(50, 90, 60, 120);
      ctx.fillStyle = '#f2c9a0'; ctx.fillRect(62, 50, 36, 40);
      ctx.fillStyle = '#1a1030'; ctx.fillRect(55, 210, 20, 110); ctx.fillRect(85, 210, 20, 110);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(110, 70, 14, 60);
      ctx.fillStyle = '#ff2e88'; ctx.fillRect(112, 120, 44, 50);           // musette
      ctx.fillStyle = '#24e8ff'; ctx.fillRect(120, 100, 12, 22);           // bidon
    });
    const banner = make(560, 300, (ctx, w) => {
      ctx.fillStyle = '#1a1030'; ctx.fillRect(40, 120, 16, 180); ctx.fillRect(w - 56, 120, 16, 180);
      ctx.fillStyle = '#5dff9e'; ctx.fillRect(10, 20, w - 20, 110);
      ctx.fillStyle = '#07011a'; ctx.textAlign = 'center'; ctx.font = '900 64px Orbitron, Arial'; ctx.fillText('FEED ZONE', w / 2, 98);
    });
    return { soigneur: { canvas: soigneur, worldW: 520, kind: 'feedzone' }, banner: { canvas: banner, worldW: 2400, kind: 'feedzone' } };
  }

  function update(game, dt) {
    const T = VBT.track;
    if (game.rideTime < lastT) { nextFeed = FEED_FIRST; stats.sumW = 0; stats.t = 0; clearFeed(); }
    lastT = game.rideTime;
    if (game.state === 'ride') { stats.sumW += game.sensors.watts * dt; stats.t += dt; }
    const seg = T.segments.length ? T.find(game.position + game.playerZ) : null;
    game.inTunnel = !!(seg && seg.tunnel && VBT.settings.show('structures'));
    if (game.state !== 'ride' || game.rideTime < nextFeed || !VBT.settings.show('feedzone') || !T.segments.length) return;
    nextFeed += FEED_EVERY;
    if (!feedSprites) feedSprites = buildFeed();
    clearFeed();
    const at = T.find(game.position).index + 500, N = T.segments.length;
    T.addSprite(util.wrap(at, N), feedSprites.banner, 1.9);
    placedFeed.push([util.wrap(at, N)]);
    for (let k = 1; k <= 5; k++) { const n = util.wrap(at + k * 40, N); T.addSprite(n, feedSprites.soigneur, 1.25); placedFeed.push([n]); }
    if (VBT.settings.show('coach')) VBT.coach.say('Feed zone ahead - grab a bottle and drink something!');
    VBT.hud.message('FEED ZONE', VBT.palette.green || '#5dff9e');
  }
  function clearFeed() {
    const segs = VBT.track.segments;
    placedFeed.forEach(([n]) => { if (segs[n]) segs[n].sprites = segs[n].sprites.filter(s => s.source.kind !== 'feedzone'); });
    placedFeed = [];
  }

  return { place, drawTunnel, drawPortal, drawRailing, drawWater, update, stats };
})();
