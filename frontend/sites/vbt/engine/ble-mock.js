// Nep-Kickr en nep-hartslagband met dezelfde API als Web Bluetooth (alleen met ?mockble).
// Testhaakjes: ?mockdrop=30:15 -> na 30 s rijden 15 s verbinding kwijt; ?mockstall=60:8 -> 8 s geen data maar wel verbonden.
VBT.bleMock = (function () {
  const params = new URLSearchParams(window.location.search);
  const enabled = params.has('mockble');
  const SVC = { FTMS: 0x1826, HR: 0x180d };
  const CHR = { BIKE: 0x2ad2, CONTROL: 0x2ad9, HRM: 0x2a37 };

  function makeChar(onWrite) {
    const handlers = [];
    return {
      handlers,
      addEventListener: (type, fn) => handlers.push(fn),
      startNotifications: async () => {},
      writeValueWithResponse: async bytes => onWrite && onWrite(bytes),
      fire(dv) { handlers.forEach(fn => fn({ target: { value: dv } })); },
    };
  }

  function makeDevice(kind) {
    const state = { connected: false, downUntil: 0, stallUntil: 0, target: 120, power: 0 };
    const listeners = [];
    let timer = null;
    const control = makeChar(bytes => {
      const op = bytes[0];
      if (op === 0x05) state.target = bytes[1] | (bytes[2] << 8);
      setTimeout(() => control.fire(new DataView(new Uint8Array([0x80, op, 1]).buffer)), 30);
    });
    const bike = makeChar();
    const hrm = makeChar();

    function tick() {
      if (!state.connected || performance.now() < state.stallUntil) return;
      if (kind === 'trainer') {
        state.power += (state.target - state.power) * 0.35;      // ERG regelt naar het doel
        const p = Math.round(state.power + (Math.random() - 0.5) * 8);
        const cad = 88 + Math.round((Math.random() - 0.5) * 4);
        const b = new DataView(new ArrayBuffer(8));
        b.setUint16(0, 0x0044, true);              // snelheid + cadans + vermogen
        b.setUint16(2, 3150, true);                // 31,5 km/u
        b.setUint16(4, cad * 2, true);
        b.setInt16(6, p, true);
        bike.fire(b);
      } else {
        hrm.fire(new DataView(new Uint8Array([0, 128 + Math.round(state.power / 20)]).buffer));
      }
    }

    const device = {
      id: 'mock-' + kind,
      name: kind === 'trainer' ? 'KICKR CORE (mock)' : 'TICKR (mock)',
      addEventListener: (type, fn) => listeners.push(fn),
      gatt: {
        get connected() { return state.connected; },
        connect: async () => {
          await new Promise(r => setTimeout(r, 300));
          if (performance.now() < state.downUntil) throw new Error('device out of range (mock)');
          state.connected = true;
          clearInterval(timer);
          timer = setInterval(tick, 250);
          return {
            getPrimaryService: async uuid => {
              if (kind === 'trainer' && uuid === SVC.FTMS) return { getCharacteristic: async c => (c === CHR.BIKE ? bike : control) };
              if (kind === 'hr' && uuid === SVC.HR) return { getCharacteristic: async () => hrm };
              throw new Error('service not found');
            },
          };
        },
        disconnect: () => { state.connected = false; clearInterval(timer); },
      },
      // verbinding een tijd kwijt (buiten bereik / Bluetooth uit)
      drop(ms) {
        state.connected = false;
        clearInterval(timer);
        state.downUntil = performance.now() + ms;
        listeners.forEach(fn => fn());
      },
      stall(ms) { state.stallUntil = performance.now() + ms; },
    };
    return device;
  }

  const devices = enabled ? { trainer: makeDevice('trainer'), hr: makeDevice('hr') } : {};

  // drop/stall plannen op rijtijd (pauzes tellen niet mee)
  function schedule(game) {
    const plan = (key, fn) => {
      const v = params.get(key);
      if (!v) return;
      const [at, dur] = v.split(':').map(Number);
      const check = setInterval(() => {
        if (game.rideTime >= at) { clearInterval(check); fn(dur * 1000); VBT.ble.note('mock: ' + key + ' ' + dur + ' s'); }
      }, 200);
    };
    plan('mockdrop', ms => devices.trainer.drop(ms));
    plan('mockstall', ms => devices.trainer.stall(ms));
  }

  return { enabled, device: kind => devices[kind], schedule };
})();
