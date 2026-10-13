// Workouts: interval -> helling (bergen/dalen naar intensiteit), parcours bouwen, voortgang volgen, grafiek tekenen.
VBT.workout = (function () {
  const { cfg, util } = VBT;
  const CHUNK_S = 10;          // parcours in stukjes van max 10 s, zodat ramps een geleidelijke helling krijgen

  // %FTP -> helling: herstel = dal/afdaling, tempo = vals plat/klim, threshold = steile klim, sprint = muur
  // onder 60% zachter (warming-up/herstel = vlak dal of lichte afdaling), daarboven steeds steiler
  function gradeFor(pct) {
    const f = pct / 100 - 0.6;
    return util.clamp(f < 0 ? f * 10 : f * 20, -2.5, 11);
  }

  // Stationaire snelheid (m/s) bij vermogen P op helling g (fractie), bisectie
  function steadySpeed(P, g) {
    const r = cfg.rider, G = 9.81, th = Math.atan(g);
    const f = v => v * (r.mass * G * Math.sin(th) + r.crr * r.mass * G * Math.cos(th) + 0.5 * r.rho * r.cda * v * v) - P;
    let lo = 0.3, hi = 30;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  const pctAt = (st, p) => util.lerp(st.a, st.b, p);

  // Bochten als vloeiende functie van de afstand
  const curveAt = m => Math.round((Math.sin(m / 420) * 3 + Math.sin(m / 173 + 1.3) * 1.5) * 2) / 2;

  // Workout -> parcourssecties (meters + helling) die precies even lang duren als de intervallen
  function buildCourse(wo, ftp) {
    const course = [];
    let dist = 0, t0 = 0;
    wo.steps.forEach((st, si) => {
      const n = Math.max(1, Math.round(st.d / CHUNK_S));
      for (let i = 0; i < n; i++) {
        const pct = pctAt(st, (i + 0.5) / n);
        const g = gradeFor(pct);
        const m = steadySpeed(ftp * pct / 100, g / 100) * st.d / n;
        course.push({ m, g, c: [curveAt(dist)], sign: i === 0, tag: si === wo.steps.length - 1 && i === n - 1 ? 'finish' : '',
          t0, d: st.d / n, dist });
        dist += m;
        t0 += st.d / n;
      }
    });
    course.push({ m: 300, g: 0, c: [0], sign: false });     // uitrijden na de finish
    return course;
  }

  // Lopende workout: welke stap, doelwatt, doelcadans, cadansscore
  // course (optioneel): het gebouwde parcours, zodat we tijd -> afstand kunnen omrekenen (springen)
  function createRun(wo, course) {
    const starts = stepStarts(wo);
    const total = wo.steps.reduce((t, st) => t + st.d, 0);
    const timeline = (course || []).filter(c => c.d);
    return { wo, starts, total, timeline, elapsed: 0, index: 0, cadOk: 0, cadTotal: 0, work: 0, done: false };
  }

  function stepStarts(wo) {
    let t = 0;
    return wo.steps.map(st => { const s = t; t += st.d; return s; });
  }

  // Index van het interval op fractie `frac` (0..1) van de workout, bv. waar iemand in de grafiek klikt
  function stepAtFraction(wo, frac) {
    const starts = stepStarts(wo), total = wo.steps.reduce((t, st) => t + st.d, 0);
    const time = util.clamp(frac, 0, 1) * total;
    let i = 0;
    while (i < starts.length - 1 && starts[i + 1] <= time) i++;
    return i;
  }

  // Naar het begin van interval `index` springen; geeft de bijbehorende afstand op het parcours terug
  function seek(run, index) {
    run.index = index;
    run.elapsed = run.starts[index];
    const tl = run.timeline;
    let k = 0;
    while (k < tl.length - 1 && tl[k + 1].t0 <= run.elapsed + 0.001) k++;
    return tl.length ? tl[k].dist + (run.elapsed - tl[k].t0) / tl[k].d * tl[k].m : 0;
  }

  function update(run, dt, ftp, cadence, watts) {
    if (run.done) return null;
    run.elapsed += dt;
    run.work += watts * dt;
    if (run.elapsed >= run.total) { run.done = true; return { finished: true }; }
    const before = run.index;
    while (run.index < run.wo.steps.length - 1 && run.elapsed >= run.starts[run.index + 1]) run.index++;
    const st = run.wo.steps[run.index];
    if (st.c) {
      run.cadTotal += dt;
      if (Math.abs(cadence - st.c) <= 6) run.cadOk += dt;
    }
    return { changed: run.index !== before, step: st };
  }

  function current(run, ftp) {
    const st = run.wo.steps[run.index];
    const into = run.elapsed - run.starts[run.index];
    const pct = pctAt(st, util.clamp(into / st.d, 0, 1));
    return {
      step: st, pct, watts: Math.round(ftp * pct / 100), cadence: st.c || null,
      remaining: st.d - into, next: run.wo.steps[run.index + 1] || null,
    };
  }

  // Trainingsbelasting (TSS) op basis van de doelwaarden
  function tss(wo) {
    if (!wo.steps.length) return Math.round(wo.duration / 3600 * 50);
    let sum4 = 0, total = 0;
    wo.steps.forEach(st => { const p = (st.a + st.b) / 200; sum4 += Math.pow(p, 4) * st.d; total += st.d; });
    const IF = Math.pow(sum4 / total, 0.25);
    return Math.round(total / 3600 * IF * IF * 100);
  }

  // Blokkengrafiek zoals in Zwift: hoogte = %FTP, kleur = zone
  function drawChart(ctx, wo, W, H, progress) {
    ctx.clearRect(0, 0, W, H);
    if (!wo.steps.length) {
      ctx.fillStyle = 'rgba(155,92,255,0.35)';
      ctx.fillRect(0, H * 0.5, W, H * 0.5);
      return;
    }
    const total = wo.steps.reduce((t, s) => t + s.d, 0);
    const top = 165;
    let x = 0;
    for (const st of wo.steps) {
      const w = st.d / total * W;
      const ya = H - st.a / top * H, yb = H - st.b / top * H;
      ctx.fillStyle = util.zoneFor(cfg.rider.ftp * (st.a + st.b) / 200).color;
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x, ya);
      ctx.lineTo(x + w, yb);
      ctx.lineTo(x + w, H);
      ctx.fill();
      x += w;
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, H - 100 / top * H);
    ctx.lineTo(W, H - 100 / top * H);
    ctx.stroke();
    ctx.setLineDash([]);
    if (progress !== undefined) {
      ctx.fillStyle = 'rgba(7,1,26,0.55)';
      ctx.fillRect(0, 0, progress * W, H);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(progress * W - 1, 0, 2, H);
    }
  }

  return { gradeFor, buildCourse, createRun, stepAtFraction, seek, update, current, tss, drawChart };
})();
