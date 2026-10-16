// Gebruikersinstellingen (vbt_profiles.settings): max-hartslag voor de HR-zones, stem van de ploegleider,
// en wat er getoond wordt (extra's, HUD-panelen, decor). Laden bij de start, opslaan per wijziging (server voegt samen).
VBT.settings = (function () {
  // weergave: alles standaard aan; per onderdeel uit te zetten (en ALL ON / ALL OFF in Settings)
  const DISPLAY = [
    { group: 'Riders', items: [['peloton', 'Peloton'], ['ghost', 'Ghost / pacer']] },
    { group: 'Extras', items: [
      ['coach', 'Team director car + speech bubble'], ['voice', 'Team director voice'], ['messages', 'Pop-up messages (DRAFT!, CLIMB!, ...)'],
      ['traffic', 'Strange vehicles'], ['veh_ferrari', 'Ferrari'], ['veh_tractor', 'Tractor'], ['veh_icecream', 'Ice cream van'],
      ['veh_broom', 'Broom wagon'], ['veh_ufo', 'UFO']] },
    { group: 'HUD', items: [
      ['hud_power', 'Power'], ['hud_hr', 'Heart rate'], ['hud_cadence', 'Cadence'], ['hud_speed', 'Speed / cadence'], ['hud_time', 'Time / ghost / bunch / backup'],
      ['hud_elevation', 'Elevation profile'], ['hud_workout', 'Workout panel'], ['hud_top', 'Lap / distance'], ['hud_chips', 'Status lights'], ['hud_music', 'Music bar']] },
    { group: 'Scenery', items: [['palms', 'Palm trees'], ['lamps', 'Street lamps'], ['signs', 'Billboards, signs, start gate'],
      ['sky', 'Sun and mountains'], ['crt', 'CRT scanlines']] },
    { group: 'World', items: [['road_zone', 'Road edges in your power-zone colour'], ['road_tint', 'Road surface tinted with your zone (subtle)'],
      ['daynight', 'Day turns to night on long rides'], ['weather', 'Weather (rain, mist)'], ['seasons', 'Seasons (leaves, snow, blossom)'],
      ['structures', 'Tunnels and bridges'], ['fans', 'Fans on climbs'], ['kmsigns', 'Kilometre signs with your average'],
      ['fireworks', 'Fireworks on a PB or summit'], ['feedzone', 'Feed zone on long rides']] },
  ];
  const DISPLAY_KEYS = DISPLAY.flatMap(g => g.items.map(i => i[0]));
  const DEFAULTS = Object.assign({ hrMax: 185, voiceLang: 'en-US', ftpHistory: [], world: 'outrun' },
    Object.fromEntries(DISPLAY_KEYS.map(k => [k, true])), { road_tint: false });     // wegdek-tint (1360 B) standaard uit
  const values = Object.assign({}, DEFAULTS);

  const show = key => values[key] !== false;

  // HUD-onderdelen: React zet body.off-<key> vanuit het snapshot (CSS verbergt ze); canvas-onderdelen lezen show() zelf

  async function load() {
    try {
      const s = VBT.storage.loadSettings ? await VBT.storage.loadSettings() : {};
      Object.assign(values, s || {});
    } catch (e) { /* standaardwaarden */ }
    return values;
  }

  function save(patch) {
    Object.assign(values, patch);
    if (VBT.storage.saveSettings) VBT.storage.saveSettings(patch).catch(() => { /* blijft in geheugen */ });
    return values;
  }

  const setAll = on => save(Object.fromEntries(DISPLAY_KEYS.map(k => [k, on])));

  return { values, load, save, show, setAll, DEFAULTS, DISPLAY, DISPLAY_KEYS };
})();
