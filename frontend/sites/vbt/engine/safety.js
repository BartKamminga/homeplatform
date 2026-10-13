// Geen dataverlies: (1) journal - de lopende rit staat elke seconde (en bij tab sluiten/verbergen) in IndexedDB;
// na een crash of gesloten tab wordt hij bij de volgende start alsnog afgerond en bewaard.
// (2) outbox - een afgeronde rit gaat eerst lokaal in de outbox en pas daarna naar de server; mislukt dat,
// dan blijft hij staan en wordt het opnieuw geprobeerd (bij opstarten, als het internet terugkomt, elke 30 s).
// Een clientId per rit zorgt dat een herhaalde poging op de server nooit een dubbele rit geeft.
VBT.safety = (function () {
  const DB = 'vbt', STORE = 'kv', J_META = 'journal:meta', J_CHUNK = 'journal:chunk:', OUTBOX = 'outbox:';
  const RETRY_MS = 30000;
  let dbp = null, flushing = false, retryTimer = null;
  let jId = null, jWritten = 0, jBusy = Promise.resolve(), jLast = 0;
  // live backup naar de server tijdens de rit
  const LIVE_MS = 10000;
  const live = { clientId: null, sent: 0, lastOk: 0, lastTry: -Infinity, busy: false, failing: false, resume: false };
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
      jLast = performance.now();
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
          VBT.store.log('outbox', 'Ride saved on server: ' + (ride.name || 'ride') + ' (' + ride.duration + ' s)');
          if (onSaved) onSaved(ride, saved);
          if (VBT.game && VBT.game.lastRide && VBT.game.lastRide.clientId === ride.clientId) {
            VBT.game.lastRide.serverId = saved.serverId;      // finish-scherm: Strava-upload kan nu
          }
        } catch (e) {
          VBT.store.log('outbox', 'Saving ride failed: ' + e.message + ' - will retry', 'warn');
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

  // ── live backup: direct bij de start en daarna elke 10 s (of direct met force) alleen de nieuwe samples naar de server ──
  async function liveSync(rec, force) {
    if (!rec || !VBT.storage.liveSync || live.busy) return;
    if (rec.clientId !== live.clientId) Object.assign(live, { clientId: rec.clientId, sent: 0, lastOk: 0, lastTry: -Infinity, failing: false, resume: false });
    const t = performance.now();
    if (!force && t - live.lastTry < LIVE_MS) return;
    if (rec.samples.length <= live.sent && live.lastOk) return;
    live.busy = true;
    live.lastTry = t;
    try {
      const res = await VBT.storage.liveSync({
        clientId: rec.clientId, startedAt: rec.startedAt, kind: rec.kind, courseKey: rec.courseKey, name: rec.name,
        woId: rec.woId, ftp: rec.ftp, jumped: rec.jumped, fromIndex: live.sent, samples: rec.samples.slice(live.sent),
        resume: live.resume,
      });
      live.resume = false;
      const added = res.received - live.sent;
      live.sent = res.received;          // server bepaalt waar de volgende batch begint (vangt gemiste batches op)
      VBT.store.log('backup', 'Server backup: ' + res.received + ' s on server (+' + added + ')', 'debug');
      live.lastOk = performance.now();
      live.failing = false;
    } catch (e) {
      if (!live.failing) VBT.store.log('backup', 'Server backup failed: ' + e.message + ' - kept locally, retrying', 'warn');
      live.failing = true;               // geen ramp: lokaal journal + outbox dekken dit, volgende tick opnieuw
    } finally {
      live.busy = false;
      emit();
    }
  }

  // status voor het BACKUP-lampje in de HUD: ok | behind | failing | off
  function liveStatus() {
    if (!VBT.storage.liveSync || !VBT.recorder.active()) return 'off';
    if (live.failing) return 'failing';
    return live.lastOk && performance.now() - live.lastOk < LIVE_MS * 2.5 ? 'ok' : 'behind';
  }
  const journalAge = () => (jLast ? (performance.now() - jLast) / 1000 : null);
  const liveAge = () => (live.lastOk ? (performance.now() - live.lastOk) / 1000 : null);
  // hoeveel seconden rijtijd staan nog niet op de server: gemeten tegen de klok van de rit (niet tegen het aantal
  // samples), zodat ook een opname die stilvalt als achterstand zichtbaar wordt
  function liveLag() {
    const rec = VBT.recorder.current();
    if (!rec) return 0;
    const S = rec.samples, onServer = rec.clientId === live.clientId ? Math.min(live.sent, S.length) : 0;
    const serverT = onServer ? S[onServer - 1][0] : 0;
    return Math.max(0, Math.round((VBT.game ? VBT.game.rideTime : S.length ? S[S.length - 1][0] : 0) - serverT));
  }

  // hervatte rit: de server heeft deze samples al (of krijgt ze met resume opnieuw open gezet)
  function liveResume(rec) {
    Object.assign(live, { clientId: rec.clientId, sent: rec.samples.length, lastOk: 0, lastTry: -Infinity, failing: false, resume: true });
  }

  // hervatte rit die nog in de outbox stond: eruit halen, bij de finish gaat de langere versie erin
  const dropFromOutbox = clientId => del(OUTBOX + clientId).catch(() => {});

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

  return { init, journal, clearJournal, enqueue, flush, pending, liveSync, liveStatus, liveAge, liveLag, journalAge, liveResume, dropFromOutbox, on: fn => listeners.add(fn) };
})();
