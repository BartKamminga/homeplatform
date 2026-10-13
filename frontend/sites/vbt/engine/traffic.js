// Verkeer: af en toe rare voertuigen (Ferrari die je voorbij raast, tractor, ijscowagen, bezemwagen, UFO)
// en de teamwagen van de ploegleider die naast je komt rijden. Alleen tijdens het rijden, uit te zetten.
VBT.traffic = (function () {
  const list = [];
  const ODD = ['ferrari', 'tractor', 'icecream', 'broom', 'ufo', 'ferrari'];
  let nextOdd = 45, nextCoach = 20, coach = null;
  const rand = (a, b) => a + Math.random() * (b - a);

  function reset() {
    list.length = 0;
    coach = null;
    nextOdd = rand(30, 60);
    nextCoach = rand(15, 30);
    VBT.coach.stop();
  }

  function spawnOdd(kind, game) {
    const p = game.player.dist, v = game.player.v;
    const make = {
      ferrari: { dist: p - 35, v: v + 14, x: -0.67, ttl: 35 },                 // raast links voorbij, blijft even in beeld
      tractor: { dist: p + 45, v: 3.5, x: 1.3, ttl: 90 },                     // sukkelt op de berm, je haalt hem in
      icecream: { dist: p + 50, v: 0, x: -1.35, ttl: 90 },                    // geparkeerd langs de weg
      broom: { dist: p - 20, v: v + 2, x: -0.67, ttl: 70 },                   // bezemwagen schuift langzaam voorbij
      ufo: { dist: p + 22, v, x: 0.1, ttl: 24, hover: 15 },                   // zweeft boven je, schiet dan weg
    }[kind];
    list.push(Object.assign({ kind, age: 0 }, make));
    VBT.store.log('traffic', kind.toUpperCase() + ' on the road');
  }

  function spawnCoach(game) {
    coach = { kind: 'teamcar', dist: game.player.dist - 30, v: game.player.v, x: -0.05, age: 0, ttl: 26, said: 0 };
    list.push(coach);
  }

  // extra net aangezet in Settings: meteen laten zien (ook op het titelscherm, daar rijdt de weg ook)
  function preview(key) {
    const game = VBT.game;
    if (key === 'coach') { if (!coach) spawnCoach(game); return true; }
    if (key === 'traffic') { const k = ODD.filter(x => VBT.settings.show('veh_' + x)); spawnOdd(k.length ? k[Math.floor(Math.random() * k.length)] : 'ferrari', game); return true; }
    if (key.startsWith('veh_') && ODD.includes(key.slice(4))) {
      spawnOdd(key.slice(4), game);
      const c = list[list.length - 1];
      if (c.kind === 'ferrari' || c.kind === 'broom') { c.dist = game.player.dist - 8; c.v = game.player.v + 6; c.slow = true; }   // preview: meteen en rustig in beeld
      return true;
    }
    return false;
  }

  function update(dt, game) {
    // geplande voertuigen en ploegleider alleen tijdens het rijden; wat er al rijdt (bv. een preview) beweegt altijd
    if (game.state !== 'ride') { if (list.length && ['title', 'finished'].includes(game.state)) move(dt, game); return; }
    const show = VBT.settings.show;
    const kinds = ODD.filter(k => show('veh_' + k));
    const on = show('traffic') && kinds.length > 0;
    const hard = game.run && !game.run.wo.free && VBT.workout.current(game.run, VBT.cfg.rider.ftp).pct >= 105;
    if (on && !hard && game.rideTime >= nextOdd) {
      spawnOdd(kinds[Math.floor(Math.random() * kinds.length)], game);
      nextOdd = game.rideTime + rand(70, 160);
    }
    // ploegleider: komt naast je rijden, roept 2x iets, laat zich dan zakken
    if (!coach && show('coach') && game.rideTime >= nextCoach) {
      spawnCoach(game);
      nextCoach = game.rideTime + rand(150, 260);
    }
    move(dt, game);
  }

  function move(dt, game) {
    for (const c of list) {
      c.age += dt;
      c.ttl -= dt;
      if (c.kind === 'ferrari') c.v += (c.slow ? 0.8 : 2.5) * dt;
      if (c.kind === 'ufo' && c.age > c.hover) c.v += 40 * dt;               // schiet weg
      if (c.kind === 'ufo' && c.age <= c.hover) c.v = game.player.v;
      if (c === coach) {
        const target = c.ttl > 4 ? game.player.dist + 3.5 : game.player.dist - 80;
        c.v = Math.max(0, game.player.v + VBT.util.clamp((target - c.dist) * 0.9, -6, 9));
        c.x = game.playerX - 0.62;
        if (c.said === 0 && Math.abs(c.dist - (game.player.dist + 3.5)) < 2) { c.said = 1; c.saidAt = c.age; VBT.coach.speak(game); }
        if (c.said === 1 && c.age - c.saidAt > 11) { c.said = 2; VBT.coach.speak(game); }
      }
      c.dist += c.v * dt;
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i];
      if (c.ttl <= 0 || Math.abs(c.dist - game.player.dist) > 450) {
        list.splice(i, 1);
        if (c === coach) coach = null;
      }
    }
  }

  // als 'riders' voor de weg-renderer (relZ = afstand vóór de camera)
  function riders(game, toRelZ, t) {
    return list.map(c => ({ relZ: toRelZ(c.dist), x: c.x, vehicle: c.kind, time: t,
      speaking: c === coach && VBT.coach.isSpeaking() }));
  }

  // testhaakjes: eerstvolgende ploegleider/voertuig vervroegen
  function schedule({ coachAt, oddAt } = {}) { if (coachAt !== undefined) nextCoach = coachAt; if (oddAt !== undefined) nextOdd = oddAt; }

  return { reset, update, riders, schedule, preview, spawn: kind => spawnOdd(kind, VBT.game), list };
})();
