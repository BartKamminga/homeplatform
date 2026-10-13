// Minimale FIT-encoder (Garmin FIT-protocol) voor een virtuele fietsrit: file_id, events, records, lap,
// session en activity. Strava herkent sub_sport virtual_activity als "Virtual Ride".
VBT.fit = (function () {
  const FIT_EPOCH = 631065600;          // 1989-12-31T00:00:00Z in unix-seconden
  const CRC_TABLE = [0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
    0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400];
  const TYPES = { enum: [0x00, 1], uint8: [0x02, 1], uint16: [0x84, 2], uint32: [0x86, 4], uint32z: [0x8C, 4] };
  const MSG = { fileId: 0, session: 18, lap: 19, record: 20, event: 21, activity: 34 };
  const SPORT_CYCLING = 2, SUB_VIRTUAL = 58;

  function crc16(bytes, crc = 0) {
    for (const b of bytes) {
      let tmp = CRC_TABLE[crc & 0xF];
      crc = (crc >> 4) & 0x0FFF;
      crc = crc ^ tmp ^ CRC_TABLE[b & 0xF];
      tmp = CRC_TABLE[crc & 0xF];
      crc = (crc >> 4) & 0x0FFF;
      crc = crc ^ tmp ^ CRC_TABLE[(b >> 4) & 0xF];
    }
    return crc;
  }

  function encoder() {
    const bytes = [], locals = {};
    let next = 0;
    const u8 = v => bytes.push(v & 0xFF);
    const u16 = v => { u8(v); u8(v >> 8); };
    const u32 = v => { u16(v & 0xFFFF); u16((v >>> 16) & 0xFFFF); };

    // fields: [[veldnummer, type, waarde], ...]; definitiebericht alleen de eerste keer per vorm
    function message(global, fields) {
      const key = global + ':' + fields.map(f => f[0]).join(',');
      let local = locals[key];
      if (local === undefined) {
        local = locals[key] = next++;
        u8(0x40 | local); u8(0); u8(0); u16(global); u8(fields.length);
        for (const [num, type] of fields) { u8(num); u8(TYPES[type][1]); u8(TYPES[type][0]); }
      }
      u8(local);
      for (const [, type, value] of fields) {
        const size = TYPES[type][1], v = Math.max(0, Math.round(value));
        if (size === 1) u8(v); else if (size === 2) u16(v); else u32(v);
      }
    }
    return { message, bytes };
  }

  function encode(ride) {
    const S = ride.samples;
    const start = Math.round(Date.parse(ride.startedAt) / 1000) - FIT_EPOCH;
    const end = start + S.length;
    const ms = S.length * 1000;
    const dist = ride.distance * 100;
    const avgSpeed = S.length ? ride.distance / S.length * 1000 : 0;
    const maxSpeed = S.reduce((a, s) => Math.max(a, s[6]), 0) * 1000;
    const e = encoder();

    e.message(MSG.fileId, [[0, 'enum', 4], [1, 'uint16', 255], [2, 'uint16', 0], [3, 'uint32z', 12345], [4, 'uint32', start]]);
    e.message(MSG.event, [[253, 'uint32', start], [0, 'enum', 0], [1, 'enum', 0]]);                      // timer start
    S.forEach((s, i) => e.message(MSG.record, [
      [253, 'uint32', start + i + 1], [5, 'uint32', s[2] * 100], [6, 'uint16', s[6] * 1000],
      [7, 'uint16', s[3]], [4, 'uint8', Math.min(254, s[4])], [3, 'uint8', Math.min(254, s[5])],
      [2, 'uint16', (s[7] + 500) * 5],
    ]));
    e.message(MSG.event, [[253, 'uint32', end], [0, 'enum', 0], [1, 'enum', 4]]);                         // timer stop_all
    const totals = [[7, 'uint32', ms], [8, 'uint32', ms], [9, 'uint32', dist]];
    e.message(MSG.lap, [[253, 'uint32', end], [0, 'enum', 9], [1, 'enum', 1], [2, 'uint32', start], ...totals,
      [15, 'uint8', ride.avgHr], [17, 'uint8', ride.avgCad], [19, 'uint16', ride.avgW], [20, 'uint16', ride.maxW],
      [25, 'enum', SPORT_CYCLING], [39, 'enum', SUB_VIRTUAL]]);
    e.message(MSG.session, [[253, 'uint32', end], [0, 'enum', 8], [1, 'enum', 1], [2, 'uint32', start],
      [5, 'enum', SPORT_CYCLING], [6, 'enum', SUB_VIRTUAL], ...totals, [14, 'uint16', avgSpeed], [15, 'uint16', maxSpeed],
      [16, 'uint8', ride.avgHr], [18, 'uint8', ride.avgCad], [20, 'uint16', ride.avgW], [21, 'uint16', ride.maxW],
      [25, 'uint16', 0], [26, 'uint16', 1]]);
    const localTs = end - new Date(ride.startedAt).getTimezoneOffset() * 60;
    e.message(MSG.activity, [[253, 'uint32', end], [0, 'uint32', ms], [1, 'uint16', 1], [2, 'enum', 0],
      [3, 'enum', 26], [4, 'enum', 1], [5, 'uint32', localTs]]);

    const data = e.bytes;
    const header = [14, 0x10, 2100 & 0xFF, 2100 >> 8,
      data.length & 0xFF, (data.length >> 8) & 0xFF, (data.length >> 16) & 0xFF, (data.length >>> 24) & 0xFF,
      0x2E, 0x46, 0x49, 0x54];
    const hcrc = crc16(header);
    header.push(hcrc & 0xFF, hcrc >> 8);
    const all = header.concat(data);
    const crc = crc16(all);
    all.push(crc & 0xFF, crc >> 8);
    return new Uint8Array(all);
  }

  function fileName(ride) {
    const d = new Date(ride.startedAt);
    const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
      '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
    return 'VBT-' + stamp + '-' + (ride.name || 'ride').replace(/[^A-Za-z0-9]+/g, '-') + '.fit';
  }

  function download(ride) {
    const blob = new Blob([encode(ride)], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName(ride);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  return { encode, download, fileName };
})();
