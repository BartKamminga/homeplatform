// Wielrenner op een racefiets, van schuin achter/boven gezien.
// Maten in cm in een zijaanzicht (f = naar voren, u = omhoog, lat = zijwaarts);
// een vleugje perspectief: wat verder naar voren ligt, staat hoger op het scherm.
VBT.rider = (function () {
  const CRANK = 17, THIGH = 46, CALF = 44;
  const HIP = { f: -12, u: 98 };
  const BB = { f: 0, u: 27 };

  const KITS = {
    player: { jersey: ['#ff2e88', '#b0157a'], accent: '#24e8ff', pattern: 'sash', shorts: '#120a24', band: '#24e8ff', helmet: '#f4f1ff', bike: '#24e8ff', skin: '#e8a27c', sock: '#ffffff', shoe: '#ffffff', bib: 'VBT' },
    ghost: { jersey: ['#24e8ff', '#1288b0'], accent: '#ffffff', pattern: 'solid', shorts: '#0c4a66', band: '#ffffff', helmet: '#d9fbff', bike: '#ffffff', skin: '#7fe6ff', sock: '#d9fbff', shoe: '#d9fbff' },
  };
  const TEAM_KITS = [
    { jersey: ['#ffd60a', '#e0a800'], accent: '#111111', pattern: 'band', shorts: '#111111', band: '#ffd60a', helmet: '#111111', bike: '#ffd60a' },
    { jersey: ['#2bd67b', '#16924f'], accent: '#ffffff', pattern: 'stripes', shorts: '#0d2b1c', band: '#2bd67b', helmet: '#ffffff', bike: '#ffffff' },
    { jersey: ['#3d8bff', '#1f4fc4'], accent: '#ffffff', pattern: 'band', shorts: '#0b1640', band: '#ffffff', helmet: '#3d8bff', bike: '#e8e8f0' },
    { jersey: ['#ff3d5a', '#b81530'], accent: '#ffe66d', pattern: 'sash', shorts: '#1a0710', band: '#ff3d5a', helmet: '#ffffff', bike: '#ff3d5a' },
    { jersey: ['#ff9e3d', '#d4651a'], accent: '#1a1430', pattern: 'stripes', shorts: '#1a1430', band: '#ff9e3d', helmet: '#ff9e3d', bike: '#1a1430' },
    { jersey: ['#f4f4f8', '#c8c8d8'], accent: '#ff2e88', pattern: 'band', shorts: '#111111', band: '#ff2e88', helmet: '#f4f4f8', bike: '#111111' },
    { jersey: ['#9b5cff', '#6230c4'], accent: '#24e8ff', pattern: 'solid', shorts: '#1a0b33', band: '#24e8ff', helmet: '#24e8ff', bike: '#9b5cff' },
    { jersey: ['#1a1a24', '#000000'], accent: '#ff2e88', pattern: 'sash', shorts: '#000000', band: '#ff2e88', helmet: '#ff2e88', bike: '#ff2e88' },
  ];
  const SKINS = ['#e8a27c', '#c98a62', '#8d5a3b', '#f1c4a4', '#a86f4c'];

  function teamKit(i) {
    return Object.assign({ skin: SKINS[i % SKINS.length], sock: '#ffffff', shoe: i % 3 ? '#ffffff' : '#111111' }, TEAM_KITS[i % TEAM_KITS.length]);
  }

  // zijaanzicht -> scherm (y omhoog = negatief), contactpunt achterwiel = (0, 0)
  const sy = (f, u) => -(u + (f + 40) * 0.25);

  function line(ctx, x1, y1, x2, y2, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // twee-schakel IK in het zijaanzicht: knie naar voren
  function legPose(angle) {
    const pf = BB.f + Math.cos(angle) * CRANK, pu = BB.u + Math.sin(angle) * CRANK;
    const df = pf - HIP.f, du = pu - HIP.u;
    const d = Math.min(Math.hypot(df, du), THIGH + CALF - 0.5);
    const a = Math.acos((THIGH * THIGH + d * d - CALF * CALF) / (2 * THIGH * d));
    const phi = Math.atan2(du, df);
    return { kf: HIP.f + Math.cos(phi + a) * THIGH, ku: HIP.u + Math.sin(phi + a) * THIGH, pf, pu };
  }

  function leg(ctx, side, angle, k, hipX) {
    const p = legPose(angle);
    const hx = hipX + side * 8, hy = sy(HIP.f, HIP.u);
    const kx = side * (10 + (p.kf - 20) * 0.05), ky = sy(p.kf, p.ku);
    const fx = side * 12, fy = sy(p.pf, p.pu);
    line(ctx, side * 7, sy(BB.f, BB.u), fx - side * 1, fy + 2, 3, '#2a2a36');             // crank
    line(ctx, kx, ky, fx, fy - 3, 8.5, k.skin);                                             // kuit
    line(ctx, fx, fy - 7, fx, fy - 2, 7.5, k.sock);                                         // sok
    line(ctx, hx, hy, kx, ky, 12.5, k.skin);                                                // dij
    line(ctx, hx, hy, hx + (kx - hx) * 0.68, hy + (ky - hy) * 0.68, 13.5, k.shorts);        // broek
    line(ctx, hx + (kx - hx) * 0.64, hy + (ky - hy) * 0.64, hx + (kx - hx) * 0.7, hy + (ky - hy) * 0.7, 13.5, k.band);
    ctx.fillStyle = k.shoe;
    ctx.beginPath();
    ctx.roundRect(fx - 4, fy - 2, 8, 6, 2);
    ctx.fill();
  }

  // Opwindsleutel in de rug (speelgoedfietser): draait rond zolang de simulatie fietst
  function windupKey(ctx, sway, time) {
    const x = sway, y = sy(20, 108), spin = Math.cos(time * 7);
    line(ctx, x, y, x, y - 13, 3, '#c9a227');                      // as uit de rug
    ctx.save();
    ctx.translate(x, y - 16);
    ctx.scale(Math.max(0.15, Math.abs(spin)), 1);                   // vleugels draaien (3D-flip)
    ctx.fillStyle = spin > 0 ? '#ffe66d' : '#e0b830';
    ctx.strokeStyle = '#7a5a00';
    ctx.lineWidth = 1.2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 7, 0, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#7a5a00';
    ctx.fillRect(-2, -3, 4, 6);
    ctx.restore();
  }

  function jersey(ctx, k, sway) {
    const hy = sy(-10, 100), shy = sy(45, 118);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-13 + sway, hy);
    ctx.quadraticCurveTo(-20, (hy + shy) / 2, -19, shy);
    ctx.quadraticCurveTo(0, shy - 9, 19, shy);
    ctx.quadraticCurveTo(20, (hy + shy) / 2, 13 + sway, hy);
    ctx.quadraticCurveTo(0, hy + 4, -13 + sway, hy);
    const g = ctx.createLinearGradient(0, shy - 6, 0, hy);
    g.addColorStop(0, k.jersey[0]);
    g.addColorStop(1, k.jersey[1]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = k.accent;
    if (k.pattern === 'band') ctx.fillRect(-25, shy + 8, 50, 7);
    if (k.pattern === 'stripes') for (const x of [-9, 0, 9]) ctx.fillRect(x - 1.5, shy - 8, 3, 50);
    if (k.pattern === 'sash') {
      ctx.beginPath();
      ctx.moveTo(-22, shy + 2);
      ctx.lineTo(-14, shy - 6);
      ctx.lineTo(22, hy - 4);
      ctx.lineTo(14, hy + 4);
      ctx.fill();
    }
    // achterzakken
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.8;
    for (const x of [-9, 0, 9]) ctx.strokeRect(x - 4.5 + sway * 0.5, hy - 9, 9, 7);
    if (k.bib) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8, shy + 13, 16, 9);
      ctx.fillStyle = '#111111';
      ctx.font = '900 7px Orbitron, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(k.bib, 0, shy + 20.5);
    }
    ctx.restore();
  }

  // x, y = contactpunt achterwiel op scherm; size = pixels per meter
  function draw(ctx, x, y, size, s) {
    const k = s.kit || KITS.player;
    const u = size / 100;
    if (u < 0.04) return;
    const rock = s.sprint ? Math.sin(s.phase) * 0.07 : Math.sin(s.phase) * 0.012;
    const sway = Math.sin(s.phase) * (s.sprint ? 2.5 : 0.8);

    ctx.save();
    if (s.alpha !== undefined) ctx.globalAlpha = s.alpha;
    ctx.translate(x, y);
    ctx.scale(u, u);
    if (!s.ghost) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, -8, 20, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.rotate((s.lean || 0) + rock);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // stuur met drops en armen (liggen het verst weg)
    const hb = sy(62, 94), drop = sy(66, 84);
    line(ctx, -21, hb, 21, hb, 2.6, '#1a1a24');
    for (const side of [-1, 1]) {
      line(ctx, side * 21, hb, side * 21, drop, 2.4, '#1a1a24');
      const shx = side * 18 + sway * 0.6, shy = sy(45, 118);
      const ex = side * 23, ey = sy(52, 104);
      line(ctx, shx, shy, ex, ey, 7, k.jersey[1]);                  // bovenarm (mouw)
      line(ctx, ex, ey, side * 20.5, hb + 1, 5.5, k.skin);          // onderarm
      ctx.fillStyle = '#1a1a24';
      ctx.beginPath();
      ctx.arc(side * 20.5, hb + 1.5, 2.8, 0, Math.PI * 2);           // handschoen
      ctx.fill();
    }

    leg(ctx, -1, s.phase, k, sway);
    leg(ctx, 1, s.phase + Math.PI, k, sway);

    jersey(ctx, k, sway);
    if (s.windup) windupKey(ctx, sway, s.time);
    // broek/zitvlak over het zadel
    ctx.fillStyle = k.shorts;
    ctx.beginPath();
    ctx.ellipse(sway, sy(-12, 98) + 1, 14, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // nek + helm met ventilatie en zonnebril-pootjes
    const hy = sy(60, 130);
    ctx.fillStyle = k.skin;
    ctx.fillRect(-4.5 + sway, hy + 6, 9, 6);
    ctx.fillStyle = k.helmet;
    ctx.beginPath();
    ctx.ellipse(sway, hy, 10.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (const vx of [-5, 0, 5]) ctx.fillRect(vx - 1.2 + sway, hy - 8, 2.4, 7);
    ctx.fillStyle = k.accent;
    ctx.fillRect(-10 + sway, hy + 1, 20, 2);
    line(ctx, -10.5 + sway, hy + 5, -7 + sway, hy + 4, 1.4, '#111111');
    line(ctx, 10.5 + sway, hy + 5, 7 + sway, hy + 4, 1.4, '#111111');

    // achterkant fiets: liggende achtervork, zadelpen, wiel, cassette, derailleur
    const hub = sy(-40, 34), seat = sy(-12, 75);
    line(ctx, -3, hub, -1, seat, 2.4, k.bike);
    line(ctx, 3, hub, 1, seat, 2.4, k.bike);
    ctx.fillStyle = '#0a0614';
    ctx.beginPath();
    ctx.roundRect(-2.2, sy(-40, 69) - 1, 4.4, -sy(-40, 69) + 1, 2.2);
    ctx.fill();
    ctx.fillStyle = k.bike;
    ctx.fillRect(-1.2, sy(-40, 66), 2.4, 8);                       // velg-decal
    ctx.fillRect(-1.2, hub + 14, 2.4, 8);
    ctx.fillStyle = '#8a8aa0';
    ctx.beginPath();
    ctx.ellipse(4, hub, 2.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    line(ctx, 6, hub + 2, 7, hub + 10, 2, '#2a2a36');
    if (!s.ghost && Math.floor(s.time * 3) % 2 === 0) {
      ctx.shadowColor = '#ff2040';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ff2040';
      ctx.fillRect(-2.5, sy(-14, 82) - 2, 5, 4);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  return { draw, KITS, teamKit };
})();
