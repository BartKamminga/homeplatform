// Fietsfysica: vermogen + helling + luchtweerstand -> snelheid. Plus gesimuleerde trainerdata.
VBT.physics = (function () {
  const { cfg, util } = VBT;
  const G = 9.81;

  function step(state, watts, grade, dt, cdaFactor = 1) {
    const r = cfg.rider;
    const v = Math.max(state.v, 1);
    const theta = Math.atan(grade);
    const fGrav = r.mass * G * Math.sin(theta);
    const fRoll = r.crr * r.mass * G * Math.cos(theta);
    const fAero = 0.5 * r.rho * r.cda * cdaFactor * state.v * state.v;
    const a = (watts / v - fGrav - fRoll - fAero) / r.mass;
    state.v = Math.max(0, state.v + a * dt);
    state.dist += state.v * dt;
  }

  // Zolang er geen Kickr gekoppeld is: toetsenbord of autopilot levert de "sensordata"
  function createSensors() {
    return { target: Math.round(cfg.rider.ftp * 0.8), watts: 0, cadence: 0, hr: 95, sprint: false, avg3s: [], cadOffset: 0 };
  }

  // ergCadence: in ERG-modus volgt de cadans het doel (+ jouw bijsturing), het vermogen ligt vast
  function updateSensors(s, dt, t, grade, ergCadence) {
    const target = s.target + (s.sprint ? 380 : 0);
    const noise = Math.sin(t * 9.1) * 6 + Math.sin(t * 3.7) * 9;
    s.watts = util.lerp(s.watts, Math.max(0, target + noise), Math.min(1, dt * (s.sprint ? 6 : 2.5)));
    const free = util.clamp(68 + s.watts / 11 - grade * 120 + (s.sprint ? 18 : 0), 50, 125);
    const cadTarget = s.watts < 5 ? 0 : ergCadence ? util.clamp(ergCadence + s.cadOffset + Math.sin(t * 0.7) * 2, 40, 130) : free;
    s.cadence = util.lerp(s.cadence, cadTarget, dt * 2);
    s.hr = util.lerp(s.hr, 88 + s.watts * 0.32, dt * 0.15);
    s.avg3s.push(s.watts);
    if (s.avg3s.length > 180) s.avg3s.shift();
  }

  function autopilot(s, t, grade) {
    s.target = cfg.rider.ftp * (0.75 + Math.sin(t / 6) * 0.15) + Math.max(0, grade) * 1200;
    s.sprint = Math.sin(t / 3.3) > 0.97;
  }

  return { step, createSensors, updateSensors, autopilot };
})();
