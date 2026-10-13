// Ritten en profiel bewaren in de browser (localStorage). In HomePlatform vervangt storage-api.js dit door
// dezelfde (async) functies op de server, zodat de rest van het spel niets merkt van waar alles staat.
VBT.storage = (function () {
  const IDX = 'vbt.rides.v1';
  const SAMPLES = id => 'vbt.ride.' + id;

  function get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  const summary = ride => { const s = Object.assign({}, ride); delete s.samples; return s; };

  async function saveRide(ride) {
    const index = get(IDX) || [];
    index.unshift(summary(ride));
    set(IDX, index);
    // vol? dan de samples van de oudste ritten weggooien (de samenvatting blijft), PB's sparen
    while (!set(SAMPLES(ride.id), ride.samples)) {
      const victim = [...index].reverse().find(r => r.id !== ride.id && r.hasSamples !== false && !r.pb);
      if (!victim) break;
      try { localStorage.removeItem(SAMPLES(victim.id)); } catch (e) { break; }
      victim.hasSamples = false;
      set(IDX, index);
    }
    return ride;
  }

  async function listRides() { return get(IDX) || []; }

  async function getSamples(id) { return get(SAMPLES(id)); }

  // Snelste volle ronde op een parcours (zonder sprongen) -> ghost
  async function bestLap(courseKey) {
    const best = (get(IDX) || [])
      .filter(r => r.courseKey === courseKey && r.lapTime && !r.jumped && r.hasSamples !== false)
      .sort((a, b) => a.lapTime - b.lapTime)[0];
    if (!best) return null;
    const samples = get(SAMPLES(best.id));
    return samples ? Object.assign({}, best, { samples }) : null;
  }

  async function markPb(id) {
    const index = get(IDX) || [];
    index.forEach(r => { if (r.id === id) r.pb = true; });
    set(IDX, index);
  }

  // profiel = FTP, startdatum plan, voltooide workouts
  const PROFILE = 'vbt.plan.v1';
  async function loadProfile() { return get(PROFILE) || {}; }
  async function saveProfile(p) { set(PROFILE, p); }

  async function deleteRide(id) {
    set(IDX, (get(IDX) || []).filter(r => r.id !== id));
    try { localStorage.removeItem(SAMPLES(id)); } catch (e) { /* niets */ }
  }

  async function getRide(id) {
    const s = (get(IDX) || []).find(r => r.id === id);
    return s ? Object.assign({}, s, { samples: get(SAMPLES(id)) || [] }) : null;
  }

  return { saveRide, listRides, getSamples, getRide, deleteRide, bestLap, markPb, loadProfile, saveProfile };
})();
