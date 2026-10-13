// Gameloop, toestanden (title / countdown / ride / paused) en invoer
(function () {
  const { cfg, util } = VBT;
  const STEP = 1 / 60;
  const LANES = [-0.667, 0, 0.667];
  const params = new URLSearchParams(location.search);

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const keys = {};
  let w = 0, h = 0, t = 0;
  let started = false;   // toetsen pas na het inloggen/starten

  const game = VBT.game;
  const S = VBT.session;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.width = Math.round(innerWidth * dpr);
    h = canvas.height = Math.round(innerHeight * dpr);
    VBT.background.resize(w, h);
  }

  const gradeAtDist = game.gradeAtDist;

  function update(dt) {
    t += dt;
    const s = game.sensors;
    const playerSeg = game.segAtDist(game.player.dist) + Math.floor(game.playerZ / cfg.segmentLength);
    game.grade = VBT.track.gradeAt(playerSeg);

    if (game.state === 'paused') return;
    const attract = ['title', 'plan', 'finished'].includes(game.state);
    if (attract) VBT.physics.autopilot(s, t, game.grade);
    if (game.state === 'countdown') {
      const before = Math.ceil(game.countdown);
      game.countdown -= dt;
      const now = Math.ceil(game.countdown);
      const cd = document.getElementById('countdown');
      cd.textContent = now > 0 ? now : 'GO!';
      if (now !== before) { cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop'); }
      if (game.countdown <= 0) game.setState('ride');
      VBT.physics.updateSensors(s, dt, t, game.grade);
      VBT.peloton.update(game.pack, dt, t, gradeAtDist, false);
      return;
    }
    let ergCad;
    const erg = game.run && !game.run.wo.free;
    if (game.state === 'ride') {
      game.rideTime += dt;
      if (erg) {
        // ERG: de trainer zet het vermogen, jij regelt de cadans
        const cur = VBT.workout.current(game.run, cfg.rider.ftp);
        s.target = cur.watts;
        s.sprint = false;
        ergCad = cur.cadence || 88;
        if (keys.ArrowUp) s.cadOffset = Math.min(35, s.cadOffset + 15 * dt);
        if (keys.ArrowDown) s.cadOffset = Math.max(-35, s.cadOffset - 15 * dt);
      } else {
        if (keys.ArrowUp) s.target = Math.min(1200, s.target + 120 * dt);
        if (keys.ArrowDown) s.target = Math.max(0, s.target - 120 * dt);
        s.sprint = !!keys.ShiftLeft || !!keys.ShiftRight;
      }
      if (game.run) {
        const res = VBT.workout.update(game.run, dt, cfg.rider.ftp, s.cadence, s.watts);
        if (res && res.finished) { S.finish(true); return; }
        if (res && res.changed && erg) {
          VBT.hud.message(VBT.workoutHud.stepText(res.step), VBT.palette.yellow);
          if (res.step.c) s.cadOffset = (Math.random() - 0.5) * 24;   // nieuw interval: cadans opnieuw vinden
        }
      }
    }

    VBT.physics.updateSensors(s, dt, t, game.grade, ergCad);

    // slipstream: vlak achter de ghost in dezelfde baan
    const gapM = game.ghost.dist - game.player.dist;
    const behindGhost = gapM > 0.5 && gapM < cfg.draftDistance && Math.abs(game.ghost.x - game.playerX) < 0.3;
    const inBunch = VBT.peloton.contains(game.pack, game.player.dist, game.playerX);
    const drafting = behindGhost || inBunch;
    if (game.state === 'ride') {
      if (inBunch && !game.inBunch) VBT.hud.message('IN THE BUNCH!', VBT.palette.cyan);
      else if (behindGhost && !game.drafting) VBT.hud.message('DRAFT!', VBT.palette.cyan);
      if (!inBunch && game.inBunch && game.player.dist < game.pack.dist) VBT.hud.message('DROPPED!', VBT.palette.pink);
      if (!inBunch && game.inBunch && game.player.dist > game.pack.dist) VBT.hud.message('ATTACK!', VBT.palette.yellow);
    }
    game.drafting = drafting;
    game.inBunch = inBunch;
    document.body.classList.toggle('drafting', drafting);

    const offroad = Math.abs(game.playerX) > 1;
    const cdaFactor = inBunch ? 0.6 : behindGhost ? 1 - cfg.draftBonus : 1;
    VBT.physics.step(game.player, s.watts, game.grade + (offroad ? 0.04 : 0), dt, cdaFactor);

    if ((game.state === 'ride' || attract) && !game.run) S.updateGhost(dt, t, gapM);
    if (game.state === 'ride') { game.syncPosition(); S.record(dt); }
    if (game.state === 'ride' || attract) VBT.peloton.update(game.pack, dt, t, gradeAtDist, true, erg ? s.target : 0);

    // sturen: pijltjes, anders langzaam terug naar de rechterbaan
    const steer = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    game.steer = util.lerp(game.steer, steer, dt * 6);
    const speedPct = util.clamp(game.player.v / 16, 0, 1);
    const seg = VBT.track.segments[util.wrap(playerSeg, VBT.track.segments.length)];
    if (steer !== 0 && game.state === 'ride') {
      game.playerX += steer * dt * 1.6 * Math.max(0.3, speedPct);
      game.playerX -= dt * speedPct * seg.curve * 0.12;   // bochten duwen je naar buiten
    } else {
      // zonder stuurinput: rustig naar het midden van de dichtstbijzijnde baan (een trainer stuurt niet)
      const lane = attract ? 0.667 * Math.sign(Math.sin(t / 9)) || 0.667
        : LANES.reduce((a, b) => (Math.abs(b - game.playerX) < Math.abs(a - game.playerX) ? b : a));
      game.playerX = util.lerp(game.playerX, lane, dt * 1.5);
    }
    game.playerX = util.clamp(game.playerX, -1.5, 1.5);

    if (game.state === 'ride' && VBT.track.gradeAt(playerSeg + 60) > 0.05 && game.grade < 0.02 && Math.random() < dt * 2) {
      if (!game.climbWarned) VBT.hud.message('CLIMB!', VBT.palette.yellow);
      game.climbWarned = true;
    }
    if (game.grade > 0.04) game.climbWarned = false;

    game.phase += dt * s.cadence / 60 * Math.PI * 2;
    game.skyX += seg.curve * game.player.v * dt * 6;
  }

  function render() {
    const T = VBT.track;
    const pseg = game.syncPosition();

    // alle andere renners (peloton + ghost) als afstand vóór de camera
    const scaleP = game.cameraDepth / game.playerZ;
    const toRelZ = dist => game.playerZ + (dist - game.player.dist) * cfg.unitsPerMeter;
    const packClimb = gradeAtDist(game.pack.dist) > 0.07;
    game.riders = game.pack.bots.map(b => ({ relZ: toRelZ(b.dist), x: b.x, phase: b.phase, kit: b.kit, time: t, sprint: packClimb && b.col !== 1 }));
    if (!game.run) game.riders.push({ relZ: toRelZ(game.ghost.dist), x: game.ghost.x, phase: game.ghostPhase, kit: VBT.rider.KITS.ghost, ghost: true, alpha: 0.6, time: t });
    game.ghostAheadSeg = (game.ghost.dist - game.player.dist) * cfg.unitsPerMeter / cfg.segmentLength;
    game.packAheadSeg = (game.pack.dist - game.player.dist) * cfg.unitsPerMeter / cfg.segmentLength;

    VBT.background.render(ctx, game.skyX, t, T.altitude(game.playerY));
    VBT.road.render(ctx, w, h, game);

    const groundY = h / 2 + scaleP * cfg.cameraHeight * h / 2;
    const lean = game.steer * 0.12 + pseg.curve * 0.025;   // in de bocht naar binnen hangen
    VBT.rider.draw(ctx, w / 2, groundY, cfg.riderUnitsPerMeter * scaleP * w / 2, {
      phase: game.phase, time: t, lean, sprint: game.sensors.sprint || game.grade > 0.07,
    });
    VBT.road.renderNear(ctx, w, game);
    VBT.hud.update(game, t);
    VBT.workoutHud.update(game, t);
  }

  window.addEventListener('keydown', e => {
    if (!started || e.target.tagName === 'INPUT') return;
    keys[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      if (game.state === 'title') S.startRide(null);
      else if (game.state === 'ride') game.setState('paused');
      else if (game.state === 'paused') game.setState('ride');
      else if (game.state === 'finished') document.getElementById('btnDone').click();
    }
    if (e.code === 'KeyT' && (game.state === 'title' || game.state === 'finished')) S.toMenu('plan');
    if (e.code === 'KeyD' && game.state === 'finished') S.downloadFit();
    if (e.code === 'Escape' && game.state !== 'title') S.stop();
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('resize', resize);

  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    render();
    requestAnimationFrame(frame);
  }

  async function start() {
    VBT.buildSprites && (VBT.sprites = VBT.buildSprites());
    await VBT.calendar.init((wo, step) => S.startRide(wo, step));
    VBT.track.build();
    VBT.hud.init();
    resize();
    game.setState('title');
    S.bindUi();
    started = true;
    // testhaakjes: ?ride (vrije rit), ?wo=ftpb-w1d2 (workout), ?step=n, ?plan (kalender), ?t=sec (vooruitspoelen), ?end
    const wo = params.get('wo') && VBT.plans.ftpBuilder.weeks.flat().find(x => x.id === params.get('wo'));
    if (wo || params.has('ride')) { S.startRide(wo || null, parseInt(params.get('step'), 10) || 0); game.countdown = 0; game.setState('ride'); }
    if (params.has('plan')) S.toMenu('plan');
    const skip = parseFloat(params.get('t') || '0');
    for (let i = 0; i < skip / STEP; i++) update(STEP);
    if (params.has('end')) S.stop();   // testhaakje: rit direct afronden en opslaan
    requestAnimationFrame(frame);
  }

  // Start pas na het inloggen (HomePlatform-AuthGate roept VBT.boot aan)
  VBT.boot = () => {
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    return Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(start);
  };
})();
