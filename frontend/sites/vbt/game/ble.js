// Web Bluetooth: Kickr Core (FTMS, terugval Cycling Power) en hartslagband. Verbinden, live data,
// ERG/SIM-commando's, automatisch opnieuw verbinden met oplopende wachttijd, en een log om te kunnen debuggen.
VBT.ble = (function () {
  const P = VBT.bleParse;
  const SVC = { FTMS: 0x1826, CPS: 0x1818, HR: 0x180d };
  const CHR = { BIKE: 0x2ad2, CONTROL: 0x2ad9, CPM: 0x2a63, HRM: 0x2a37 };
  const STALE_MS = 3000;          // geen vermogen binnen 3 s = signaal kwijt
  const REMEMBER = 'vbt.ble.devices';

  const live = { power: 0, cadence: 0, speed: 0, hr: 0, tPower: 0, tHr: 0, packets: 0 };
  const log = [];
  const listeners = new Set();
  const link = kind => ({ kind, device: null, name: '', status: 'idle', protocol: '', control: false, controlChar: null,
    wanted: false, retries: 0, timer: null, lastCmd: null, crankPrev: null });
  const links = { trainer: link('trainer'), hr: link('hr') };
  let lastTarget = null, lastGrade = null, lastGradeAt = 0, lastErgAt = 0;

  const now = () => performance.now();
  const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { /* UI-fout mag de verbinding niet raken */ } });

  function note(msg) {
    const t = new Date();
    log.push(t.toTimeString().slice(0, 8) + '  ' + msg);
    if (log.length > 300) log.shift();
    if (VBT.store) VBT.store.log('ble', msg, /fail|lost|x |not available|timeout/.test(msg) ? 'warn' : 'info');
    emit();
  }

  function remember(kind, id) {
    try {
      const m = JSON.parse(localStorage.getItem(REMEMBER) || '{}');
      m[kind] = id;
      localStorage.setItem(REMEMBER, JSON.stringify(m));
    } catch (e) { /* niet erg: dan na herladen opnieuw kiezen */ }
  }

  const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ' timeout')), ms))]);

  // Apparaat kiezen (moet vanuit een klik); daarna blijven we het zelf opnieuw verbinden
  async function pick(kind) {
    if (VBT.bleMock && VBT.bleMock.enabled) { attach(links[kind], VBT.bleMock.device(kind)); return; }
    if (!navigator.bluetooth) throw new Error('Web Bluetooth is not available - use Chrome or Edge');
    const opts = kind === 'trainer'
      ? { filters: [{ services: [SVC.FTMS] }, { services: [SVC.CPS] }, { namePrefix: 'KICKR' }], optionalServices: [SVC.FTMS, SVC.CPS] }
      : { filters: [{ services: [SVC.HR] }], optionalServices: [SVC.HR] };
    const device = await navigator.bluetooth.requestDevice(opts);
    attach(links[kind], device);
  }

  function attach(l, device) {
    if (l.device && l.device !== device) disconnect(l.kind);
    l.device = device;
    l.name = device.name || (l.kind === 'trainer' ? 'Trainer' : 'Heart rate');
    l.wanted = true;
    l.retries = 0;
    if (!device._vbtListener) {
      device._vbtListener = true;
      device.addEventListener('gattserverdisconnected', () => onDisconnect(l));
    }
    remember(l.kind, device.id);
    note(l.kind + ': selected ' + l.name);
    connect(l);
  }

  async function connect(l) {
    if (!l.wanted || !l.device) return;
    l.status = l.retries ? 'reconnecting' : 'connecting';
    emit();
    try {
      const server = await withTimeout(l.device.gatt.connect(), 12000, 'connect');
      if (l.kind === 'trainer') await setupTrainer(l, server); else await setupHr(l, server);
      l.status = 'connected';
      note(l.kind + ': connected (' + l.protocol + ')' + (l.retries ? ' after ' + l.retries + ' retries' : ''));
      l.retries = 0;
      if (l.kind === 'trainer' && l.lastCmd) await write(l, l.lastCmd.bytes, l.lastCmd.label + ' (restored)');
    } catch (e) {
      note(l.kind + ': connect failed - ' + e.message);
      scheduleRetry(l);
    }
    emit();
  }

  function onDisconnect(l) {
    l.control = false;
    l.controlChar = null;
    if (!l.wanted) { l.status = 'idle'; emit(); return; }
    note(l.kind + ': connection lost');
    scheduleRetry(l);
  }

  function scheduleRetry(l) {
    clearTimeout(l.timer);
    if (!l.wanted) { l.status = 'idle'; emit(); return; }
    l.retries++;
    const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(l.retries - 1, 5)));
    l.status = 'reconnecting';
    note(l.kind + ': retry ' + l.retries + ' in ' + delay / 1000 + ' s');
    l.timer = setTimeout(() => connect(l), delay);
    emit();
  }

  async function setupTrainer(l, server) {
    let ftms = null;
    try { ftms = await server.getPrimaryService(SVC.FTMS); } catch (e) { /* geen FTMS: Cycling Power proberen */ }
    if (ftms) {
      const bike = await ftms.getCharacteristic(CHR.BIKE);
      bike.addEventListener('characteristicvaluechanged', e => onBike(e.target.value));
      await bike.startNotifications();
      l.protocol = 'FTMS';
      try {
        const cp = await ftms.getCharacteristic(CHR.CONTROL);
        cp.addEventListener('characteristicvaluechanged', e => onControl(l, e.target.value));
        await cp.startNotifications();
        l.controlChar = cp;
        await write(l, P.requestControl(), 'request control');
        await write(l, P.start(), 'start');
      } catch (e) {
        note('trainer: no control point - ' + e.message);
      }
      return;
    }
    const cps = await server.getPrimaryService(SVC.CPS);
    const m = await cps.getCharacteristic(CHR.CPM);
    m.addEventListener('characteristicvaluechanged', e => onCps(l, e.target.value));
    await m.startNotifications();
    l.protocol = 'Cycling Power (no ERG)';
  }

  async function setupHr(l, server) {
    const svc = await server.getPrimaryService(SVC.HR);
    const m = await svc.getCharacteristic(CHR.HRM);
    m.addEventListener('characteristicvaluechanged', e => { live.hr = P.heartRate(e.target.value).hr; live.tHr = now(); });
    await m.startNotifications();
    l.protocol = 'Heart Rate';
  }

  async function write(l, bytes, label) {
    if (!l.controlChar) return false;
    try {
      const c = l.controlChar;
      await withTimeout(c.writeValueWithResponse ? c.writeValueWithResponse(bytes) : c.writeValue(bytes), 4000, label);
      note('trainer: -> ' + label);
      return true;
    } catch (e) {
      note('trainer: x ' + label + ' - ' + e.message);
      return false;
    }
  }

  function onControl(l, dv) {
    const r = P.controlResponse(dv);
    if (!r) return;
    if (r.op === P.OP.REQUEST_CONTROL && r.ok) l.control = true;
    if (!r.ok) note('trainer: command 0x' + r.op.toString(16) + ' -> ' + r.result);
    emit();
  }

  function onBike(dv) {
    const d = P.indoorBikeData(dv);
    if (d.power !== undefined) { live.power = Math.max(0, d.power); live.tPower = now(); }
    if (d.cadence !== undefined) live.cadence = d.cadence;
    if (d.speed !== undefined) live.speed = d.speed;
    if (d.hr && links.hr.status !== 'connected') { live.hr = d.hr; live.tHr = now(); }
    live.packets++;
  }

  function onCps(l, dv) {
    const d = P.cyclingPower(dv);
    const cad = P.cadenceFromCrank(l.crankPrev, d);
    if (d.crankRevs !== undefined) l.crankPrev = d;
    live.power = Math.max(0, d.power);
    live.tPower = now();
    if (cad !== null) live.cadence = cad;
    live.packets++;
  }

  // ERG: vast vermogen. Alleen bij een echte wijziging versturen.
  function setErg(watts) {
    const w = Math.round(watts);
    // bij een ramp niet elke watt sturen: max. 1x per seconde, tenzij het doel echt springt (nieuw interval)
    if (w === lastTarget || (lastTarget !== null && Math.abs(w - lastTarget) < 10 && now() - lastErgAt < 1000)) return;
    lastErgAt = now();
    lastTarget = w;
    lastGrade = null;
    sendTrainer(P.targetPower(w), 'ERG ' + w + ' W');
  }

  // SIM: helling (%), afgerond op 0,5% en max. elke 2 s
  function setGrade(pct) {
    const g = Math.round(pct * 2) / 2;
    if (g === lastGrade || now() - lastGradeAt < 2000) return;
    lastGrade = g;
    lastGradeAt = now();
    lastTarget = null;
    sendTrainer(P.simulation(g), 'SIM ' + g + '%');
  }

  // weerstand los (vlakke weg), ongeacht de 2 s-drempel van setGrade
  function release() {
    lastTarget = null;
    lastGrade = 0;
    lastGradeAt = now();
    sendTrainer(P.simulation(0), 'SIM 0% (release)');
  }

  function sendTrainer(bytes, label) {
    const l = links.trainer;
    l.lastCmd = { bytes, label };
    if (l.status === 'connected') write(l, bytes, label);
  }

  function disconnect(kind) {
    const l = links[kind];
    l.wanted = false;
    clearTimeout(l.timer);
    if (l.device && l.device.gatt.connected) l.device.gatt.disconnect();
    l.status = 'idle';
    note(kind + ': disconnected by user');
    emit();
  }

  // Na herladen eerder gekozen apparaten terugvinden zonder kiezer (als de browser getDevices kent)
  async function restore() {
    if (!navigator.bluetooth || !navigator.bluetooth.getDevices) return;
    let ids = {};
    try { ids = JSON.parse(localStorage.getItem(REMEMBER) || '{}'); } catch (e) { return; }
    const devices = await navigator.bluetooth.getDevices().catch(() => []);
    for (const kind of ['trainer', 'hr']) {
      const d = devices.find(x => x.id === ids[kind]);
      if (d) { note(kind + ': found remembered ' + (d.name || d.id)); attach(links[kind], d); }
    }
  }

  const trainerActive = () => links.trainer.wanted;
  const trainerOk = () => links.trainer.status === 'connected' && now() - live.tPower < STALE_MS;
  const hrOk = () => now() - live.tHr < STALE_MS;
  const ergCapable = () => !!links.trainer.controlChar;

  return {
    live, log, links, pick, attach, disconnect, restore, setErg, setGrade, release, note,
    trainerActive, trainerOk, hrOk, ergCapable, on: fn => listeners.add(fn),
    resetTargets: () => { lastTarget = null; lastGrade = null; },
  };
})();
