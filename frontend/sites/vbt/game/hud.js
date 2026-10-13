// HUD: DOM-overlay met vermogen, snelheid, hoogteprofiel en ghost-verschil
VBT.hud = (function () {
  const { cfg, util } = VBT;
  const $ = id => document.getElementById(id);
  let el = {};
  let profile, pctx;
  let lastText = 0;
  const hrHist = [];

  function init() {
    ['watts', 'zoneName', 'zoneNeedle', 'speed', 'speedBar', 'cadence', 'hr', 'heart', 'time', 'dist', 'lap',
      'hrBig', 'hrZoneName', 'hrNeedle', 'hrAvg', 'hrZoneLabel', 'hrMaxLabel', 'gap', 'gapLabel', 'bunch', 'bunchLabel', 'alt', 'grade', 'message', 'avg'].forEach(id => { el[id] = $(id); });
    const zoneBar = $('zoneBar');
    VBT.zones.forEach(z => {
      const d = document.createElement('div');
      d.style.background = z.color;
      zoneBar.appendChild(d);
    });
    for (let i = 0; i < 24; i++) el.speedBar.appendChild(document.createElement('i'));
    const hrBar = $('hrZoneBar');
    VBT.hrZones.forEach(z => {
      const d = document.createElement('div');
      d.style.background = z.color;
      hrBar.appendChild(d);
    });
    profile = $('profile');
    pctx = profile.getContext('2d');
  }

  function message(text, color) {
    el.message.textContent = text;
    el.message.style.color = color || '';
    el.message.classList.remove('pop');
    void el.message.offsetWidth;
    el.message.classList.add('pop');
  }

  function drawProfile(game) {
    const W = profile.width, H = profile.height;
    const T = VBT.track, segs = T.segments, N = segs.length;
    const [minY, maxY] = T.heightRange();
    const base = Math.floor(game.position / cfg.segmentLength) + Math.floor(game.playerZ / cfg.segmentLength);
    const behind = 200, ahead = 3400, step = 12;   // ~1,7 km vooruit
    const yOf = v => H - 10 - ((v - minY) / (maxY - minY || 1)) * (H - 26);
    pctx.clearRect(0, 0, W, H);
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

  function update(game, t) {
    const s = game.sensors;
    const zone = util.zoneFor(s.watts);
    const frac = util.clamp(s.watts / (cfg.rider.ftp * 1.6), 0, 1);
    el.zoneNeedle.style.left = (frac * 100) + '%';
    el.watts.style.color = zone.color;
    el.watts.style.textShadow = '0 0 18px ' + zone.color;

    const kmh = game.player.v * 3.6;
    const lit = Math.round(util.clamp(kmh / 60, 0, 1) * 24);
    [...el.speedBar.children].forEach((c, i) => c.classList.toggle('on', i < lit));
    el.heart.style.animationDuration = (60 / Math.max(40, s.hr)) + 's';
    // hartslag in zonekleur; de balk loopt van 50% tot 100% van de max-hartslag (5 gelijke zones)
    const hrMax = VBT.settings.values.hrMax || 185;
    const hz = VBT.util.hrZoneFor(s.hr);
    el.hrNeedle.style.left = (VBT.util.clamp((s.hr / hrMax - 0.5) / 0.5, 0, 1) * 100) + '%';
    el.hrBig.style.color = hz.color;
    el.hrBig.style.textShadow = '0 0 18px ' + hz.color;
    hrHist.push(s.hr);
    if (hrHist.length > 1800) hrHist.shift();     // ~30 s bij 60 updates/s

    if (t - lastText > 0.1) {
      lastText = t;
      el.watts.textContent = Math.round(s.watts);
      el.zoneName.textContent = zone.name;
      const avg = s.avg3s.length ? s.avg3s.reduce((a, b) => a + b, 0) / s.avg3s.length : 0;
      el.avg.textContent = Math.round(avg);
      el.speed.textContent = kmh.toFixed(1);
      el.cadence.textContent = Math.round(s.cadence);
      el.hr.textContent = Math.round(s.hr);
      el.hrBig.textContent = Math.round(s.hr);
      el.hrZoneName.textContent = hz.name;
      el.hrZoneName.style.background = hz.color;
      el.hrZoneLabel.textContent = hz.label.toUpperCase();
      el.hrMaxLabel.textContent = hrMax;
      el.hrAvg.textContent = hrHist.length ? Math.round(hrHist.reduce((a, b) => a + b, 0) / hrHist.length) : 0;
      el.time.textContent = util.formatTime(game.rideTime);
      el.dist.textContent = (game.player.dist / 1000).toFixed(2);
      el.lap.textContent = 'LAP ' + (Math.floor(game.player.dist / VBT.track.lapMeters()) + 1);
      const grade = game.grade * 100;
      el.grade.textContent = (grade >= 0 ? '+' : '') + grade.toFixed(1) + '%';
      el.alt.textContent = 'ALT ' + Math.round(VBT.track.altitude(game.playerY - VBT.track.heightRange()[0])) + ' M';   // boven het dal
      el.grade.className = grade > 4 ? 'steep' : grade < -2 ? 'down' : '';

      const gapM = game.ghost.dist - game.player.dist;
      const gapS = Math.abs(gapM) / Math.max(game.player.v, 3);
      el.gap.textContent = (gapM > 0 ? '-' : '+') + gapS.toFixed(1) + 's';
      el.gap.className = 'mid ' + (gapM > 0 ? 'behind' : 'ahead');
      el.gapLabel.textContent = gapM > 0 ? game.ghostLabel + ' +' + Math.round(gapM) + ' M' : 'YOU LEAD ' + game.ghostLabel + ' +' + Math.round(-gapM) + ' M';
      const packGap = game.pack.dist - game.player.dist;
      el.bunchLabel.textContent = game.inBunch ? 'IN THE BUNCH' : packGap > 0 ? 'BUNCH AHEAD' : 'BUNCH BEHIND';
      el.bunch.textContent = game.inBunch ? (s.watts * 0.6 | 0) + ' W SAVED' : Math.round(Math.abs(packGap)) + ' M';
      el.bunch.className = 'mid ' + (game.inBunch || packGap <= 0 ? 'ahead' : 'behind');
      drawProfile(game);
      chips();
    }
  }

  // statuslampjes in de HUD
  function chips() {
    const ble = VBT.ble;
    const t = $('chipTrainer'), h = $('chipHr');
    if (!t) return;
    t.hidden = !ble.trainerActive();
    t.dataset.status = ble.trainerOk() ? 'ok' : ble.links.trainer.status === 'connected' ? 'stale' : 'lost';
    h.hidden = !ble.links.hr.wanted;
    h.dataset.status = ble.hrOk() ? 'ok' : 'lost';
    const c = $('chipBackup'), st = VBT.safety.liveStatus(), age = VBT.safety.liveAge();
    c.hidden = st === 'off';
    c.dataset.status = st === 'ok' ? 'ok' : st === 'behind' ? 'stale' : 'lost';
    c.title = st === 'failing' ? 'Server backup failing - saved locally, retrying' : age === null ? 'Waiting for first server backup' : 'Server backup ' + Math.round(age) + ' s ago';
    // regel in het rechter HUD-paneel: hoeveel seconden rijden staan nog niet op de server
    const lag = VBT.safety.liveLag(), b = $('backup');
    $('backupLabel').hidden = b.hidden = st === 'off';
    b.textContent = st === 'failing' ? 'OFFLINE · ' + lag + ' S LOCAL ONLY' : lag <= 10 && st === 'ok' ? 'UP TO DATE' : '+' + lag + ' S BEHIND';
    b.className = 'mid ' + (st === 'failing' ? 'behind' : lag <= 10 && st === 'ok' ? 'ahead' : 'lag');
  }

  return { init, update, message, chips };
})();
