// Procedurele neon-sprites (geen externe plaatjes nodig); bouwen na het laden van de fonts
VBT.buildSprites = function () {
  const P = VBT.palette;
  const DARK = '#0b0120';

  function make(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  }

  function glow(ctx, color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function frond(ctx, x, y, ang, len, droop) {
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len * 0.4 + droop;
    const cx = x + Math.cos(ang) * len * 0.5;
    const cy = y - len * 0.3;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
    ctx.lineWidth = 3;
    for (let i = 2; i <= 11; i++) {
      const t = i / 12;
      const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex;
      const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ey;
      const l = len * 0.28 * (1 - t * 0.55);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(ang) * l * 0.35, py + l);
      ctx.stroke();
    }
  }

  function palm(mirror) {
    return make(320, 560, (ctx, w, h) => {
      if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      const bx = w * 0.42, by = h - 6, tx = w * 0.58, ty = h * 0.3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = DARK;
      glow(ctx, P.pink, 22);
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(w * 0.3, h * 0.6, tx, ty);
      ctx.stroke();
      // ringen op de stam
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,46,136,0.55)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 16; i++) {
        const t = i / 16;
        const x = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * w * 0.3 + t * t * tx;
        const y = (1 - t) * (1 - t) * by + 2 * (1 - t) * t * h * 0.6 + t * t * ty;
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x + 8, y - 3);
        ctx.stroke();
      }
      ctx.strokeStyle = DARK;
      glow(ctx, P.cyan, 18);
      const angles = [-2.9, -2.3, -1.8, -1.3, -0.8, -0.2, 0.3, 3.4];
      angles.forEach((a, i) => frond(ctx, tx, ty, a, 120 + (i % 3) * 18, 40 + (i % 2) * 25));
    });
  }

  function lamp(side) {
    return make(200, 520, (ctx, w, h) => {
      if (side > 0) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#2a1d4a';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(40, h - 4);
      ctx.lineTo(40, 70);
      ctx.quadraticCurveTo(40, 30, 110, 34);
      ctx.stroke();
      glow(ctx, P.yellow, 40);
      ctx.fillStyle = '#fff6c9';
      ctx.fillRect(100, 30, 60, 14);
      ctx.shadowBlur = 0;
      const g = ctx.createLinearGradient(0, 44, 0, h);
      g.addColorStop(0, 'rgba(255,230,109,0.14)');
      g.addColorStop(1, 'rgba(255,230,109,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(100, 44);
      ctx.lineTo(160, 44);
      ctx.lineTo(w, h);
      ctx.lineTo(60, h);
      ctx.fill();
    });
  }

  function billboard(title, sub, color) {
    return make(560, 340, (ctx, w, h) => {
      ctx.fillStyle = '#1a1030';
      ctx.fillRect(90, 220, 18, h - 220);
      ctx.fillRect(w - 108, 220, 18, h - 220);
      glow(ctx, color, 30);
      ctx.fillStyle = DARK;
      ctx.strokeStyle = color;
      ctx.lineWidth = 8;
      ctx.fillRect(14, 14, w - 28, 210);
      ctx.strokeRect(14, 14, w - 28, 210);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      glow(ctx, color, 24);
      ctx.font = '900 92px Orbitron, "Arial Black", sans-serif';
      ctx.fillText(title, w / 2, 125);
      ctx.font = '700 34px Orbitron, Arial, sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(sub, w / 2, 190);
    });
  }

  function gradeSign(text) {
    return make(200, 300, (ctx, w, h) => {
      ctx.fillStyle = '#2a1d4a';
      ctx.fillRect(w / 2 - 6, 150, 12, h - 150);
      glow(ctx, P.yellow, 25);
      ctx.fillStyle = P.yellow;
      ctx.beginPath();
      ctx.moveTo(w / 2, 8);
      ctx.lineTo(w - 12, 90);
      ctx.lineTo(w / 2, 172);
      ctx.lineTo(12, 90);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = DARK;
      ctx.beginPath();
      ctx.moveTo(52, 92);
      ctx.lineTo(w - 52, 92);
      ctx.lineTo(w - 52, 62);
      ctx.closePath();
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.font = '900 32px Orbitron, "Arial Black", sans-serif';
      ctx.fillText(text, w / 2, 130);
    });
  }

  function gantry() {
    return make(1200, 560, (ctx, w, h) => {
      glow(ctx, P.cyan, 30);
      ctx.fillStyle = DARK;
      ctx.strokeStyle = P.cyan;
      ctx.lineWidth = 8;
      [[30, 90], [w - 90, 90]].forEach(([x]) => {
        ctx.fillRect(x, 60, 60, h - 60);
        ctx.strokeRect(x, 60, 60, h - 60);
      });
      glow(ctx, P.pink, 36);
      ctx.strokeStyle = P.pink;
      ctx.fillRect(0, 20, w, 130);
      ctx.strokeRect(4, 20, w - 8, 130);
      ctx.shadowBlur = 0;
      const sq = 20;
      for (let x = 8; x < w - 8; x += sq) {
        for (let r = 0; r < 2; r++) {
          ctx.fillStyle = ((x / sq + r) | 0) % 2 ? '#ffffff' : '#000000';
          ctx.fillRect(x, 118 + r * sq / 2 - 2, sq, sq / 2);
        }
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      glow(ctx, P.pink, 28);
      ctx.font = '900 84px Orbitron, "Arial Black", sans-serif';
      ctx.fillText('START  ·  VBT  ·  FINISH', w / 2, 102);
    });
  }

  function sprite(canvas, worldW, kind) { return { canvas, worldW, kind }; }

  return {
    PALM_L: sprite(palm(false), 1500, 'palms'),
    PALM_R: sprite(palm(true), 1500, 'palms'),
    LAMP_L: sprite(lamp(-1), 700, 'lamps'),
    LAMP_R: sprite(lamp(1), 700, 'lamps'),
    BILL_WATT: sprite(billboard('WATT!', 'PUSH THE PEDALS', P.pink), 2600, 'signs'),
    BILL_VBT: sprite(billboard('VBT', 'VIRTUAL BIKE TRAINER', P.cyan), 2600, 'signs'),
    BILL_KOM: sprite(billboard('KOM', 'KING OF THE MOUNTAIN', P.yellow), 2600, 'signs'),
    BILL_SPRINT: sprite(billboard('SPRINT', '200 M TO GO', P.purple), 2600, 'signs'),
    gradeSign: text => sprite(gradeSign(text), 520, 'signs'),
    GANTRY: sprite(gantry(), 5200, 'signs'),
  };
};
