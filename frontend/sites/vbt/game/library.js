// Workoutbibliotheek (tab LIBRARY in het planscherm): alle workouts uit de database, .zwo importeren
// (knop of bestanden op het scherm slepen), eigen imports verwijderen. Detail + RIDE via het kalenderpaneel.
VBT.library = (function () {
  const $ = id => document.getElementById(id);
  const GROUPS = { zwo: 'MY IMPORTS', 'ftp-builder': 'FTP BUILDER' };
  let items = [];

  const toast = (text, ms) => VBT.toast && VBT.toast(text, ms);

  async function load() {
    try { items = await VBT.storage.listWorkouts(); } catch (e) { items = []; }
    render();
  }

  function card(wo) {
    const el = document.createElement('button');
    el.className = 'wcard libcard';
    el.innerHTML = '<span class="wdate">' + (GROUPS[wo.source] || String(wo.source).toUpperCase()) + '</span><b>' +
      wo.name.toUpperCase() + '</b><span class="wmeta">' + VBT.calendar.minutes(wo.duration) + ' · TSS ' + VBT.workout.tss(wo) + '</span>';
    el.appendChild(VBT.calendar.chart(wo, 150, 32, 'wmini'));
    el.onclick = () => {
      document.querySelectorAll('.libcard.selected').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      VBT.calendar.select(wo);
    };
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

  function render() {
    const grid = $('libGrid');
    grid.innerHTML = '';
    if (!items.length) { grid.innerHTML = '<p class="hint">No workouts yet - import a .zwo file.</p>'; return; }
    // eigen imports eerst, daarna per bron
    const sources = [...new Set(items.map(w => w.source))].sort((a, b) => (a === 'zwo' ? -1 : b === 'zwo' ? 1 : a.localeCompare(b)));
    for (const src of sources) {
      grid.insertAdjacentHTML('beforeend', '<h4 class="libhead">' + (GROUPS[src] || String(src).toUpperCase()) + '</h4>');
      const row = document.createElement('div');
      row.className = 'libgrid';
      items.filter(w => w.source === src).forEach(w => row.appendChild(card(w)));
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

  function show(tab) {
    $('plan').dataset.tab = tab;
    $('tabPlan').classList.toggle('active', tab !== 'lib');
    $('tabLib').classList.toggle('active', tab === 'lib');
    if (tab === 'lib') load();
  }

  function init() {
    if (!VBT.storage.listWorkouts) { $('tabLib').hidden = true; return; }   // losse versie zonder server
    $('tabPlan').onclick = () => show('plan');
    $('tabLib').onclick = () => show('lib');
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
