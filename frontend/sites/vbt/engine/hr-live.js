// Live verhouding vermogen/hartslag tijdens de rit (item 1353): W/BPM over de laatste 5 minuten, en een
// ploegleider-melding als die bij gelijke inspanning duidelijk lager ligt dan na het opwarmen (hartslagdrift).
// Hartslag reageert traag, daarom per seconde middelen over minuten - niet per frame.
VBT.hrLive = (function () {
  const WINDOW = 300;                        // s voor het live-getal
  const BASE_FROM = 600, BASE_TO = 1200;     // s rijtijd: referentie na het opwarmen (minuut 10-20)
  const MIN_RIDE = 1800;                     // pas vanaf 30 min over drift beginnen
  const DRIFT_WARN = 8;                      // % minder W/BPM dan de referentie
  const SAME_EFFORT = 0.10;                  // vermogen binnen 10% van de referentie = vergelijkbare inspanning
  const COOLDOWN = 600;                      // s tussen twee meldingen
  let win, lastSec, baseAcc, base, lastWarn;

  function reset() {
    win = []; lastSec = -1; baseAcc = { w: 0, h: 0, n: 0 }; base = null; lastWarn = -Infinity;
  }
  reset();

  // elk frame; telt één sample per hele seconde rijtijd (alleen tijdens rijden, met vermogen en hartslag)
  function update(game) {
    if (game.state !== 'ride') return;
    const t = Math.floor(game.rideTime), s = game.sensors;
    if (t < lastSec) reset();                  // nieuwe rit
    if (t === lastSec) return;
    lastSec = t;
    if (!(s.watts > 0 && s.hr > 0)) return;
    win.push([s.watts, s.hr]);
    if (win.length > WINDOW) win.shift();
    if (t >= BASE_FROM && t < BASE_TO) { baseAcc.w += s.watts; baseAcc.h += s.hr; baseAcc.n++; }
    if (!base && t >= BASE_TO && baseAcc.n >= 300) base = { w: baseAcc.w / baseAcc.n, h: baseAcc.h / baseAcc.n };
    if (base && t >= MIN_RIDE && t - lastWarn >= COOLDOWN) check(t);
  }

  function windowAvg() {
    if (win.length < 120) return null;
    let w = 0, h = 0;
    for (const [sw, sh] of win) { w += sw; h += sh; }
    return { w: w / win.length, h: h / win.length };
  }

  function check(t) {
    const a = windowAvg();
    if (!a || Math.abs(a.w - base.w) / base.w > SAME_EFFORT) return;
    const drift = ((base.w / base.h) - (a.w / a.h)) / (base.w / base.h) * 100;
    if (drift < DRIFT_WARN) return;
    lastWarn = t;
    VBT.store && VBT.store.log('coach', 'HR drift ' + drift.toFixed(1) + '% vs. after warm-up');
    if (VBT.settings.show('coach')) VBT.coach.say('Your heart rate is drifting up at the same power - drink something and keep it steady.');
  }

  // W/BPM over de laatste 5 minuten (null tot er 2 minuten data is)
  function ratio() {
    const a = windowAvg();
    return a ? a.w / a.h : null;
  }

  return { update, ratio, reset };
})();
