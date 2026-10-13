// Brug tussen Bluetooth en de game: echte sensordata gebruiken, ERG/SIM-doelen naar de trainer sturen,
// en de rit automatisch pauzeren als het trainersignaal wegvalt (en hervatten als het stabiel terug is).
VBT.bleBridge = (function () {
  const ble = VBT.ble;
  const RESUME_AFTER_MS = 1500;
  let stableSince = 0;
  const $ = id => document.getElementById(id);

  function pausedText(title, sub) {
    $('pausedTitle').textContent = title;
    $('pausedSub').textContent = sub || '';
  }

  // Vóór de pauze-check in update(): pauzeren bij signaalverlies, hervatten als het weer stabiel is
  function guard(game) {
    if (!ble.trainerActive()) return;
    const ok = ble.trainerOk();
    if (game.state === 'ride' && !ok) {
      game.autoPaused = true;
      stableSince = 0;
      game.setState('paused');
      pausedText('TRAINER SIGNAL LOST', 'RECONNECTING… YOUR RIDE AND WORKOUT TIMER ARE PAUSED');
      ble.note('ride: auto-paused at ' + Math.round(game.rideTime) + ' s');
    } else if (game.state === 'paused' && game.autoPaused) {
      if (!ok) { stableSince = 0; return; }
      if (!stableSince) stableSince = performance.now();
      if (performance.now() - stableSince < RESUME_AFTER_MS) return;
      game.autoPaused = false;
      stableSince = 0;
      ble.resetTargets();          // doel opnieuw sturen
      game.setState('ride');
      VBT.hud.message('TRAINER BACK!', VBT.palette.cyan);
      ble.note('ride: resumed at ' + Math.round(game.rideTime) + ' s');
    }
  }

  // Echte trainerdata i.p.v. de simulatie (tijdens countdown/rit). Geeft false als er geen trainer is.
  function apply(game, cur, erg) {
    if (!ble.trainerActive() || !['ride', 'countdown', 'paused'].includes(game.state)) return false;
    const s = game.sensors, L = ble.live, ok = ble.trainerOk();
    s.watts = ok ? L.power : 0;
    s.cadence = ok ? L.cadence : 0;
    s.avg3s.push(s.watts);
    if (s.avg3s.length > 180) s.avg3s.shift();
    if (game.state === 'ride' && ok) {
      if (erg) ble.setErg(cur.watts);
      else ble.setGrade(game.grade * 100);
    }
    return true;
  }

  // Hartslag van de band (ook zonder trainer, dan rijdt de rest gesimuleerd)
  function heartRate(game) {
    if (ble.hrOk()) game.sensors.hr = ble.live.hr;
  }

  // Na de rit: weerstand los (vlakke weg), zodat je niet in ERG blijft hangen
  function release() {
    if (ble.trainerActive()) ble.release();
  }

  return { guard, apply, heartRate, release, pausedText };
})();
