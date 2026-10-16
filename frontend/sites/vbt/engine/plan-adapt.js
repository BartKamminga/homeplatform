// Adaptief plan v1 (items 1306/1343), keuzes van Bart:
//  - gemiste workout: TODAY stelt een nieuwe dag voor, jij bevestigt (MOVE) of slaat over (SKIP) - niets automatisch
//  - beschikbaarheid in minuten per weekdag; een te lange workout krijgt die dag de passende variant (1305)
//  - readiness en RPE: alleen een voorstel (kortere variant), jij kiest
//  - workouts binnen een week ruilen/verplaatsen (MOVE TO ...)
// Alles per plan in je instellingen: planMoves {slug: {id: datum}}, planSkips {slug: {id: true}},
// availability {1..7 (ma..zo): minuten}, todayReadiness {date, v}.
VBT.planAdapt = (function () {
  const C = () => VBT.calendar, S = () => VBT.settings;
  const slug = () => C().getState().planSlug;
  const todayIso = () => C().iso(new Date());
  const weekday = d => (d.getDay() + 6) % 7 + 1;                   // 1 = maandag .. 7 = zondag

  function patchPerPlan(key, id, value) {
    const all = Object.assign({}, S().values[key] || {});
    const mine = Object.assign({}, all[slug()] || {});
    if (value === undefined) delete mine[id]; else mine[id] = value;
    all[slug()] = mine;
    S().save({ [key]: all });
    C().touch();
  }

  const moveTo = (id, iso) => patchPerPlan('planMoves', id, iso);
  const skip = id => patchPerPlan('planSkips', id, true);
  const unskip = id => patchPerPlan('planSkips', id, undefined);
  const isSkipped = id => !!((S().values.planSkips || {})[slug()] || {})[id];

  // beschikbaarheid: minuten op een datum, of null als je niets hebt ingesteld (dan geen beperking)
  function minutesOn(date) {
    const a = S().values.availability;
    if (!a || !Object.keys(a).length) return null;
    const v = a[weekday(date)];
    return v === undefined || v === null || v === '' ? null : +v;
  }
  const setAvailability = av => { S().save({ availability: av }); C().touch(); };

  const items = () => C().getState().plan.weeks.flat().filter(w => !w.rest && !w.free);
  const done = id => !!C().getState().done[id];

  // gemiste workouts: datum voorbij, niet gedaan, niet overgeslagen (oudste eerst)
  function missed() {
    const t = todayIso();
    return items().filter(w => !done(w.id) && !isSkipped(w.id) && C().iso(C().dateFor(w)) < t)
      .sort((a, b) => (C().dateFor(a) - C().dateFor(b)));
  }

  // eerstvolgende vrije dag vanaf vandaag: beschikbaar (> 0 min, of geen beschikbaarheid ingesteld) en nog geen
  // andere open workout op die dag
  function nextFreeDay(exceptId) {
    const busy = new Set(items().filter(w => w.id !== exceptId && !done(w.id) && !isSkipped(w.id)).map(w => C().iso(C().dateFor(w))));
    const d = new Date();
    for (let i = 0; i < 21; i++, d.setDate(d.getDate() + 1)) {
      const m = minutesOn(d), iso = C().iso(d);
      if ((m === null || m > 0) && !busy.has(iso)) return new Date(d);
    }
    return null;
  }

  // passende variant als de workout langer is dan je beschikbaarheid die dag
  function fitted(wo, date) {
    const m = minutesOn(date || new Date());
    if (!wo || m === null || m <= 0 || wo.duration / 60 <= m + 2) return null;
    const sizes = VBT.workoutVariants.sizes(wo).filter(s => s <= m);
    return sizes.length ? VBT.workoutVariants.resize(wo, sizes[sizes.length - 1]) : null;
  }

  // readiness van vandaag (TODAY) en het voorstel dat daarbij hoort; ook na twee zware ritten (RPE 8+)
  const readinessToday = () => { const r = S().values.todayReadiness; return r && r.date === todayIso() ? r.v : null; };
  const setReadiness = v => { S().save({ todayReadiness: { date: todayIso(), v } }); C().touch(); };

  function suggestion(wo, lastRides) {
    if (!wo || VBT.ftp.testType(wo)) return null;
    const r = readinessToday();
    const hard = (lastRides || []).slice(0, 2).filter(x => x.rpe >= 8).length === 2;
    const sizes = VBT.workoutVariants.sizes(wo).filter(s => s * 60 < wo.duration - 120);
    if (!sizes.length) return null;
    if (r === 'wrecked') return { why: 'You feel wrecked', variant: VBT.workoutVariants.resize(wo, sizes[0]) };
    if (r === 'tired') return { why: 'You feel tired', variant: VBT.workoutVariants.resize(wo, sizes[sizes.length - 1]) };
    if (hard) return { why: 'Your last two rides were hard (RPE 8+)', variant: VBT.workoutVariants.resize(wo, sizes[sizes.length - 1]) };
    return null;
  }

  // de dagen van de week van een workout (voor MOVE TO in MY PLAN)
  function weekDays(wo) {
    const start = C().parse(C().getState().startDate);
    start.setDate(start.getDate() + (wo.week - 1) * 7);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  }

  return { moveTo, skip, unskip, isSkipped, minutesOn, setAvailability, missed, nextFreeDay, fitted, readinessToday, setReadiness,
    suggestion, weekDays };
})();
