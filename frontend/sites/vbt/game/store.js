// Brug engine -> React. De gameloop publiceert max. 10x/s een onveranderlijk snapshot (React leest via
// useSyncExternalStore, dus geen re-render per frame). Daarnaast een ringbuffer met getypte events
// (interval, pause, resume, jump, lap, ble, erg, backup, outbox, save, error) en 2 min telemetrie (1 Hz).
VBT.store = (function () {
  const PUBLISH_MS = 100;          // HUD
  const SLOW_MS = 250;             // zijpanelen: 4x/s is genoeg en spaart frames
  const MAX_EVENTS = 500;
  const TELEMETRY_S = 120;
  const listeners = new Set();
  const slowListeners = new Set();
  let lastSlow = 0;
  const eventListeners = new Set();
  let snapshot = { state: 'boot', events: 0 };
  let lastPublish = 0, lastTelemetry = 0;
  const events = [];
  const telemetry = [];       // [rideTime, watts, hr, cadence, target]
  let eventSeq = 0;

  function log(type, msg, level = 'info', data) {
    const g = VBT.game;
    events.push({ id: ++eventSeq, t: Date.now(), rideTime: g ? +g.rideTime.toFixed(1) : 0, type, level, msg, data });
    if (events.length > MAX_EVENTS) events.shift();
    eventListeners.forEach(fn => { try { fn(); } catch (e) { /* UI */ } });
  }

  // snapshot van wat de UI nodig heeft; alleen primitieven/kleine objecten
  function build(game) {
    const s = game.sensors, run = game.run, ble = VBT.ble, safety = VBT.safety;
    const cur = run && !run.wo.free && !run.done ? VBT.workout.current(run, VBT.cfg.rider.ftp) : null;
    const T = VBT.track;
    const link = l => ({ status: l.status, name: l.name, protocol: l.protocol, wanted: l.wanted });
    return {
      state: game.state,
      autoPaused: !!game.autoPaused,
      rideTime: game.rideTime,
      recording: VBT.recorder.active(),
      ftp: VBT.cfg.rider.ftp,
      settings: Object.assign({}, VBT.settings.values),
      hrZone: VBT.util.hrZoneFor(s.hr).name,
      watts: Math.round(s.watts), cadence: Math.round(s.cadence), hr: Math.round(s.hr),
      avg3s: s.avg3s.length ? Math.round(s.avg3s.reduce((a, b) => a + b, 0) / s.avg3s.length) : 0,
      speed: game.player.v * 3.6,
      dist: game.player.dist,
      grade: game.grade,
      alt: T.segments.length ? T.altitude(game.playerY - T.heightRange()[0]) : 0,
      ghost: { label: game.ghostLabel, gap: game.ghost.dist - game.player.dist },
      bunch: { gap: game.pack.dist - game.player.dist, inBunch: !!game.inBunch },
      run: run ? {
        name: run.wo.name, id: run.wo.id, week: run.wo.week, day: run.wo.day, free: !!run.wo.free,
        total: run.total, elapsed: run.elapsed, index: run.index,
        target: cur ? { pct: cur.pct, watts: cur.watts, cadence: cur.cadence, remaining: cur.remaining, next: cur.next } : null,
        cadScore: run.cadTotal > 0 ? Math.round(run.cadOk / run.cadTotal * 100) : 100,
      } : null,
      ble: {
        trainer: link(ble.links.trainer), hr: link(ble.links.hr),
        trainerOk: ble.trainerOk(), hrOk: ble.hrOk(), packets: ble.live.packets,
        dataAge: ble.live.tPower ? (performance.now() - ble.live.tPower) / 1000 : null,
        live: { power: ble.live.power, cadence: Math.round(ble.live.cadence), speed: ble.live.speed, hr: ble.live.hr },
        ergCapable: ble.ergCapable(),
      },
      backup: { status: safety.liveStatus(), lag: safety.liveLag(), age: safety.liveAge(), journalAge: safety.journalAge() },
      lastRide: game.lastRide ? { clientId: game.lastRide.clientId, name: game.lastRide.name, duration: game.lastRide.duration } : null,
      events: eventSeq,
    };
  }

  // aangeroepen vanuit de gameloop (elk frame); publiceert zelf max. 10x/s
  function tick(game) {
    const now = performance.now();
    if (now - lastTelemetry >= 1000 && ['ride', 'paused', 'confirm', 'countdown'].includes(game.state)) {
      lastTelemetry = now;
      const cur = game.run && !game.run.wo.free && !game.run.done ? VBT.workout.current(game.run, VBT.cfg.rider.ftp) : null;
      telemetry.push([+game.rideTime.toFixed(1), Math.round(game.sensors.watts), Math.round(game.sensors.hr),
        Math.round(game.sensors.cadence), cur ? cur.watts : null]);
      if (telemetry.length > TELEMETRY_S) telemetry.shift();
    }
    if (now - lastPublish < PUBLISH_MS) return;
    lastPublish = now;
    snapshot = build(game);
    listeners.forEach(fn => { try { fn(); } catch (e) { /* UI */ } });
    if (now - lastSlow >= SLOW_MS) {
      lastSlow = now;
      slowListeners.forEach(fn => { try { fn(); } catch (e) { /* UI */ } });
    }
  }

  return {
    log, tick,
    getSnapshot: () => snapshot,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    subscribeSlow: fn => { slowListeners.add(fn); return () => slowListeners.delete(fn); },
    getEvents: () => events,
    subscribeEvents: fn => { eventListeners.add(fn); return () => eventListeners.delete(fn); },
    getTelemetry: () => telemetry,
    clearTelemetry: () => { telemetry.length = 0; },
  };
})();
