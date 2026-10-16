// Workout-varianten (item 1305): dezelfde workout in 30/45/60/90 min, KORTER (één stap omlaag) en SHUFFLE
// (een andere workout met ongeveer dezelfde duur en zwaarte). Warming-up en cooldown blijven, het hoofddeel
// schaalt mee; korte blokken (<= 60 s, sprints) houden hun lengte zodat de prikkel hetzelfde blijft.
// Een variant van een plan-workout houdt id/week/dag, dus hij telt gewoon als die plan-dag.
VBT.workoutVariants = (function () {
  const SIZES = [30, 45, 60, 90];
  const EASY = 76;              // %FTP: warming-up/cooldown-blokken liggen hieronder
  const EDGE_MAX = 900;         // s: warming-up en cooldown elk max 15 min herkennen
  const KEEP = 60;              // s: kortere blokken niet schalen

  const top = st => Math.max(st.a, st.b);
  const dur = steps => steps.reduce((t, s) => t + s.d, 0);

  function split(steps) {
    let w = 0, wd = 0;
    while (w < steps.length - 1 && top(steps[w]) < EASY && wd + steps[w].d <= EDGE_MAX) { wd += steps[w].d; w++; }
    let c = steps.length, cd = 0;
    while (c - 1 > w && top(steps[c - 1]) < EASY && cd + steps[c - 1].d <= EDGE_MAX) { c--; cd += steps[c].d; }
    return { warm: steps.slice(0, w), main: steps.slice(w, c), cool: steps.slice(c) };
  }

  const can = wo => !!(wo && !wo.free && wo.steps && wo.steps.length > 2 && !VBT.ftp.testType(wo));

  // de maten die zinvol zijn voor deze workout (niet gelijk aan het origineel, hoofddeel blijft >= 10 min)
  function sizes(wo) {
    if (!can(wo)) return [];
    const { warm, cool } = split(wo.steps), edges = dur(warm) + dur(cool), orig = Math.round(wo.duration / 60);
    return SIZES.filter(m => Math.abs(m - orig) >= 5 && m * 60 - Math.min(edges, m * 12) >= 600);
  }

  // wo = de niet-geschaalde workout (variantOf van een eerdere variant)
  function resize(wo, minutes) {
    wo = wo.variantOf || wo;
    const target = minutes * 60;
    let { warm, main, cool } = split(wo.steps);
    // korte variant: warming-up/cooldown samen max 20% van de tijd
    const edges = dur(warm) + dur(cool), edgeMax = target * 0.2;
    if (edges > edgeMax) {
      const f = edgeMax / edges;
      warm = warm.map(s => Object.assign({}, s, { d: Math.max(30, Math.round(s.d * f / 10) * 10) }));
      cool = cool.map(s => Object.assign({}, s, { d: Math.max(30, Math.round(s.d * f / 10) * 10) }));
    }
    const fixed = main.filter(s => s.d <= KEEP), scalable = main.filter(s => s.d > KEEP);
    const room = target - dur(warm) - dur(cool) - dur(fixed);
    const f = scalable.length ? Math.max(0.2, room / dur(scalable)) : 1;
    main = main.map(s => (s.d <= KEEP ? s : Object.assign({}, s, { d: Math.max(30, Math.round(s.d * f / 10) * 10) })));
    const steps = warm.concat(main, cool);
    const key = (wo.courseKey || wo.id) + '~' + minutes;           // eigen parcours/ghost, terug te vinden bij hervatten
    return Object.assign({}, wo, { steps, duration: dur(steps), variant: minutes, courseKey: key, variantOf: wo });
  }

  // KORTER: de eerstvolgende kleinere maat
  function shorter(wo) {
    const base = wo.variantOf || wo, now = wo.duration / 60;
    const m = sizes(base).filter(x => x < now - 2).pop();
    return m ? resize(base, m) : null;
  }

  // zwaarte = intensity factor uit de TSS
  const intensity = wo => Math.sqrt(VBT.workout.tss(wo) / (wo.duration / 3600) / 100);

  // SHUFFLE: een andere workout uit de bibliotheek met duur binnen 20% en vergelijkbare zwaarte; houdt de plan-plek
  function shuffle(wo, library) {
    const base = wo.original || wo.variantOf || wo, I = intensity(base);
    const pool = (library || []).filter(w => w.name !== base.name && w.steps && w.steps.length && !VBT.ftp.testType(w)
      && Math.abs(w.duration - base.duration) <= base.duration * 0.2 && Math.abs(intensity(w) - I) <= 0.06);
    if (!pool.length) return null;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return Object.assign({}, pick, { id: base.id, week: base.week, day: base.day, swappedFrom: base.name, original: base,
      courseKey: pick.id + '@' + base.id });
  }

  // courseKey van een opgeslagen rit -> de workout zoals hij gereden is (voor CONTINUE RIDE)
  //   <id>  ·  <id>~45 (variant)  ·  <andere-id>@<plan-id> (geruild)  ·  <andere-id>@<plan-id>~45
  async function restore(courseKey) {
    const [key, min] = courseKey.split('~');
    const find = async id => VBT.calendar.find(id) || (VBT.storage.getWorkout ? await VBT.storage.getWorkout(id).catch(() => null) : null);
    let wo;
    if (key.includes('@')) {
      const [pickId, planId] = key.split('@');
      const pick = await find(pickId), plan = VBT.calendar.find(planId);
      wo = pick && Object.assign({}, pick, plan ? { id: plan.id, week: plan.week, day: plan.day } : {}, { courseKey: key });
    } else wo = await find(key);
    return wo && min ? resize(wo, +min) : wo;
  }

  return { sizes, resize, shorter, shuffle, split, restore };
})();
