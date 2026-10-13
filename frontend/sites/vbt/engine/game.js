// Gedeelde spelstatus en toestandswissel (title / countdown / ride / paused / confirm / finished).
// Geen DOM: React zet body[data-state] en de body-klassen vanuit het snapshot (ui/hooks/useBodyState.js).
VBT.game = (function () {
  const { cfg } = VBT;
  const game = {
    state: 'title',
    position: 0, playerX: 0.667, playerY: 0, playerZ: 0, steer: 0,
    cameraDepth: 1 / Math.tan((cfg.fieldOfView / 2) * Math.PI / 180),
    player: { v: 0, dist: 0 }, ghost: { v: 0, dist: 0, x: 0.6 },
    pack: VBT.peloton.create(cfg.pelotonSize), riders: [], inBunch: false,
    sensors: VBT.physics.createSensors(),
    grade: 0, rideTime: 0, skyX: 0, phase: 0, ghostPhase: 0, countdown: 0,
    drafting: false, ghostAheadSeg: 0, packAheadSeg: 0,
    run: null, ghostTrack: null, ghostLabel: 'PACER', lastRide: null,
    // voor de React-overlays: pauzetekst, ploegleider, pop-up-melding (seq = nieuwe melding)
    pauseText: { title: 'PAUSED', sub: '' }, coachMsg: null, message: null,
  };
  game.playerZ = cfg.cameraHeight * game.cameraDepth * cfg.playerDepth;

  game.setState = s => { game.state = s; };

  game.resetRide = () => {
    game.player = { v: 0, dist: 0 };
    game.ghost = { v: 0, dist: 0, x: 0.6 };
    game.pack = VBT.peloton.create(cfg.pelotonSize);
    game.rideTime = 0;
    game.playerX = 0.667;
    game.sensors = VBT.physics.createSensors();
    game.countdown = 3.999;
    game.autoPaused = false;
    game.setState('countdown');
  };

  const segAtDist = dist => Math.floor(dist * cfg.unitsPerMeter / cfg.segmentLength);
  // helling onder een renner op afstand `dist` (de renner rijdt playerZ voor de camera uit)
  game.gradeAtDist = dist => VBT.track.gradeAt(segAtDist(dist) + Math.floor(game.playerZ / cfg.segmentLength));
  game.segAtDist = segAtDist;

  // camerapositie en weghoogte onder de renner bijwerken (in update én render, zodat opname altijd klopt)
  game.syncPosition = () => {
    const T = VBT.track;
    game.position = VBT.util.wrap(game.player.dist * cfg.unitsPerMeter, T.length());
    const pz = game.position + game.playerZ;
    const seg = T.find(pz);
    game.playerY = VBT.util.lerp(seg.p1.world.y, seg.p2.world.y, VBT.util.percentRemaining(pz, cfg.segmentLength));
    return seg;
  };

  return game;
})();
