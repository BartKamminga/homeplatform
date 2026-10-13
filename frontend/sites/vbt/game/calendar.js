// Trainingsplan-data (geen DOM; de UI zit in React: TODAY en MY PLAN in het linkerpaneel).
// Actief plan + startdatum, afvinken, FTP, wisselen van plan met startdatum per plan, en 'wat is er vandaag'.
VBT.calendar = (function () {
  const DEFAULT_PLAN = 'ftp-builder';
  let plan = { weeks: [], dayOffsets: [] }, plans = [], state = {}, version = 0;

  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const bump = () => { version++; };

  function monday(offsetWeeks = 0) {
    const d = new Date();
    d.setDate(d.getDate() - (d.getDay() + 6) % 7 + offsetWeeks * 7);
    return iso(d);
  }
  const nextMonday = () => monday(new Date().getDay() === 1 ? 0 : 1);

  async function load() {
    try { state = (await VBT.storage.loadProfile()) || {}; } catch (e) { state = {}; }
    state = { ftp: state.ftp, planSlug: state.planSlug, startDate: state.startDate || state.planStart, done: state.done || state.planDone };
    state.ftp = state.ftp || 180;
    state.planSlug = state.planSlug || DEFAULT_PLAN;
    state.startDate = state.startDate || monday();
    state.done = state.done || {};
    VBT.cfg.rider.ftp = state.ftp;
    try { plans = VBT.storage.listPlans ? await VBT.storage.listPlans() : []; } catch (e) { plans = []; }
    await loadPlan(state.planSlug);
  }

  async function loadPlan(slug) {
    try { plan = await VBT.storage.loadPlan(slug); } catch (e) { plan = { weeks: [], dayOffsets: [] }; }
    bump();
  }

  function save() {
    VBT.storage.saveProfile(state).catch(() => { /* offline: blijft in geheugen tot de volgende save */ });
    bump();
  }

  // ander plan: de startdatum van het huidige plan wordt onthouden (settings.planStarts), zodat terugwisselen
  // niets kost; afgevinkte workouts blijven bewaard (ids zijn per plan uniek)
  async function switchPlan(slug, startDate) {
    const starts = Object.assign({}, VBT.settings.values.planStarts || {}, { [state.planSlug]: state.startDate });
    VBT.settings.save({ planStarts: starts });
    state.planSlug = slug;
    state.startDate = startDate || starts[slug] || nextMonday();
    save();
    await loadPlan(slug);
    VBT.store.log('save', 'Active plan: ' + (plan.name || slug) + ' from ' + state.startDate);
  }

  function setStartDate(date) { if (date) { state.startDate = date; save(); } }

  const dateFor = wo => {
    const d = parse(state.startDate);
    d.setDate(d.getDate() + (wo.week - 1) * 7 + plan.dayOffsets[wo.day - 1]);
    return d;
  };
  const isoFor = wo => iso(dateFor(wo));

  function markDone(id, result) {
    state.done[id] = Object.assign({ date: iso(new Date()) }, result);
    save();
  }

  function toggleDone(id) {
    if (state.done[id]) delete state.done[id];
    else state.done[id] = { date: iso(new Date()), avgW: 0, score: 0 };
    save();
  }

  // FTP (50-600 W) instellen; geldt direct, ook midden in een workout
  function setFtp(value) {
    state.ftp = Math.max(50, Math.min(600, parseInt(value, 10) || 180));
    VBT.cfg.rider.ftp = state.ftp;
    save();
    return state.ftp;
  }

  // vandaag: workout van vandaag, of de eerstvolgende (rustdag / plan nog niet begonnen / klaar)
  function today() {
    const t = iso(new Date());
    const items = plan.weeks.flat().filter(w => !w.rest);
    const todays = items.find(w => isoFor(w) === t) || null;
    const next = items.find(w => !state.done[w.id] && isoFor(w) >= t && w !== todays) || null;
    const firstOpen = items.find(w => !state.done[w.id]) || null;
    let status = 'rest';
    if (!items.length) status = 'none';
    else if (todays) status = state.done[todays.id] ? 'done' : 'workout';
    else if (t < isoFor(items[0])) status = 'before';
    else if (!next) status = firstOpen ? 'behind' : 'finished';
    const weekIdx = Math.floor((parse(t) - parse(state.startDate)) / (7 * 86400000));
    return { status, today: todays, next: next || (status === 'behind' ? firstOpen : null),
      week: Math.max(0, Math.min(plan.weeks.length, weekIdx + 1)) };
  }

  const find = id => plan.weeks.flat().find(w => w.id === id);

  function getState() {
    const ids = plan.weeks.flat().filter(w => !w.rest).map(w => w.id);
    return { version, ftp: state.ftp, planSlug: state.planSlug, startDate: state.startDate, done: state.done, plan, plans,
      doneCount: ids.filter(id => state.done[id]).length, total: ids.length };
  }

  async function init() { await load(); }

  return { init, getState, version: () => version, switchPlan, setStartDate, dateFor, isoFor, markDone, toggleDone,
    setFtp, today, find, nextMonday, iso, minutes: s => Math.round(s / 60) + ' MIN', ftp: () => state.ftp };
})();
