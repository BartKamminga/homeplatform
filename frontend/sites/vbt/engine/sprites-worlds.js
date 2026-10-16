// Decor-sprites per wereld (item 1366). Sleutels zoals in sprites.js (PALM_L, LAMP_R, ...): een canvas,
// { canvas, worldW } met een eigen breedte, of null = niet tekenen in deze wereld. Alpen-sprites zijn pixel-art:
// klein getekend en met harde pixels opgeschaald. Losse wereld-decor (chalet, koe) staat in VBT.worldDecor.
(function () {
  function make(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  }

  // pixel-art: teken op een klein raster (w x h) met letters per kleur, schaal op met factor s
  function pixels(rows, colors, s) {
    const h = rows.length, w = rows[0].length;
    return make(w * s, h * s, ctx => {
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.' || !colors[ch]) return;
        ctx.fillStyle = colors[ch];
        ctx.fillRect(x * s, y * s, s, s);
      }));
    });
  }

  function mirror(c) {
    return make(c.width, c.height, ctx => { ctx.translate(c.width, 0); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0); });
  }

  const PINE = [
    '.......g.......', '......ggg......', '.....ggGgg.....', '......ggg......', '.....ggggg.....', '....ggGgggg....',
    '.....ggggg.....', '....gggggGg....', '...gggGggggg...', '....ggggggg....', '...gggggGgggg..', '..gggGgggggggg.',
    '...ggggggggg...', '..ggggGggggggg.', '.ggggggggGggggg', 'gggGgggggggggggg'.slice(0, 15), '......bbb......',
    '......bbb......', '......bbb......',
  ];
  const POLE = ['rr', 'rr', 'rr', 'ww', 'ww', 'ww', 'rr', 'rr', 'rr', 'ww', 'ww', 'ww', 'ww', 'ww', 'ww', 'ww', 'kk'];
  const CHALET = [
    '..........ss..........', '........ssssss........', '......ssssssssss......', '....ssssssssssssss....',
    '..ssssssssssssssssss..', 'ssssssssssssssssssssss', '.bbbbbbbbbbbbbbbbbbbb.', '.bwwbbbbbbwwbbbbbbwwb.',
    '.bwwbbbbbbwwbbbbbbwwb.', '.bbbbbbbbbbbbbbbbbbbb.', '.bbbbbbbbbddbbbbbbbbb.', '.bwwbbbbbbddbbbbbbwwb.',
    '.bwwbbbbbbddbbbbbbwwb.', '.bbbbbbbbbddbbbbbbbbb.', '.kkkkkkkkkkkkkkkkkkkk.',
  ];
  const COW = [
    '..........kk..', '.wwwwwwwwkwwk.', 'wwkkwwwwwwwwwp', 'wwkkkwwkkwwwpp', 'wwwwwwwkkwww..', '.wwwwwwwwwww..',
    '.w.w.....w.w..', '.k.k.....k.k..',
  ];

  VBT.worldSprites = {
    tron: () => {
      const pole = make(60, 520, (ctx, w, h) => {
        ctx.shadowColor = '#24e8ff'; ctx.shadowBlur = 18;
        ctx.fillStyle = '#24e8ff'; ctx.fillRect(w / 2 - 3, 40, 6, h - 40);
        ctx.shadowColor = '#ff9e3d'; ctx.fillStyle = '#ff9e3d'; ctx.fillRect(w / 2 - 12, 24, 24, 16);
      });
      return { PALM_L: null, PALM_R: null, LAMP_L: { canvas: pole, worldW: 210 }, LAMP_R: { canvas: pole, worldW: 210 } };
    },
    alps: () => {
      const pine = pixels(PINE, { g: '#2f6b2a', G: '#5fae4f', b: '#6b4423' }, 12);
      const pine2 = pixels(PINE, { g: '#24572a', G: '#4f9a45', b: '#5a3a1e' }, 12);
      const pole = pixels(POLE, { r: '#e33b3b', w: '#f4f4f4', k: '#333' }, 10);
      return {
        PALM_L: { canvas: pine, worldW: 1100 }, PALM_R: { canvas: mirror(pine2), worldW: 1250 },
        LAMP_L: { canvas: pole, worldW: 130 }, LAMP_R: { canvas: pole, worldW: 130 },
      };
    },
  };

  // losse decor-stukken die alleen in één wereld verschijnen (scenery.js zet ze langs de weg)
  VBT.worldDecor = {
    alps: () => [
      { canvas: pixels(CHALET, { s: '#f4f8ff', b: '#8a5a2b', w: '#ffe9a8', d: '#4a2c12', k: '#3a3a3a' }, 12), worldW: 2600, offset: 2.2, every: 160 },
      { canvas: pixels(COW, { w: '#f4f4f4', k: '#222', p: '#f2a7b5' }, 10), worldW: 900, offset: -1.6, every: 110 },
    ],
  };
})();
