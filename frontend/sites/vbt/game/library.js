// Workoutbibliotheek (tab LIBRARY in het planscherm): alle workouts uit de database + Climb Training, .zwo importeren
// (knop of bestanden op het scherm slepen), eigen imports verwijderen. Detail + RIDE via het kalenderpaneel.
VBT.library = (function () {
  const $ = id => document.getElementById(id);
  const GROUPS = { zwo: 'MY IMPORTS', 'ftp-builder': 'FTP BUILDER' };
  let items = [], climbs = [];

  const toast = (text, ms) => VBT.toast && VBT.toast(text, ms);

  async function load() {
    try { items = await VBT.storage.listWorkouts(); } catch (e) { items = []; }
    climbs = await VBT.climbs.load();
    render();
  }

  function card(wo) {
    const el = document.createElement('button');
    el.className = 'wcard libcard';
    el.innerHTML = '<span class="wdate">' + (GROUPS[wo.source] || String(wo.source).toUpperCase()) + '</span><b>' +
      wo.name.toUpperCase() + '</b><span class="wmeta">' + VBT.calendar.minutes(wo.duration) + ' · TSS ' + VBT.workout.tss(wo) + '</span>';
    el.appendChild(VBT.calendar.chart(wo, 150, 32, 'wmini'));
    el.onclick = () => { highlight(el); VBT.calendar.select(wo); };
    if (wo.mine) {
      const del = document.createElement('i');
      del.className = 'wdel';
      del.title = 'Delete';
      del.innerHTML = '&#10005;';
      del.onclick = e => { e.stopPropagation(); remove(wo); };
      el.appendChild(del);
    }
    return el;
  }

  function highlight(el) {
    document.querySelectorAll('.libcard.selected').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  }

  function render() {
    const grid = $('libGrid');
    grid.innerHTML = '';
    if (!items.length) grid.innerHTML = '<p class="hint">No workouts yet - import a .zwo file.</p>';
    // eigen imports eerst, daarna per bron
    const sources = [...new Set(items.map(w => w.source))].sort((a, b) => (a === 'zwo' ? -1 : b === 'zwo' ? 1 : a.localeCompare(b)));
    for (const src of sources) {
      grid.insertAdjacentHTML('beforeend', '<h4 class="libhead">' + (GROUPS[src] || String(src).toUpperCase()) + '</h4>');
      const row = document.createElement('div');
      row.className = 'libgrid';
      items.filter(w => w.source === src).forEach(w => row.appendChild(card(w)));
      grid.appendChild(row);
    }
    if (climbs.length) {
      grid.insertAdjacentHTML('beforeend', '<h4 class="libhead">CLIMB TRAINING <small>SIM · ZWIFT CLIMB PORTALS</small></h4>');
      const row = document.createElement('div');
      row.className = 'libgrid';
      climbs.forEach(cl => row.appendChild(VBT.climbs.card(cl, (el, c) => { highlight(el); VBT.climbs.select(c); })));
      grid.appendChild(row);
    }
  }

  async function importFiles(fileList) {
    const files = [...fileList].filter(f => /\.zwo$/i.test(f.name));
    if (!files.length) { toast('ONLY .ZWO FILES CAN BE IMPORTED'); return; }
    try {
      const r = await VBT.storage.importZwo(files);
      $('libMsg').innerHTML = r.skipped.map(s => '<div>&#9888; ' + s.file + ': ' + s.reason + '</div>').join('');
      toast('IMPORTED ' + r.imported.length + (r.skipped.length ? ' · SKIPPED ' + r.skipped.length : ''));
      await load();
      if (r.imported[0]) VBT.calendar.select(r.imported[0]);
    } catch (e) {
      toast('IMPORT FAILED: ' + e.message, 6000);
    }
  }

  async function remove(wo) {
    if (!window.confirm('Delete "' + wo.name + '" from your library?')) return;
    try { await VBT.storage.deleteWorkout(wo.id); } catch (e) { toast(e.message, 6000); return; }
    load();
  }

  // tabs van het planscherm: plan | lib | rides
  function show(tab) {
    $('plan').dataset.tab = tab;
    $('tabPlan').classList.toggle('active', tab === 'plan');
    $('tabLib').classList.toggle('active', tab === 'lib');
    $('tabRides').classList.toggle('active', tab === 'rides');
    if (tab === 'lib') load();
    if (tab === 'rides') VBT.rides.load();
  }

  function init() {
    if (!VBT.storage.listWorkouts) { $('tabLib').hidden = true; return; }   // losse versie zonder server
    $('tabPlan').onclick = () => show('plan');
    $('tabLib').onclick = () => show('lib');
    $('tabRides').onclick = () => show('rides');
    $('ridesTrash').onclick = () => VBT.rides.toggleTrash();
    $('libImport').onchange = e => { importFiles(e.target.files); e.target.value = ''; };
    const plan = $('plan');
    plan.addEventListener('dragover', e => { e.preventDefault(); plan.classList.add('dragover'); });
    plan.addEventListener('dragleave', e => { if (e.target === plan) plan.classList.remove('dragover'); });
    plan.addEventListener('drop', e => {
      e.preventDefault();
      plan.classList.remove('dragover');
      show('lib');
      importFiles(e.dataTransfer.files);
    });
    show('plan');
  }

  return { init, load, show };
})();
