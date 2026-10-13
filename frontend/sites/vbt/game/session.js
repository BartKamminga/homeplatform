// Rit-flows: starten (vrij / workout), springen, afronden, opslaan, ghost van je beste ronde, FIT-download
VBT.session = (function () {
  const { cfg, util } = VBT;
  const game = VBT.game;
  const FREE_COURSE = 'free-v1';
  const $ = id => document.getElementById(id);
  let ghostIdx = 0;

  // wo = workout uit het plan (ERG, eigen parcours), wo.free = vrije rit met timer, null = vrije rit
  // startStep: optioneel interval om mee te beginnen (aangeklikt in een grafiek)
  function startRide(wo, startStep) {
    if (VBT.recorder.active()) saveRide({});     // nooit een lopende rit overschrijven
    const course = wo && !wo.free ? VBT.workout.buildCourse(wo, cfg.rider.ftp) : undefined;
    VBT.track.build(course);
    game.run = wo ? VBT.workout.createRun(wo.free ? Object.assign({}, wo, { steps: [{ d: wo.duration, a: 65, b: 65 }] }) : wo, course) : null;
    game.resetRide();
    const courseKey = wo && !wo.free ? wo.id : FREE_COURSE;
    VBT.recorder.start({ kind: wo && !wo.free ? 'workout' : 'free', courseKey, name: wo ? wo.name : 'Free Ride', woId: wo ? wo.id : null, ftp: cfg.rider.ftp });
    game.ghostTrack = null;
    game.ghostLabel = 'PACER';
    ghostIdx = 0;
    if (courseKey === FREE_COURSE) {
      VBT.storage.bestLap(FREE_COURSE).then(best => {
        if (!best) return;
        game.ghostTrack = best;
        game.ghostLabel = 'PB';
      });
    }
    if (startStep) jumpTo(startStep);
  }

  // Naar het begin van een interval springen: tijd, positie op het parcours en het peloton verplaatsen mee
  function jumpTo(index) {
    const run = game.run;
    if (!run || run.wo.free || run.done) return;
    const dist = VBT.workout.seek(run, index);
    const delta = dist - game.player.dist;
    game.player.dist = dist;
    game.pack.dist += delta;
    game.pack.bots.forEach(b => { b.dist += delta; });
    VBT.recorder.markJump();
    if (game.state === 'ride') VBT.hud.message('JUMP · ' + VBT.workoutHud.stepText(run.wo.steps[index]), VBT.palette.cyan);
  }

  // Ghost: replay van je snelste ronde (PB), of anders een pacer op ~90% FTP
  function updateGhost(dt, t, gapBefore) {
    const tr = game.ghostTrack;
    if (tr && game.state === 'ride') {
      const S = tr.samples;
      while (ghostIdx < S.length - 2 && S[ghostIdx + 1][0] <= game.rideTime) ghostIdx++;
      const a = S[ghostIdx], b = S[Math.min(ghostIdx + 1, S.length - 1)];
      const f = b[0] > a[0] ? util.clamp((game.rideTime - a[0]) / (b[0] - a[0]), 0, 1) : 1;
      game.ghost.dist = util.lerp(a[1], b[1], f);
      game.ghost.v = a[6];
      game.ghostPhase += dt * Math.max(60, a[4]) / 60 * Math.PI * 2;
    } else {
      const gGrade = game.gradeAtDist(game.ghost.dist);
      const gWatts = cfg.rider.ftp * 0.9 + Math.sin(t / 5) * 15 + Math.max(0, gGrade) * 900;
      VBT.physics.step(game.ghost, gWatts, gGrade, dt);
      game.ghostPhase += dt * (70 + gWatts / 12) / 60 * Math.PI * 2;
    }
    game.ghost.x = 0.6 + Math.sin(t / 4) * 0.05;
    if (game.state !== 'ride') return;
    const gap = game.ghost.dist - game.player.dist;
    if (gapBefore > 0 && gap <= 0) VBT.hud.message('OVERTAKE!', VBT.palette.yellow);
    if (gapBefore <= 0 && gap > 0) VBT.hud.message(game.ghostLabel + ' PASSES', VBT.palette.pink);
  }

  // per stap tijdens het rijden: opnemen + ronde/PB-meldingen
  function record(dt) {
    const before = (VBT.recorder.current() || { samples: [] }).samples.length;
    const lap = VBT.recorder.sample(game, dt);
    const rec = VBT.recorder.current();
    if (rec && rec.samples.length !== before) VBT.safety.journal(rec);   // elke seconde (alleen de nieuwe samples)
    if (lap === null) return;
    const pb = game.ghostTrack && game.ghostTrack.lapTime;
    const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    if (!pb || lap < pb) VBT.hud.message('NEW PB! ' + fmt(lap), VBT.palette.yellow);
    else VBT.hud.message('LAP ' + fmt(lap) + ' (PB ' + fmt(pb) + ')', VBT.palette.cyan);
  }

  // Rit afronden: opslaan, kalender bijwerken, eindscherm
  function finish(completed) {
    const run = game.run;
    const extra = run && run.cadTotal > 0 ? { score: Math.round(run.cadOk / run.cadTotal * 100) } : {};
    const pbBefore = game.ghostTrack && game.ghostTrack.lapTime;
    const ride = saveRide(extra);
    if (!ride) { toMenu('title'); return; }
    game.lastRide = ride;
    const newPb = ride.lapTime && !ride.jumped && (!pbBefore || ride.lapTime < pbBefore);
    if (run && completed && run.wo.week) VBT.calendar.markDone(run.wo.id, { avgW: ride.avgW, score: ride.score || 0, km: +(ride.distance / 1000).toFixed(1) });
    const heading = newPb ? 'NEW PB!' : run && completed ? 'WORKOUT COMPLETE' : 'RIDE COMPLETE';
    const sub = run && run.wo.week ? run.wo.name.toUpperCase() + ' · WEEK ' + run.wo.week + ' DAY ' + run.wo.day : ride.name.toUpperCase();
    VBT.bleBridge.release();
    VBT.workoutHud.showFinish(ride, heading, sub);
    if (VBT.stravaUi) VBT.stravaUi.render();
    game.setState('finished');
  }

  // Rit afsluiten en bewaren: eerst lokaal in de outbox (IndexedDB), dan naar de server (met retry).
  // Elke rit wordt bewaard, hoe kort ook (ook een rit die tijdens het aftellen gestopt is).
  function saveRide(extra) {
    if (game.rideTime > 0) VBT.recorder.flush(game);
    const ride = VBT.recorder.stop(extra);
    if (!ride) return null;
    VBT.safety.enqueue(ride)
      .then(() => VBT.safety.clearJournal())
      .then(() => VBT.safety.flush())
      .then(() => VBT.safety.pending())
      .then(p => { if (p.some(r => r.clientId === ride.clientId)) VBT.toast && VBT.toast('SAVED ON THIS DEVICE - WILL SYNC WHEN ONLINE', 6000); })
      .catch(e => VBT.toast && VBT.toast('SAVE PROBLEM: ' + e.message + ' - download the .FIT as backup', 9000));
    return ride;
  }

  function toMenu(state) {
    if (VBT.recorder.active()) saveRide({});      // nooit weggooien
    VBT.bleBridge.release();
    game.autoPaused = false;
    const fromWorkout = !!game.run;
    game.run = null;
    game.ghostTrack = null;
    game.ghostLabel = 'PACER';
    if (fromWorkout) { VBT.track.build(); game.resetRide(); }
    if (state === 'plan') VBT.calendar.open();
    game.setState(state);
  }

  // Esc tijdens een rit: eerst vragen. De rit staat zolang stil (net als bij pauze).
  let beforeConfirm = null;
  function stop() {
    if (['ride', 'paused', 'countdown'].includes(game.state)) {
      beforeConfirm = game.state;
      $('confirmSub').textContent = 'Your ride is always saved - find it under MY RIDES.';
      game.setState('confirm');
    } else if (game.state === 'confirm') {
      cancelStop();
    } else {
      toMenu('title');
    }
  }
  function cancelStop() { if (game.state === 'confirm') game.setState(beforeConfirm || 'paused'); }
  function confirmStop() { if (game.state === 'confirm') finish(false); }

  function openRides() {
    toMenu('plan');
    VBT.library.show('rides');
  }

  // verbindingsscherm; sluiten brengt je terug naar waar je vandaan kwam
  function openDevices() {
    const back = game.state;
    game.setState('devices');
    VBT.devicesUi.open(() => game.setState(back === 'devices' ? 'title' : back));
  }

  function downloadFit() {
    if (game.lastRide) VBT.fit.download(game.lastRide);
  }

  function bindUi() {
    $('btnFree').onclick = () => startRide(null);
    $('btnPlan').onclick = () => toMenu('plan');
    $('btnDevices').onclick = openDevices;
    $('btnRides').onclick = openRides;
    $('btnKeepRiding').onclick = cancelStop;
    $('btnStopRide').onclick = confirmStop;
    $('planDevices').onclick = openDevices;
    $('planClose').onclick = () => toMenu('title');
    $('btnFit').onclick = downloadFit;
    $('btnDone').onclick = () => toMenu(game.lastRide && game.lastRide.kind === 'workout' ? 'plan' : 'title');
    $('btnFinishRides').onclick = openRides;
    const chart = $('wChart');
    const stepAt = e => VBT.workout.stepAtFraction(game.run.wo, e.offsetX / e.currentTarget.clientWidth);
    chart.onclick = e => { if (game.run && game.state === 'ride') jumpTo(stepAt(e)); };
    chart.onmousemove = e => {
      if (game.run && !game.run.wo.free) e.currentTarget.title = 'Jump to: ' + VBT.workoutHud.stepText(game.run.wo.steps[stepAt(e)]);
    };
  }

  return { startRide, jumpTo, updateGhost, record, finish, toMenu, stop, cancelStop, confirmStop, openRides, downloadFit, bindUi, openDevices };
})();
