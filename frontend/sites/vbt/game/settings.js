// Gebruikersinstellingen (vbt_profiles.settings): max-hartslag voor de HR-zones, stem van de ploegleider,
// rare voertuigen langs de weg. Laden bij de start, opslaan per wijziging (server voegt samen).
VBT.settings = (function () {
  const DEFAULTS = { hrMax: 185, voice: true, voiceLang: 'en-US', traffic: true };
  const values = Object.assign({}, DEFAULTS);

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

  return { values, load, save, DEFAULTS };
})();
