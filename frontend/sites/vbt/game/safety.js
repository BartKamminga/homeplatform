// Geen dataverlies: (1) journal - de lopende rit staat elke seconde (en bij tab sluiten/verbergen) in IndexedDB;
// na een crash of gesloten tab wordt hij bij de volgende start alsnog afgerond en bewaard.
// (2) outbox - een afgeronde rit gaat eerst lokaal in de outbox en pas daarna naar de server; mislukt dat,
// dan blijft hij staan en wordt het opnieuw geprobeerd (bij opstarten, als het internet terugkomt, elke 30 s).
// Een clientId per rit zorgt dat een herhaalde poging op de server nooit een dubbele rit geeft.
VBT.safety = (function () {
  const DB = 'vbt', STORE = 'kv', J_META = 'journal:meta', J_CHUNK = 'journal:chunk:', OUTBOX = 'outbox:';
  const RETRY_MS = 30000;
  let dbp = null, flushing = false, retryTimer = null;
  let jId = null, jWritten = 0, jBusy = Promise.resolve();
  const listeners = new Set();

  // ── mini-IndexedDB (key-value) ──
  function db() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode);
      const res = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(res && res.result);
      t.onerror = () => reject(t.error);
    });
  }
  const put = (key, value) => tx('readwrite', s => s.put(value, key));
  const get = key => tx('readonly', s => s.get(key));
  const del = key => tx('readwrite', s => s.delete(key));
  async function all(prefix) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const out = [];
      const req = d.transaction(STORE).objectStore(STORE).openCursor(IDBKeyRange.bound(prefix, prefix + '￿'));
      req.onsuccess = () => { const c = req.result; if (c) { out.push(c.value); c.continue(); } else resolve(out); };
      req.onerror = () => reject(req.error);
    });
  }

  const newClientId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { /* UI */ } });

  // ── journal: meta + alleen de nieuwe samples als los stukje (licht genoeg om elke seconde te doen) ──
  function journal(rec) {
    if (!rec) return jBusy;
    jBusy = jBusy.then(async () => {
      if (rec.clientId !== jId) { jId = rec.clientId; jWritten = 0; }
      const meta = Object.assign({}, rec);
      delete meta.samples;
      const start = jWritten, chunk = rec.samples.slice(start);
      await put(J_META, JSON.parse(JSON.stringify(meta)));
      if (chunk.length) { await put(J_CHUNK + String(start).padStart(7, '0'), chunk); jWritten = start + chunk.length; }
    }).catch(e => VBT.ble && VBT.ble.note('journal: ' + e.message));
    return jBusy;
  }

  function clearJournal() {
    jBusy = jBusy.then(async () => {
      jId = null; jWritten = 0;
      await del(J_META);
      const d = await db();
      await new Promise(resolve => {
        const t = d.transaction(STORE, 'readwrite');
        t.objectStore(STORE).delete(IDBKeyRange.bound(J_CHUNK, J_CHUNK + '￿'));
        t.oncomplete = t.onerror = resolve;
      });
    }).catch(() => {});
    return jBusy;
  }

  // ── outbox ──
  async function enqueue(ride) {
    ride.clientId = ride.clientId || newClientId();
    await put(OUTBOX + ride.clientId, ride);
    emit();
    return ride;
  }

  // alles in de outbox naar de server; onSaved(ride, saved) per gelukte rit
  async function flush(onSaved) {
    if (flushing) return;
    flushing = true;
    clearTimeout(retryTimer);
    let failed = false;
    try {
      for (const ride of await all(OUTBOX)) {
        try {
          const saved = await VBT.storage.saveRide(ride);
          await del(OUTBOX + ride.clientId);
          if (onSaved) onSaved(ride, saved);
          if (VBT.game && VBT.game.lastRide && VBT.game.lastRide.clientId === ride.clientId) {
            VBT.game.lastRide.serverId = saved.serverId;
            if (VBT.stravaUi) VBT.stravaUi.render();
          }
        } catch (e) {
          failed = true;
          break;    // netwerk weg: later opnieuw, volgorde bewaren
        }
      }
    } finally {
      flushing = false;
      if (failed) retryTimer = setTimeout(() => flush(), RETRY_MS);
      emit();
    }
  }

  const pending = () => all(OUTBOX).catch(() => []);

  // Bij opstarten: een achtergebleven journal (crash / tab dicht midden in een rit) afronden en bewaren
  async function recover() {
    let rec = null;
    try {
      rec = await get(J_META);
      if (rec) rec.samples = (await all(J_CHUNK)).flat();    // stukjes op volgorde van de sleutel
    } catch (e) { return null; }
    if (!rec) return null;
    const ride = VBT.recorder.finalize(rec);
    ride.recovered = true;
    await enqueue(ride);
    await clearJournal();
    return ride;
  }

  function init() {
    window.addEventListener('online', () => flush());
    return recover().then(ride => { flush(); return ride; });
  }

  return { init, journal, clearJournal, enqueue, flush, pending, on: fn => listeners.add(fn) };
})();
