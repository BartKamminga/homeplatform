// Bluetooth-protocollen (pure functies, los te testen): FTMS Indoor Bike Data, Cycling Power, Heart Rate,
// en de FTMS Control Point-commando's. DataView in, plain object uit. Alle waarden little-endian.
VBT.bleParse = (function () {
  // FTMS 0x2AD2 Indoor Bike Data. Let op: bit 0 = "More Data"; als die 0 is, staat de snelheid erin.
  function indoorBikeData(dv) {
    const flags = dv.getUint16(0, true);
    let o = 2;
    const out = {};
    if (!(flags & 0x0001)) { out.speed = dv.getUint16(o, true) / 100; o += 2; }      // km/u
    if (flags & 0x0002) o += 2;                                                       // gemiddelde snelheid
    if (flags & 0x0004) { out.cadence = dv.getUint16(o, true) / 2; o += 2; }         // rpm
    if (flags & 0x0008) o += 2;                                                       // gemiddelde cadans
    if (flags & 0x0010) { out.distance = dv.getUint16(o, true) | (dv.getUint8(o + 2) << 16); o += 3; }
    if (flags & 0x0020) { out.resistance = dv.getInt16(o, true); o += 2; }
    if (flags & 0x0040) { out.power = dv.getInt16(o, true); o += 2; }                // watt
    if (flags & 0x0080) o += 2;                                                       // gemiddeld vermogen
    if (flags & 0x0100) o += 5;                                                       // energie
    if (flags & 0x0200) { out.hr = dv.getUint8(o); o += 1; }
    return out;
  }

  // CPS 0x2A63 Cycling Power Measurement: vermogen + (optioneel) crankomwentelingen voor de cadans
  function cyclingPower(dv) {
    const flags = dv.getUint16(0, true);
    let o = 4;
    const out = { power: dv.getInt16(2, true) };
    if (flags & 0x0001) o += 1;          // pedaalbalans
    if (flags & 0x0004) o += 2;          // geaccumuleerd koppel
    if (flags & 0x0010) o += 6;          // wielomwentelingen
    if (flags & 0x0020) { out.crankRevs = dv.getUint16(o, true); out.crankTime = dv.getUint16(o + 2, true); }
    return out;
  }

  // Cadans uit twee opeenvolgende crankmetingen (tijd in 1/1024 s, beide tellers lopen rond op 65536)
  function cadenceFromCrank(prev, cur) {
    if (!prev || cur.crankRevs === undefined) return null;
    const revs = (cur.crankRevs - prev.crankRevs + 65536) % 65536;
    const ticks = (cur.crankTime - prev.crankTime + 65536) % 65536;
    if (!ticks) return revs ? null : 0;
    return Math.round(revs / (ticks / 1024) * 60);
  }

  // 0x2A37 Heart Rate Measurement
  function heartRate(dv) {
    const flags = dv.getUint8(0);
    return { hr: flags & 0x01 ? dv.getUint16(1, true) : dv.getUint8(1) };
  }

  // FTMS 0x2AD9 Control Point
  const OP = { REQUEST_CONTROL: 0x00, RESET: 0x01, SET_TARGET_POWER: 0x05, START: 0x07, SET_SIMULATION: 0x11, RESPONSE: 0x80 };

  function cmd(bytes) { return new Uint8Array(bytes); }
  const requestControl = () => cmd([OP.REQUEST_CONTROL]);
  const start = () => cmd([OP.START]);
  function targetPower(watts) {
    const w = Math.max(0, Math.min(2000, Math.round(watts)));
    return cmd([OP.SET_TARGET_POWER, w & 0xFF, (w >> 8) & 0xFF]);
  }
  // helling in % (bv. 6.5); wind 0, rolweerstand 0.004, windweerstandscoëfficiënt 0.51 kg/m
  function simulation(gradePct, crr = 0.004, cw = 0.51) {
    const g = Math.max(-40, Math.min(40, gradePct));
    const grade = Math.round(g * 100) & 0xFFFF;
    return cmd([OP.SET_SIMULATION, 0, 0, grade & 0xFF, (grade >> 8) & 0xFF, Math.round(crr * 10000), Math.round(cw * 100)]);
  }

  // Antwoord op een commando: [0x80, opcode, resultaat] (1 = gelukt)
  function controlResponse(dv) {
    if (dv.byteLength < 3 || dv.getUint8(0) !== OP.RESPONSE) return null;
    const RESULTS = { 1: 'ok', 2: 'not supported', 3: 'invalid parameter', 4: 'failed', 5: 'control not permitted' };
    return { op: dv.getUint8(1), result: RESULTS[dv.getUint8(2)] || 'unknown', ok: dv.getUint8(2) === 1 };
  }

  return { indoorBikeData, cyclingPower, cadenceFromCrank, heartRate, requestControl, start, targetPower, simulation, controlResponse, OP };
})();
