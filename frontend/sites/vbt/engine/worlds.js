// Game-werelden (item 1366): een wereld = palet + hemel (zon, sterren, bergen) + terrein (grid) + decor-sprites.
// OutRun is de basis; andere werelden overschrijven alleen wat anders is. Kiezen in SETTINGS (settings.world).
// Plus dag/nacht (1361): per wereld een nachtpalet waar de lucht tijdens een lange rit naartoe loopt.
VBT.worlds = (function () {
  const BASE = JSON.parse(JSON.stringify(VBT.palette));       // OutRun zoals in config.js

  const WORLDS = {
    outrun: {
      name: 'OutRun', desc: 'Synthwave sunset, palms and neon',
      sky: { sun: 'stripes', stars: true, grid: true, smooth: true },
      night: { skyTop: '#020008', skyMid: '#0d0228', skyLow: '#2a0a4a', horizon: '#5a1450' },
    },
    tron: {
      name: 'Grid', desc: 'Black void, glowing cyan and orange lines',
      palette: {
        skyTop: '#000000', skyMid: '#020814', skyLow: '#06203a', horizon: '#0b4a6e', sunTop: '#7ff6ff', sunBottom: '#1aa0c8',
        ground: '#000000', grid: '#24e8ff', road: '#03060c', roadAlt: '#060b16', rumble: '#ff9e3d', rumbleAlt: '#000000',
        lane: '#9ff6ff', fog: '#02121e', edge: '#ff9e3d', contour: '#24e8ff', flank: '#020a12', sunGlow: '#24e8ff',
        horizonGlow: 'rgba(36,232,255,0.45)', mtnFar: ['#000000', '#000000'], mtnFarLine: 'rgba(36,232,255,0.9)',
        mtnNear: ['#000000', '#000000'], mtnNearLine: '#ff9e3d',
      },
      sky: { sun: 'ring', stars: true, grid: true, smooth: true },
      night: { skyTop: '#000000', skyMid: '#000000', skyLow: '#02101c', horizon: '#05304a' },
    },
    alps: {
      name: 'Pixel Alps', desc: 'Snowy peaks, pines, chalets and cows',
      palette: {
        skyTop: '#3a7bd5', skyMid: '#6aa8ec', skyLow: '#b8dcf7', horizon: '#e9f4ff', sunTop: '#fff6c9', sunBottom: '#ffd65a',
        ground: '#3f8a3a', grid: '#5fae4f', road: '#5b5b66', roadAlt: '#63636f', rumble: '#e33b3b', rumbleAlt: '#f4f4f4',
        lane: '#ffffff', fog: '#cfe3f5', edge: '#f4f4f4', contour: '#2f6b2a', flank: '#3a7a33', sunGlow: '#fff2a8',
        horizonGlow: 'rgba(255,255,255,0.35)', mtnFar: ['#8aa4c8', '#6f86a8'], mtnFarLine: '#ffffff',
        mtnNear: ['#4f6f8f', '#3d5672'], mtnNearLine: '#e9f4ff',
      },
      sky: { sun: 'round', stars: false, grid: false, snowcaps: true, smooth: false },
      night: { skyTop: '#0b1530', skyMid: '#1d2f5a', skyLow: '#e08a5a', horizon: '#ffb070' },
    },
  };

  let cur = 'outrun';
  const built = {};

  function apply(id) {
    if (!WORLDS[id]) id = 'outrun';
    cur = id;
    for (const k of Object.keys(VBT.palette)) delete VBT.palette[k];
    Object.assign(VBT.palette, JSON.parse(JSON.stringify(BASE)), WORLDS[id].palette || {});
    if (VBT.util._fogCache) VBT.util._fogCache.clear();
    if (VBT.loop) VBT.loop.resize();                          // achtergrond (zon, bergen, sterren) opnieuw bouwen
    if (VBT.store) VBT.store.log('settings', 'World: ' + WORLDS[id].name, 'debug');
  }

  const get = () => WORLDS[cur];

  // canvas voor een decor-sprite in deze wereld: eigen variant, null = niet tekenen, anders het origineel
  function canvasFor(sprite) {
    if (sprite.world) return sprite.world === cur ? sprite : null;     // decor van één wereld (chalet, koe)
    if (cur === 'outrun' || !sprite.key) return sprite.canvas;
    if (!built[cur] && VBT.worldSprites && VBT.worldSprites[cur]) built[cur] = VBT.worldSprites[cur]();
    const set = built[cur] || {};
    return sprite.key in set ? set[sprite.key] : sprite.canvas;
  }

  // dag/nacht: 0 = begin van de rit, 1 = na een uur volledig nacht (alleen tijdens een rit, als het aan staat)
  function nightFactor(game) {
    if (!VBT.settings.show('daynight') || !game || !game.isRiding()) return 0;
    return VBT.util.clamp((game.rideTime - 300) / 3300, 0, 1);
  }

  const list = () => Object.entries(WORLDS).map(([id, w]) => ({ id, name: w.name, desc: w.desc }));

  return { apply, get, current: () => cur, canvasFor, nightFactor, list };
})();
