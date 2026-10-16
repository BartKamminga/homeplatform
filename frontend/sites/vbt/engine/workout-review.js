// Workout-score met uitleg (item 1307): tijdens de workout per seconde bijhouden hoe goed vermogen en cadans
// het doel volgen (zware en rustige blokken apart), na afloop een score (0-100) en 1-2 concrete tips.
// Wordt bij de rit bewaard (ride.review) en getoond op het eindscherm en in MY RIDES.
VBT.workoutReview = (function () {
  const HARD = 90;             // %FTP vanaf hier telt een blok als zwaar

  function fresh() {
    return { pwT: 0, pwOk: 0, hardT: 0, hardUnder: 0, cadT: 0, cadOk: 0, hardCadT: 0, hardCadDiff: 0, easyCadT: 0, easyCadDiff: 0 };
  }

  // elke update van de lopende workout (workout.update): st = huidige stap, pct = doel-%FTP op dit moment
  function track(run, st, pct, ftp, watts, cadence, dt) {
    if (st.free || run.wo.free) return;
    const r = run.rv || (run.rv = fresh());
    const target = ftp * pct / 100;
    if (target > 0) {
      r.pwT += dt;
      if (Math.abs(watts - target) <= Math.max(0.05 * target, 8)) r.pwOk += dt;
      if (pct >= HARD) { r.hardT += dt; if (watts < 0.9 * target) r.hardUnder += dt; }
    }
    if (st.c) {
      r.cadT += dt;
      if (Math.abs(cadence - st.c) <= 6) r.cadOk += dt;
      if (pct >= HARD) { r.hardCadT += dt; r.hardCadDiff += (cadence - st.c) * dt; } else { r.easyCadT += dt; r.easyCadDiff += (cadence - st.c) * dt; }
    }
  }

  function build(run, jumped) {
    const r = run && run.rv;
    if (!r || r.pwT < 60) return null;
    const pw = r.pwOk / r.pwT, cad = r.cadT >= 60 ? r.cadOk / r.cadT : null;
    const score = Math.round((cad === null ? pw : (pw + cad) / 2) * 100);
    const tips = [];
    const hardCad = r.hardCadT >= 60 ? r.hardCadDiff / r.hardCadT : 0;
    const easyCad = r.easyCadT >= 60 ? r.easyCadDiff / r.easyCadT : 0;
    const under = r.hardT >= 60 ? r.hardUnder / r.hardT : 0;
    if (under > 0.15) tips.push('You were under target for ' + Math.round(under * 100) + '% of the hard blocks. If that keeps happening, take the shorter variant or check your FTP.');
    if (hardCad < -6) tips.push('In the hard blocks your cadence was ' + Math.round(-hardCad) + ' rpm under target. Shift to an easier gear - in ERG the trainer keeps the watts, you just spin faster.');
    if (hardCad > 6) tips.push('In the hard blocks you spun ' + Math.round(hardCad) + ' rpm above target. A slightly bigger gear makes the effort feel more controlled.');
    if (easyCad < -8) tips.push('Recovery blocks were ' + Math.round(-easyCad) + ' rpm under target. Keep spinning light - it flushes the legs better than grinding slowly.');
    if (jumped) tips.push('You skipped intervals, so this score covers only the part you rode.');
    if (!tips.length) tips.push(score >= 85 ? 'Spot on - power and cadence on target. You are ready for a bit more next time.'
      : 'Solid ride. Aim to keep cadence within 6 rpm of the target to push the score up.');
    return { score, power: Math.round(pw * 100), cadence: cad === null ? null : Math.round(cad * 100), tips: tips.slice(0, 2) };
  }

  return { track, build };
})();
