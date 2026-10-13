// Trainingskalender: het plan (uit de database, /api/vbt/plans) op echte datums, FTP + startdatum instelbaar,
// voltooide workouts afvinken. Toont ook de details van workouts uit de bibliotheek (library.js).
VBT.calendar = (function () {
  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const DEFAULT_PLAN = 'ftp-builder';
  let plan = { weeks: [], dayOffsets: [] }, plans = [];
  const $ = id => document.getElementById(id);
  let state = {}, selected = null, onRide = null;

  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const label = d => DAYS[(d.getDay() + 6) % 7] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  const minutes = s => Math.round(s / 60) + ' MIN';

  function thisMonday() {
    const d = new Date();
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return iso(d);
  }

  async function load() {
    try { state = (await VBT.storage.loadProfile()) || {}; } catch (e) { state = {}; }
    state = { ftp: state.ftp, planSlug: state.planSlug, startDate: state.startDate || state.planStart, done: state.done || state.planDone };
    state.ftp = state.ftp || 180;
    state.planSlug = state.planSlug || DEFAULT_PLAN;
    state.startDate = state.startDate || thisMonday();
    state.done = state.done || {};
    VBT.cfg.rider.ftp = state.ftp;
    try { plans = VBT.storage.listPlans ? await VBT.storage.listPlans() : []; } catch (e) { plans = []; }
    await loadPlan(state.planSlug);
  }

  async function loadPlan(slug) {
    try { plan = await VBT.storage.loadPlan(slug); } catch (e) { plan = { weeks: [], dayOffsets: [] }; /* geen plan: lege kalender */ }
  }

  // ander plan kiezen: voltooide workouts blijven bewaard (ids zijn per plan uniek), startdatum is gedeeld
  async function switchPlan(slug) {
    state.planSlug = slug;
    save();
    await loadPlan(slug);
    $('planSource').href = plan.source || '#';
    preselect(); render();
  }

  function save() {
    VBT.storage.saveProfile(state).catch(() => { /* offline: blijft in geheugen tot de volgende save */ });
  }

  function dateFor(wo) {
    const d = parse(state.startDate);
    d.setDate(d.getDate() + (wo.week - 1) * 7 + plan.dayOffsets[wo.day - 1]);
    return d;
  }

  function chart(wo, W, H, cls) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    if (cls) c.className = cls;
    VBT.workout.drawChart(c.getContext('2d'), wo, W, H);
    return c;
  }

  function card(wo) {
    const el = document.createElement('button');
    const date = dateFor(wo), today = iso(new Date());
    el.className = 'wcard' + (wo.rest ? ' rest' : '') + (state.done[wo.id] ? ' done' : '') +
      (iso(date) === today ? ' today' : '') + (selected === wo ? ' selected' : '') +
      (!wo.rest && !state.done[wo.id] && iso(date) < today ? ' missed' : '');
    el.innerHTML = '<span class="wdate">' + label(date) + '</span><b>' + wo.name.toUpperCase() + '</b>' +
      (wo.rest ? '' : '<span class="wmeta">' + minutes(wo.duration) + ' · TSS ' + VBT.workout.tss(wo) + '</span>');
    if (!wo.rest) el.appendChild(chart(wo, 150, 32, 'wmini'));
    if (state.done[wo.id]) el.insertAdjacentHTML('beforeend', '<i class="wcheck">&#10003;</i>');
    if (!wo.rest) el.onclick = () => { selected = wo; render(); };
    return el;
  }

  function render() {
    const grid = $('planGrid');
    grid.innerHTML = '';
    plan.weeks.forEach((days, wi) => {
      const row = document.createElement('div');
      row.className = 'wrow';
      row.innerHTML = '<span class="wlabel">WEEK ' + (wi + 1) + '</span>';
      for (let dow = 0; dow < 7; dow++) {
        const di = plan.dayOffsets.indexOf(dow);
        if (di >= 0) row.appendChild(card(days[di]));
        else row.insertAdjacentHTML('beforeend', '<span class="wempty"></span>');
      }
      grid.appendChild(row);
    });
    const ids = plan.weeks.flat().filter(w => !w.rest).map(w => w.id);
    const done = ids.filter(id => state.done[id]).length, total = ids.length;
    $('planWeeks').textContent = plan.weeks.length + '-WEEK PLAN';
    $('planTitle').textContent = (plan.name || 'TRAINING PLAN').toUpperCase();
    $('planProgress').textContent = done + ' / ' + total + ' DONE';
    renderDetail();
  }

  function renderDetail() {
    const box = $('planDetail');
    if (!selected) { box.innerHTML = '<p class="hint">Pick a workout from the calendar.</p>'; return; }
    const wo = selected, inPlan = !!wo.week, res = inPlan && state.done[wo.id];
    const where = inPlan ? 'WEEK ' + wo.week + ' · DAY ' + wo.day + ' · ' + label(dateFor(wo))
      : 'LIBRARY · ' + (wo.source === 'zwo' ? 'IMPORTED .ZWO' : String(wo.source || '').toUpperCase());
    box.innerHTML = '<div class="dhead"><div><small>' + where + '</small>' +
      '<h3>' + wo.name.toUpperCase() + '</h3><span>' + minutes(wo.duration) + ' · TSS ' + VBT.workout.tss(wo) +
      (wo.free ? ' · FREE RIDE' : ' · ERG') + '</span>' +
      (res ? '<span class="dres">&#10003; ' + res.date + ' · ' + res.avgW + ' W AVG · CADENCE ' + res.score + '%</span>' : '') +
      '</div><div class="dbtns"><button id="planUndo" class="ghostbtn"></button><button id="planRide" class="ridebtn">RIDE &#9654;</button></div></div>';
    const big = chart(wo, 900, 110, 'dchart');
    big.title = 'Click an interval to start the ride there';
    big.onclick = e => {
      if (!wo.steps.length || !onRide) return;
      onRide(wo, VBT.workout.stepAtFraction(wo, e.offsetX / big.clientWidth));
    };
    box.appendChild(big);
    $('planUndo').hidden = !inPlan;
    $('planUndo').textContent = res ? 'UNMARK' : 'MARK DONE';
    $('planUndo').onclick = () => {
      if (res) delete state.done[wo.id];
      else state.done[wo.id] = { date: iso(new Date()), avgW: 0, score: 0 };
      save(); render();
    };
    $('planRide').onclick = () => onRide && onRide(wo);
  }

  function markDone(id, result) {
    state.done[id] = Object.assign({ date: iso(new Date()) }, result);
    save();
  }

  // eerstvolgende niet-voltooide workout vanaf vandaag voorselecteren
  function preselect() {
    const today = iso(new Date());
    const all = plan.weeks.flat().filter(w => !w.rest);
    if (!all.length) { selected = null; return; }
    selected = all.find(w => !state.done[w.id] && iso(dateFor(w)) >= today) || all.find(w => !state.done[w.id]) || all[0];
  }

  async function init(rideHandler) {
    onRide = rideHandler;
    await load();
    $('planFtp').value = state.ftp;
    $('planStart').value = state.startDate;
    $('planFtp').onchange = e => { e.target.value = setFtp(e.target.value); };
    $('planStart').onchange = e => { if (e.target.value) { state.startDate = e.target.value; save(); render(); } };
    const sel = $('planSelect');
    sel.innerHTML = '';
    (plans.length ? plans : [{ slug: state.planSlug, name: plan.name || 'Training plan' }]).forEach(p => {
      sel.add(new Option(p.name.toUpperCase(), p.slug, false, p.slug === state.planSlug));
    });
    sel.onchange = e => switchPlan(e.target.value);
    if (plan.source) $('planSource').href = plan.source;
    preselect();
  }

  // FTP (50-600 W) instellen; ook vanuit het Settings-paneel. Geldt direct, ook midden in een workout.
  function setFtp(value) {
    state.ftp = Math.max(50, Math.min(600, parseInt(value, 10) || 180));
    VBT.cfg.rider.ftp = state.ftp;
    $('planFtp').value = state.ftp;
    save();
    if (document.body.dataset.state === 'plan') render();
    return state.ftp;
  }

  function open() { preselect(); render(); }

  // workout uit de bibliotheek tonen in het detailpaneel
  function select(wo) { selected = wo; renderDetail(); }
  const find = id => plan.weeks.flat().find(w => w.id === id);

  return { init, open, markDone, select, find, chart, minutes, setFtp, ftp: () => state.ftp };
})();
