// HUD-model (geen DOM): wat de HUD-panelen tonen, als klein object voor het snapshot (store.js); React tekent.
// Plus pop-up-meldingen (DRAFT!, TRAINER BACK!, ...) en het hoogteprofiel als teken-functie.
VBT.hud = (function () {
  const { cfg, util } = VBT;
  const hrHist = [];
  let msgSeq = 0;

  function message(text, color) {
    if (!VBT.settings.show('messages')) return;
    VBT.game.message = { seq: ++msgSeq, text, color: color || '' };
  }

  // elk frame: 30 s hartslaggemiddelde bijhouden (~60 updates/s)
  function update(game) {
    hrHist.push(game.sensors.hr);
    if (hrHist.length > 1800) hrHist.shift();
  }

  function model(game) {
    const s = game.sensors, ble = VBT.ble, safety = VBT.safety;
    const zone = util.zoneFor(s.watts), hz = util.hrZoneFor(s.hr);
    const hrMax = VBT.settings.values.hrMax || 185;
    const kmh = game.player.v * 3.6;
    const gapM = game.ghost.dist - game.player.dist, packGap = game.pack.dist - game.player.dist;
    const st = safety.liveStatus(), age = safety.liveAge(), lag = safety.liveLag();
    const T = VBT.track;
    return {
      watts: Math.round(s.watts), zone: zone.name, zoneColor: zone.color,
      powerFrac: util.clamp(s.watts / (cfg.rider.ftp * 1.6), 0, 1),
      avg3s: s.avg3s.length ? Math.round(s.avg3s.reduce((a, b) => a + b, 0) / s.avg3s.length) : 0,
      ftp: cfg.rider.ftp,
      hr: Math.round(s.hr), hrZone: hz.name, hrColor: hz.color, hrLabel: hz.label.toUpperCase(), hrMax,
      hrFrac: util.clamp((s.hr / hrMax - 0.5) / 0.5, 0, 1),
      hrAvg: hrHist.length ? Math.round(hrHist.reduce((a, b) => a + b, 0) / hrHist.length) : 0,
      kmh, speedLeds: Math.round(util.clamp(kmh / 60, 0, 1) * 24), cadence: Math.round(s.cadence),
      time: util.formatTime(game.rideTime), km: (game.player.dist / 1000).toFixed(2),
      lap: Math.floor(game.player.dist / T.lapMeters()) + 1,
      grade: game.grade * 100,
      alt: T.segments.length ? Math.round(T.altitude(game.playerY - T.heightRange()[0])) : 0,
      ghostLabel: game.ghostLabel, gapM, gapS: Math.abs(gapM) / Math.max(game.player.v, 3),
      inBunch: !!game.inBunch, packGap, bunchSaved: s.watts * 0.6 | 0,
      chips: {
        trainer: ble.trainerActive() ? (ble.trainerOk() ? 'ok' : ble.links.trainer.status === 'connected' ? 'stale' : 'lost') : null,
        hr: ble.links.hr.wanted ? (ble.hrOk() ? 'ok' : 'lost') : null,
        backup: st === 'off' ? null : st === 'ok' ? 'ok' : st === 'behind' ? 'stale' : 'lost',
        backupTitle: st === 'failing' ? 'Server backup failing - saved locally, retrying'
          : age === null ? 'Waiting for first server backup' : 'Server backup ' + Math.round(age) + ' s ago',
      },
      backup: st === 'off' ? null : {
        text: st === 'failing' ? 'OFFLINE · ' + lag + ' S LOCAL ONLY' : lag <= 15 && st === 'ok' ? 'UP TO DATE' : '+' + lag + ' S BEHIND',
        cls: st === 'failing' ? 'behind' : lag <= 15 && st === 'ok' ? 'ahead' : 'lag',
      },
    };
  }

  // hoogteprofiel ~1,7 km vooruit met ghost (blauw), peloton (roze) en jij (geel)
  function drawProfile(pctx, W, H, game) {
    const T = VBT.track, segs = T.segments, N = segs.length;
    if (!N) return;
    const [minY, maxY] = T.heightRange();
    const base = Math.floor(game.position / cfg.segmentLength) + Math.floor(game.playerZ / cfg.segmentLength);
    const behind = 200, ahead = 3400, step = 12;
    const yOf = v => H - 10 - ((v - minY) / (maxY - minY || 1)) * (H - 26);
    pctx.beginPath();
    pctx.moveTo(0, H);
    for (let i = -behind; i <= ahead; i += step) {
      const s = segs[util.wrap(base + i, N)];
      pctx.lineTo((i + behind) / (ahead + behind) * W, yOf(s.p1.world.y));
    }
    pctx.lineTo(W, H);
    const g = pctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,46,136,0.55)');
    g.addColorStop(1, 'rgba(36,232,255,0.05)');
    pctx.fillStyle = g;
    pctx.fill();
    pctx.strokeStyle = '#24e8ff';
    pctx.lineWidth = 2;
    pctx.stroke();

    const px = behind / (ahead + behind) * W;
    const py = yOf(segs[util.wrap(base, N)].p1.world.y);
    if (game.ghostAheadSeg > -behind && game.ghostAheadSeg < ahead) {
      const gx = (game.ghostAheadSeg + behind) / (ahead + behind) * W;
      const gy = yOf(segs[util.wrap(base + Math.round(game.ghostAheadSeg), N)].p1.world.y);
      pctx.fillStyle = 'rgba(36,232,255,0.9)';
      pctx.beginPath();
      pctx.arc(gx, gy, 4, 0, Math.PI * 2);
      pctx.fill();
    }
    const packSeg = game.packAheadSeg;
    if (packSeg > -behind && packSeg < ahead) {
      pctx.fillStyle = '#ff2e88';
      for (let i = 0; i < 4; i++) {
        const sx = (packSeg - i * 9 + behind) / (ahead + behind) * W;
        const sg = segs[util.wrap(base + Math.round(packSeg - i * 9), N)];
        pctx.fillRect(sx - 1.5, yOf(sg.p1.world.y) - 3, 3, 3);
      }
    }
    pctx.fillStyle = '#ffe66d';
    pctx.shadowColor = '#ffe66d';
    pctx.shadowBlur = 10;
    pctx.beginPath();
    pctx.arc(px, py, 5, 0, Math.PI * 2);
    pctx.fill();
    pctx.shadowBlur = 0;
  }

  return { update, model, message, drawProfile };
})();
