// Rit-flows: starten (vrij / workout), springen, afronden, opslaan, ghost van je beste ronde, FIT-download
VBT.session = (function () {
  const { cfg, util } = VBT;
  const game = VBT.game;
  const FREE_COURSE = 'free-v1';
  let ghostIdx = 0;

  // wo = workout uit het plan (ERG, eigen parcours), wo.free = vrije rit met timer, wo.climb = climb (SIM, finish
  // op de top), null = vrije rit. startStep: optioneel interval om mee te beginnen (aangeklikt in een grafiek)
  function startRide(wo, startStep) {
    if (VBT.recorder.active()) saveRide({});     // nooit een lopende rit overschrijven
    const climb = wo && wo.climb ? wo : null;
    const course = climb ? VBT.climbs.course(climb) : wo && !wo.free ? VBT.workout.buildCourse(wo, cfg.rider.ftp) : undefined;
    VBT.track.build(course, { loop: !climb });
    game.climb = climb;
    game.run = wo && !climb ? VBT.workout.createRun(wo.free ? Object.assign({}, wo, { steps: [{ d: wo.duration, a: 65, b: 65 }] }) : wo, course) : null;
    game.resetRide();
    VBT.traffic.reset();
    const courseKey = climb ? 'climb-' + climb.slug : wo && !wo.free ? wo.courseKey || wo.id : FREE_COURSE;   // variant/geruild: eigen sleutel (1305)
    VBT.recorder.start({ kind: climb ? 'climb' : wo && !wo.free ? 'workout' : 'free', courseKey, name: wo ? wo.name : 'Free Ride',
      woId: wo && !climb ? wo.id : null, ftp: cfg.rider.ftp, lapM: climb ? VBT.climbs.summitMeters(climb) : null });
    game.ghostTrack = null;
    game.ghostLabel = 'PACER';
    ghostIdx = 0;
    if (courseKey === FREE_COURSE || climb) {
      VBT.storage.bestLap(courseKey).then(best => {
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
    VBT.store.log('jump', 'Jumped to interval ' + (index + 1) + ': ' + VBT.workoutHud.stepText(run.wo.steps[index]));
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
    if (rec && rec.samples.length !== before) {
      VBT.safety.journal(rec);     // lokaal: elke seconde (alleen de nieuwe samples)
      VBT.safety.liveSync(rec);    // server: direct en daarna elke 10 s
    }
    if (lap === null) return;
    const pb = game.ghostTrack && game.ghostTrack.lapTime;
    const fmt = s => VBT.util.mmss(s);
    VBT.store.log('lap', 'Lap ' + fmt(lap) + (pb ? ' (PB ' + fmt(pb) + ')' : ''));
    if (!pb || lap < pb) VBT.hud.message('NEW PB! ' + fmt(lap), VBT.palette.yellow);
    else VBT.hud.message((game.climb ? 'SUMMIT ' : 'LAP ') + fmt(lap) + ' (PB ' + fmt(pb) + ')', VBT.palette.cyan);
    if (game.climb) finish(true);     // climb: de rit stopt op de top
  }

  // Rit afronden: opslaan, kalender bijwerken, eindscherm
  function finish(completed) {
    const run = game.run;
    const extra = run && run.cadTotal > 0 ? { score: Math.round(run.cadOk / run.cadTotal * 100) } : {};
    const review = run ? VBT.workoutReview.build(run, VBT.recorder.current() && VBT.recorder.current().jumped) : null;
    if (review) extra.review = review;                // workout-score met uitleg (item 1307)
    const pbBefore = game.ghostTrack && game.ghostTrack.lapTime;
    const ride = saveRide(extra);
    if (!ride) { toMenu('title'); return; }
    game.lastRide = ride;
    const newPb = ride.lapTime && !ride.jumped && (!pbBefore || ride.lapTime < pbBefore);
    if (run && completed && run.wo.week) VBT.calendar.markDone(run.wo.id, { avgW: ride.avgW, score: ride.score || 0, km: +(ride.distance / 1000).toFixed(1) });
    const climbDone = game.climb && completed && ride.lapTime;
    const heading = newPb ? 'NEW PB!' : climbDone ? 'SUMMIT!' : run && completed ? 'WORKOUT COMPLETE' : 'RIDE COMPLETE';
    const sub = run && run.wo.week ? run.wo.name.toUpperCase() + ' · WEEK ' + run.wo.week + ' DAY ' + run.wo.day
      : climbDone ? ride.name.toUpperCase() + ' · ' + Math.floor(ride.lapTime / 60) + ':' + String(Math.floor(ride.lapTime % 60)).padStart(2, '0')
        : ride.name.toUpperCase();
    VBT.bleBridge.release();
    game.finishInfo = { heading, sub };      // het finish-scherm (React) leest dit + game.lastRide
    game.setState('finished');
  }

  // Rit afsluiten en bewaren: eerst lokaal in de outbox (IndexedDB), dan naar de server (met retry).
  // Elke rit wordt bewaard, hoe kort ook (ook een rit die tijdens het aftellen gestopt is).
  function saveRide(extra) {
    extra = Object.assign({ recovered: false }, extra);      // hier afgesloten = netjes afgesloten (ook na hervatten)
    if (game.rideTime > 0) VBT.recorder.flush(game);
    if (VBT.recorder.isSimulated(VBT.recorder.current())) {
      VBT.recorder.stop(extra);
      VBT.safety.clearJournal();
      VBT.store.log('save', 'Autopilot ride (no trainer data) - not saved');
      if (game.rideTime >= 3 && VBT.toast) VBT.toast('THAT WAS THE AUTOPILOT - NO TRAINER, SO NOTHING SAVED', 6000);
      return null;
    }
    const ride = VBT.recorder.stop(extra);
    if (!ride) return null;
    VBT.store.log('save', 'Ride finished: ' + ride.duration + ' s, ' + (ride.distance / 1000).toFixed(2) + ' km - saving');
    VBT.safety.enqueue(ride)
      .then(() => VBT.safety.clearJournal())
      .then(() => VBT.safety.flush())
      .then(() => VBT.safety.pending())
      .then(p => { if (p.some(r => r.clientId === ride.clientId)) VBT.toast && VBT.toast('SAVED ON THIS DEVICE - WILL SYNC WHEN ONLINE', 6000); })
      .catch(e => VBT.toast && VBT.toast('SAVE PROBLEM: ' + e.message + ' - download the .FIT as backup', 9000));
    return ride;
  }

  // naar het menu: 'title', of een sectie van het linkerpaneel ('plan', 'rides', 'workouts', 'today')
  function toMenu(state) {
    if (VBT.recorder.active()) saveRide({});      // nooit weggooien
    VBT.bleBridge.release();
    game.autoPaused = false;
    const fromWorkout = !!game.run || !!game.climb;
    game.run = null;
    game.climb = null;
    game.ghostTrack = null;
    game.ghostLabel = 'PACER';
    if (fromWorkout) { VBT.track.build(); game.resetRide(); }
    const section = state === 'title' || state === 'finished' ? null : state;
    game.setState(section ? 'title' : state);
    if (section && VBT.ui) VBT.ui.open('left', section);
  }

  // Esc tijdens een rit: eerst vragen. De rit staat zolang stil (net als bij pauze).
  let beforeConfirm = null;
  function stop() {
    if (['ride', 'paused', 'countdown'].includes(game.state)) {
      beforeConfirm = game.state;
      VBT.safety.liveSync(VBT.recorder.current(), true);     // meteen een backup op de server
      game.setState('confirm');
    } else if (game.state === 'confirm') {
      cancelStop();
    } else {
      toMenu('title');
    }
  }
  function cancelStop() { if (game.state === 'confirm') game.setState(beforeConfirm || 'paused'); }
  function confirmStop() { if (game.state === 'confirm') finish(false); }

  // Alleen een rit die niet netjes is afgesloten (live backup bleef staan, of na een crash hersteld) kan verder.
  // Een rit die met STOP & SAVE of aan het eind van de workout is afgesloten, is klaar.
  const canContinue = ride => !!(ride && ride.clientId && ride.samples && ride.samples.length && (ride.inProgress || ride.recovered));

  // Oude rit hervatten: zelfde parcours/workout, verder op de plek en tijd waar je gebleven was, in dezelfde rit
  async function resumeRide(ride) {
    const S = ride.samples || [];
    if (!canContinue(ride)) { VBT.toast && VBT.toast('THIS RIDE CANNOT BE CONTINUED'); return; }
    let wo = null;
    if (ride.courseKey.startsWith('climb-')) {
      wo = await VBT.climbs.get(ride.courseKey.slice(6)).catch(() => null);
      if (!wo) { VBT.toast && VBT.toast('CLIMB NOT FOUND - CANNOT CONTINUE', 6000); return; }
    } else if (ride.courseKey !== FREE_COURSE) {
      wo = await VBT.workoutVariants.restore(ride.courseKey);     // ook varianten en geruilde workouts (1305)
      if (!wo) { VBT.toast && VBT.toast('WORKOUT NOT FOUND - CANNOT CONTINUE', 6000); return; }
    }
    toMenu('title');
    startRide(wo);
    const rec = VBT.recorder.resume(ride);
    if (wo && wo.climb) rec.lapM = VBT.climbs.summitMeters(wo);
    const last = S[S.length - 1];
    const delta = last[1] - game.player.dist;
    game.player.dist = last[1];
    game.rideTime = last[0];
    game.pack.dist += delta;
    game.pack.bots.forEach(b => { b.dist += delta; });
    if (game.run && !game.run.wo.free) VBT.workout.seekTime(game.run, VBT.workout.timeAtDist(game.run, last[1]));
    else if (game.run) VBT.workout.seekTime(game.run, last[0]);
    VBT.safety.liveResume(rec);
    VBT.safety.dropFromOutbox(rec.clientId);
    VBT.safety.journal(rec);
    VBT.hud.message('CONTINUE · ' + Math.floor(last[0] / 60) + ':' + String(Math.floor(last[0] % 60)).padStart(2, '0'), VBT.palette.cyan);
  }

  const openRides = () => toMenu('rides');

  // apparaten en help staan in het linkerpaneel (React registreert VBT.ui)
  const openDevices = () => VBT.ui && VBT.ui.open('left', 'devices');
  const openHelp = focus => VBT.ui && VBT.ui.open('left', 'help', focus);

  // CONTINUE op het finish-scherm: na een workout naar het plan, anders naar de titel
  const finishDone = () => toMenu(game.lastRide && game.lastRide.kind === 'workout' ? 'plan' : 'title');

  function downloadFit() {
    if (game.lastRide) VBT.fit.download(game.lastRide);
  }

  return { openHelp, startRide, resumeRide, canContinue, jumpTo, updateGhost, record, finish, toMenu, stop, cancelStop, confirmStop, openRides, downloadFit, finishDone, openDevices };
})();
