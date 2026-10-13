// Wiskunde- en projectiehulpjes voor de pseudo-3D weg
VBT.util = {
  clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },
  lerp(a, b, t) { return a + (b - a) * t; },
  percentRemaining(n, total) { return (n % total) / total; },
  easeIn(a, b, p) { return a + (b - a) * Math.pow(p, 2); },
  easeInOut(a, b, p) { return a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5); },
  wrap(v, max) {
    while (v >= max) v -= max;
    while (v < 0) v += max;
    return v;
  },
  exponentialFog(distance, density) { return 1 / Math.pow(Math.E, distance * distance * density); },

  // Wereldpunt -> camera -> scherm (klassieke OutRun-projectie)
  project(p, camX, camY, camZ, camDepth, w, h, roadWidth) {
    p.camera.x = (p.world.x || 0) - camX;
    p.camera.y = (p.world.y || 0) - camY;
    p.camera.z = (p.world.z || 0) - camZ;
    p.screen.scale = camDepth / p.camera.z;
    p.screen.x = Math.round(w / 2 + p.screen.scale * p.camera.x * w / 2);
    p.screen.y = Math.round(h / 2 - p.screen.scale * p.camera.y * h / 2);
    p.screen.w = Math.round(p.screen.scale * roadWidth * w / 2);
  },

  polygon(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  },

  formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const t = Math.floor((sec * 10) % 10);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + t;
  },

  // Kleur richting de mistkleur mengen (fog: 1 = helder, 0 = volledig in de mist); gecachet
  fogMix(hex, fog) {
    const k = Math.round((1 - fog) * 24);
    const key = hex + k;
    const cache = VBT.util._fogCache || (VBT.util._fogCache = new Map());
    if (cache.has(key)) return cache.get(key);
    const a = VBT.util.rgb(hex), b = VBT.util.rgb(VBT.palette.fog), t = k / 24;
    const c = 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';
    cache.set(key, c);
    return c;
  },

  rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },

  zoneFor(watts) {
    const f = watts / VBT.cfg.rider.ftp;
    return VBT.zones.find(z => f <= z.max) || VBT.zones[VBT.zones.length - 1];
  },
};
