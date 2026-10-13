// Voertuigen van achteren gezien (zelfde conventie als rider.js): oorsprong = midden op de grond,
// eenheden in cm, y omhoog = negatief. size = pixels per meter op die afstand.
VBT.vehicles = (function () {
  const DARK = '#0a0614';

  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function round(ctx, x, y, w, h, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  function circle(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function glowLight(ctx, x, y, r, c) {
    ctx.shadowColor = c; ctx.shadowBlur = 18; circle(ctx, x, y, r, c); ctx.shadowBlur = 0;
  }
  function shadow(ctx, w) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, -4, w, 9, 0, 0, Math.PI * 2); ctx.fill(); }
  function plate(ctx, y, text) {
    round(ctx, -26, y, 52, 14, 2, '#f4f1ff');
    ctx.fillStyle = '#111'; ctx.font = '900 10px Orbitron, Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(text, 0, y + 11);
  }

  function ferrari(ctx) {
    shadow(ctx, 110);
    rect(ctx, -100, -58, 22, 58, DARK); rect(ctx, 78, -58, 22, 58, DARK);
    const g = ctx.createLinearGradient(0, -110, 0, -10);
    g.addColorStop(0, '#ff3d3d'); g.addColorStop(1, '#a00010');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-98, -16); ctx.lineTo(-96, -66); ctx.quadraticCurveTo(-90, -80, -60, -82);
    ctx.lineTo(60, -82); ctx.quadraticCurveTo(90, -80, 96, -66); ctx.lineTo(98, -16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a0010';
    ctx.beginPath(); ctx.moveTo(-62, -82); ctx.lineTo(-44, -108); ctx.lineTo(44, -108); ctx.lineTo(62, -82); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 5; i++) rect(ctx, -38, -104 + i * 4.5, 76, 2, DARK);      // motorlamellen
    rect(ctx, -90, -86, 180, 4, '#2a0006');                                       // spoiler
    for (const x of [-72, -48, 48, 72]) glowLight(ctx, x, -58, 8, '#ff2040');     // vier ronde achterlichten
    rect(ctx, -70, -20, 140, 12, DARK);                                           // diffuser
    for (const x of [-26, -12, 12, 26]) circle(ctx, x, -14, 4.5, '#9a9ab0');      // uitlaten
    circle(ctx, 0, -42, 6, '#ffd60a');                                            // logo
    plate(ctx, -36, 'VBT 1');
  }

  function teamCar(ctx, s) {
    shadow(ctx, 100);
    rect(ctx, -92, -50, 20, 50, DARK); rect(ctx, 72, -50, 20, 50, DARK);
    round(ctx, -90, -128, 180, 112, 12, '#f4f1ff');                               // carrosserie
    rect(ctx, -90, -62, 180, 10, '#ff2e88'); rect(ctx, -90, -52, 180, 4, '#24e8ff');
    round(ctx, -70, -122, 140, 42, 6, '#1a1430');                                 // achterruit
    for (const x of [-82, 72]) { ctx.shadowColor = '#ff2040'; ctx.shadowBlur = 12; rect(ctx, x, -112, 10, 38, '#ff2040'); ctx.shadowBlur = 0; }
    ctx.fillStyle = '#ff2e88'; ctx.font = '900 13px Orbitron, Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('VBT TEAM', 0, -68);
    plate(ctx, -40, 'DS-01');
    rect(ctx, -84, -136, 168, 5, '#2a2a36');                                      // dakdrager
    for (const x of [-55, -18, 18, 55]) {                                         // fietsen op het dak (van achteren)
      rect(ctx, x - 2, -196, 4, 60, DARK);
      ctx.strokeStyle = '#24e8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, -186); ctx.lineTo(x, -146); ctx.stroke();
      rect(ctx, x - 12, -192, 24, 3, '#2a2a36');
    }
    // ploegleider hangt uit het raam (links, bestuurderskant) en zwaait
    const wave = Math.sin((s.time || 0) * 6) * 0.5;
    ctx.save();
    ctx.translate(-92, -116);
    circle(ctx, -14, -6, 13, '#e8a27c');                                          // hoofd
    rect(ctx, -28, -20, 28, 7, '#ff2e88'); rect(ctx, -32, -16, 12, 4, '#ff2e88'); // pet
    rect(ctx, -24, -8, 20, 4, DARK);                                              // zonnebril
    if (s.speaking && Math.floor((s.time || 0) * 8) % 2) round(ctx, -18, 2, 8, 5, 2, '#5a1010');   // mond open
    ctx.translate(-6, 10);
    ctx.rotate(-1.1 + wave);                                                      // zwaaiende arm
    rect(ctx, -4, -44, 8, 44, '#24e8ff');
    circle(ctx, 0, -46, 6, '#e8a27c');
    ctx.restore();
  }

  function tractor(ctx, s) {
    shadow(ctx, 110);
    for (const x of [-104, 66]) { rect(ctx, x, -140, 38, 140, DARK); rect(ctx, x + 8, -120, 22, 100, '#2bd67b'); }
    round(ctx, -60, -110, 120, 70, 6, '#1f8a4c');
    rect(ctx, -46, -220, 6, 112, '#2a2a36'); rect(ctx, 40, -220, 6, 112, '#2a2a36');
    rect(ctx, -54, -228, 108, 10, '#1f8a4c');                                     // dak
    if (Math.floor((s.time || 0) * 3) % 2) glowLight(ctx, 0, -236, 8, '#ff9e3d');   // zwaailicht
    circle(ctx, 0, -170, 14, '#3a2a20');                                           // boer
    rect(ctx, -16, -156, 32, 40, '#3d8bff');
    ctx.fillStyle = '#ff3d5a'; ctx.beginPath(); ctx.moveTo(0, -96); ctx.lineTo(18, -66); ctx.lineTo(-18, -66); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff9e3d'; ctx.beginPath(); ctx.moveTo(0, -90); ctx.lineTo(12, -70); ctx.lineTo(-12, -70); ctx.closePath(); ctx.fill();
  }

  function iceCream(ctx) {
    shadow(ctx, 100);
    rect(ctx, -86, -44, 18, 44, DARK); rect(ctx, 68, -44, 18, 44, DARK);
    round(ctx, -92, -200, 184, 186, 10, '#fff4fa');
    rect(ctx, -92, -70, 184, 14, '#ff2e88');
    rect(ctx, -2, -190, 4, 120, '#d8c8d8');                                      // deuren
    ctx.fillStyle = '#ff2e88'; ctx.font = '900 22px Orbitron, Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ICE', -46, -120); ctx.fillText('CREAM', 46, -120);
    ctx.fillStyle = '#e0a060'; ctx.beginPath(); ctx.moveTo(-26, -232); ctx.lineTo(26, -232); ctx.lineTo(0, -200); ctx.closePath(); ctx.fill();
    circle(ctx, -12, -244, 18, '#ffb3d9'); circle(ctx, 12, -244, 18, '#b3ffe6'); circle(ctx, 0, -262, 16, '#fff2a8');
    for (const x of [-84, 74]) glowLight(ctx, x, -60, 6, '#ff2040');
  }

  function broomWagon(ctx) {
    shadow(ctx, 96);
    rect(ctx, -86, -46, 18, 46, DARK); rect(ctx, 68, -46, 18, 46, DARK);
    round(ctx, -90, -170, 180, 156, 8, '#2a2a36');
    ctx.fillStyle = '#ffd60a'; ctx.font = '900 14px Orbitron, Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('FIN DE COURSE', 0, -120);
    rect(ctx, 20, -230, 6, 120, '#8a5a2a');                                       // bezem
    ctx.fillStyle = '#d8b060'; ctx.beginPath(); ctx.moveTo(4, -230); ctx.lineTo(42, -230); ctx.lineTo(50, -262); ctx.lineTo(-4, -262); ctx.closePath(); ctx.fill();
    for (const x of [-82, 72]) glowLight(ctx, x, -70, 7, '#ff2040');
    plate(ctx, -40, 'BROOM');
  }

  function ufo(ctx, s) {
    const hover = Math.sin((s.time || 0) * 2) * 10;
    ctx.save();
    ctx.translate(0, -420 + hover);
    const beam = ctx.createLinearGradient(0, 0, 0, 420);
    beam.addColorStop(0, 'rgba(93,255,158,0.45)'); beam.addColorStop(1, 'rgba(93,255,158,0)');
    ctx.fillStyle = beam;
    ctx.beginPath(); ctx.moveTo(-40, 10); ctx.lineTo(40, 10); ctx.lineTo(140, 420 - hover); ctx.lineTo(-140, 420 - hover); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9a9ab0'; ctx.beginPath(); ctx.ellipse(0, 0, 150, 34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8c8d8'; ctx.beginPath(); ctx.ellipse(0, -8, 150, 22, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(36,232,255,0.8)'; ctx.beginPath(); ctx.ellipse(0, -26, 54, 36, 0, Math.PI, 0); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const on = (Math.floor((s.time || 0) * 6) + i) % 3 === 0;
      glowLight(ctx, -126 + i * 36, 6, 6, on ? '#ffe66d' : '#ff2e88');
    }
    ctx.restore();
  }

  const DRAW = { ferrari, teamcar: teamCar, tractor, icecream: iceCream, broom: broomWagon, ufo };

  // x, y = grondpunt op scherm; size = px per meter
  function draw(ctx, x, y, size, s) {
    const fn = DRAW[s.vehicle];
    const u = size / 100;
    if (!fn || u < 0.02) return;
    ctx.save();
    if (s.alpha !== undefined) ctx.globalAlpha = s.alpha;
    ctx.translate(x, y);
    ctx.scale(u, u);
    ctx.lineCap = 'round';
    fn(ctx, s);
    ctx.restore();
  }

  return { draw, kinds: Object.keys(DRAW) };
})();
