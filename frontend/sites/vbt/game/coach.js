// Ploegleider: rijdt af en toe naast je in de teamwagen en roept iets passends (ook gesproken via de
// Web Speech API, uit te zetten in Settings). Teksten in het Engels (zelfde regime als de UI).
VBT.coach = (function () {
  const $ = id => document.getElementById(id);
  let speaking = false, hideTimer = null;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  // tekst bij de situatie van dit moment
  function line(game) {
    const s = game.sensors, run = game.run;
    const cur = run && !run.wo.free && !run.done ? VBT.workout.current(run, VBT.cfg.rider.ftp) : null;
    const options = [];
    if (cur) {
      options.push(`Hold ${cur.watts} watts - ${fmt(cur.remaining)} to go in this block!`);
      if (cur.cadence && s.cadence < cur.cadence - 6) options.push(`Cadence! Spin it up to ${cur.cadence} rpm!`);
      if (cur.cadence && s.cadence > cur.cadence + 6) options.push(`Easy on the cadence, settle at ${cur.cadence} rpm.`);
      if (cur.next && cur.next.a >= 95) options.push(`Next block is ${cur.next.a} percent. Breathe now, get ready!`);
      if (cur.pct >= 100) options.push('This is where you get faster. Stay with it!', 'Hurts? Good. That is the point!');
      if (cur.pct < 60) options.push('Recover now. Shoulders loose, drink something.');
    } else {
      const gap = game.pack.dist - game.player.dist;
      if (!game.inBunch && gap > 5 && gap < 60) options.push(`The bunch is ${Math.round(gap)} metres ahead - close the gap!`);
      if (game.inBunch) options.push('Nice, sit in the wheels and save energy!');
      const g = game.ghost.dist - game.player.dist;
      if (game.ghostLabel === 'PB' && g > 0) options.push('Your PB is just ahead. Dig in!');
      if (game.ghostLabel === 'PB' && g < 0) options.push('You are ahead of your PB. Keep pushing!');
    }
    if (game.grade > 0.05) options.push('Climb! Stay seated, steady power, own this hill!');
    if (game.grade < -0.03) options.push('Downhill - spin and recover.');
    options.push('Allez allez allez!', 'Looking strong!', 'Smooth pedal strokes, relax the hands.', 'Breathe deep, you have got this!');
    return pick(options);
  }

  function say(text) {
    const el = $('coach');
    if (el) {
      $('coachText').textContent = text;
      el.classList.add('show');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => el.classList.remove('show'), 6000);
    }
    if (VBT.store) VBT.store.log('coach', 'Team director: ' + text);
    const set = VBT.settings.values;
    if (!set.voice || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = set.voiceLang || 'en-US';
      const voice = window.speechSynthesis.getVoices().find(v => v.lang === u.lang) || null;
      if (voice) u.voice = voice;
      u.rate = 1.05;
      u.onstart = () => { speaking = true; };
      u.onend = u.onerror = () => { speaking = false; };
      window.speechSynthesis.speak(u);
    } catch (e) { speaking = false; }
  }

  function speak(game) { say(line(game)); }
  function stop() { speaking = false; try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* niets */ } }

  return { speak, say, stop, line, isSpeaking: () => speaking };
})();
