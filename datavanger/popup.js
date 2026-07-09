// popup.js v8 — HomePlatform push
var D = {};
var SEL = new Set();
var HP = { url: '', key: '' };
var LOG = [];

var $ = function(id) { return document.getElementById(id); };

var KNOWN_COMPS = {
  'Meisjes O14 Lente · Super': {
    ids: ['179035','179036','179037','179038','179039'],
    pouleLabels: ['Poule A','Poule B','Poule C','Poule D','Poule E'],
    label: 'NK Hockey MO14 Lente Super'
  },
  'Jongens O14 Lente · Super': {
    ids: ['179024','179025','179026','179027','179028'],
    pouleLabels: ['Poule A','Poule B','Poule C','Poule D','Poule E'],
    label: 'NK Hockey JO14 Lente Super'
  }
};
var KNOWN_FULL_COMPS = {
  'comp_22': { label: 'Landelijk Meisjes O16' },
  'comp_21': { label: 'Landelijk Jongens O16' }
};

// ══════════════════════════════════════
// HELPERS
// ══════════════════════════════════════
function toast(m) {
  var t = $('toast'); t.textContent = m; t.style.display = 'block';
  setTimeout(function() { t.style.display = 'none'; }, 2500);
}
function timeAgo(ts) {
  if (!ts) return '?';
  return new Date(ts).toLocaleString('nl-NL', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function isPoule(e) { return e && e.url && /\/poules\/\d+\/teams\/\d+/.test(e.url); }
function dateStamp() {
  var d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'_'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0');
}
function addLog(type, msg) {
  LOG.unshift({ time: new Date().toLocaleTimeString('nl-NL'), type: type, msg: msg });
  if (LOG.length > 50) LOG.pop();
  renderLog();
}

// ══════════════════════════════════════
// TABS
// ══════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-tab') === tab);
  });
  $('cnt').classList.toggle('hidden', tab !== 'data');
  $('settingsPane').classList.toggle('hidden', tab !== 'settings');
  $('logPane').classList.toggle('hidden', tab !== 'log');
}

// ══════════════════════════════════════
// SETTINGS (HomePlatform config)
// ══════════════════════════════════════
function loadSettings() {
  chrome.storage.sync.get(['hp_url', 'hp_key'], function(r) {
    HP.url = (r.hp_url || '').replace(/\/$/, '');
    HP.key = r.hp_key || '';
    renderSettings();
  });
}
function saveSettings() {
  var url = ($('hpUrl').value || '').trim().replace(/\/$/, '');
  var key = ($('hpKey').value || '').trim();
  chrome.storage.sync.set({ hp_url: url, hp_key: key }, function() {
    HP.url = url; HP.key = key;
    addLog('info', 'Instellingen opgeslagen');
    toast('✅ Opgeslagen');
    renderSettings();
  });
}
function testConnection() {
  if (!HP.url || !HP.key) { toast('❌ Vul eerst URL en API key in'); return; }
  fetch(HP.url + '/api/system/health', {
    headers: { 'Authorization': 'Bearer ' + HP.key }
  })
    .then(function(r) {
      if (r.ok || r.status === 401) {
        if (r.status === 401) { toast('❌ API key ongeldig'); addLog('err', 'Test mislukt: 401 Unauthorized'); }
        else { toast('✅ Verbinding OK!'); addLog('ok', 'HomePlatform verbinding OK — ' + HP.url); }
      } else {
        toast('❌ HTTP ' + r.status); addLog('err', 'Test mislukt: HTTP ' + r.status);
      }
    })
    .catch(function(e) { toast('❌ ' + e.message); addLog('err', 'Test: ' + e.message); });
}
function renderSettings() {
  var pane = $('settingsPane');
  var configured = HP.url && HP.key;
  pane.innerHTML =
    '<div class="settings-group">' +
      '<div class="settings-label">Backend URL</div>' +
      '<input class="settings-input" id="hpUrl" value="' + escHtml(HP.url) + '" placeholder="http://192.168.30.193:8080"/>' +
      '<div class="settings-hint">HomePlatform adres, zonder trailing slash</div>' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">API Key</div>' +
      '<input class="settings-input" id="hpKey" type="password" value="' + escHtml(HP.key) + '" placeholder="je-api-key"/>' +
      '<div class="settings-hint">Admin → Account → API key aanmaken</div>' +
    '</div>' +
    '<button class="settings-save" id="hpSave">Opslaan</button>' +
    '<button class="settings-save" id="hpTest" style="background:#1e3a5f;margin-top:6px">🔗 Test verbinding</button>' +
    (configured
      ? '<div class="settings-status settings-ok">✅ Geconfigureerd: ' + escHtml(HP.url) + '</div>'
      : '<div class="settings-status settings-err">⚠️ Nog niet geconfigureerd</div>');

  setTimeout(function() {
    var s = $('hpSave'); if (s) s.addEventListener('click', saveSettings);
    var t = $('hpTest'); if (t) t.addEventListener('click', testConnection);
  }, 10);
}
function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ══════════════════════════════════════
// LOG
// ══════════════════════════════════════
function renderLog() {
  var pane = $('logPane');
  if (!pane) return;
  if (LOG.length === 0) { pane.innerHTML = '<div class="empty">Nog geen activiteit</div>'; return; }
  pane.innerHTML = LOG.map(function(l) {
    var cls = l.type === 'ok' ? 'log-ok' : l.type === 'err' ? 'log-err' : 'log-info';
    return '<div class="log-entry"><span class="log-time">' + l.time + '</span> <span class="' + cls + '">' + l.msg + '</span></div>';
  }).join('');
}

// ══════════════════════════════════════
// HOMEPLATFORM PUSH
// ══════════════════════════════════════
function pushToHomePlatform(label, data, callback) {
  if (!HP.url || !HP.key) {
    toast('❌ HomePlatform niet geconfigureerd');
    addLog('err', 'Push mislukt — geen config (zie ⚙️ tab)');
    return;
  }
  fetch(HP.url + '/api/tournix/import/hockey-nl', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + HP.key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ label: label, season: '2026-2027', data: data })
  })
    .then(function(r) {
      return r.ok ? r.json() : r.text().then(function(t) { throw new Error('HTTP ' + r.status + ': ' + t.slice(0,120)); });
    })
    .then(function(res) {
      var msg = '✅ ' + label + ' → ' + res.tournament_name +
        ' (' + res.pools + ' poules · ' + res.matches_created + ' nieuw · ' + res.matches_updated + ' bijgewerkt)';
      addLog('ok', msg);
      toast('✅ Import OK!');
      callback && callback(true, res);
    })
    .catch(function(e) {
      addLog('err', '❌ ' + label + ': ' + e.message);
      toast('❌ ' + e.message.slice(0, 60));
      callback && callback(false, null);
    });
}

function pushComp(compName) {
  var known = KNOWN_COMPS[compName];
  if (!known) return;
  var data = {};
  for (var i = 0; i < known.ids.length; i++) {
    if (D[known.ids[i]]) data[known.ids[i]] = D[known.ids[i]];
  }
  if (!Object.keys(data).length) { toast('❌ Geen data'); return; }
  toast('📤 Pushen...');
  pushToHomePlatform(known.label || compName, data, function() { render(); });
}

function pushFullComp(storeKey) {
  var entry = D[storeKey];
  var fc = KNOWN_FULL_COMPS[storeKey];
  if (!entry || !fc) return;
  var data = {}; data[storeKey] = entry;
  toast('📤 Pushen...');
  pushToHomePlatform(fc.label, data, function() {});
}

// ══════════════════════════════════════
// LOAD DATA
// ══════════════════════════════════════
function load() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tab = tabs && tabs[0];
    if (!tab || !tab.url) { $('cnt').innerHTML = '<div class="err-box">Geen tab</div>'; return; }
    var ok = tab.url.indexOf('hockey.nl') !== -1;
    $('status').innerHTML = ok ? '<span class="dot d-ok"></span>hockey.nl' : '<span class="dot d-no"></span>Ga naar hockey.nl';
    if (!ok) { $('cnt').innerHTML = '<div class="empty">🏑 Open <b>hockey.nl</b></div>'; return; }

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function() {
        try { return localStorage.getItem('__hw_poules') || localStorage.getItem('__hw_captured') || null; }
        catch(e) { return '__ERR:' + e.message; }
      }
    }, function(results) {
      if (chrome.runtime.lastError) { $('cnt').innerHTML = '<div class="err-box">' + chrome.runtime.lastError.message + '</div>'; return; }
      var raw = results && results[0] && results[0].result;
      if (!raw) { $('cnt').innerHTML = '<div class="empty">🏑 Nog geen data.<br>Navigeer naar teams in het match center.</div>'; $('info').textContent = '0'; return; }
      if (typeof raw === 'string' && raw.indexOf('__ERR:') === 0) { $('cnt').innerHTML = '<div class="err-box">' + raw + '</div>'; return; }
      try { D = JSON.parse(raw); } catch(e) { $('cnt').innerHTML = '<div class="err-box">JSON: ' + e.message + '</div>'; return; }
      render();
    });
  });
}

// ══════════════════════════════════════
// RENDER DATA TAB
// ══════════════════════════════════════
function render() {
  var all = [], compEntries = [];
  var keys = Object.keys(D);
  for (var i = 0; i < keys.length; i++) {
    if (isPoule(D[keys[i]])) all.push([keys[i], D[keys[i]]]);
    else if (D[keys[i]].type === 'competition') compEntries.push([keys[i], D[keys[i]]]);
  }
  var groups = {};
  for (var i = 0; i < all.length; i++) {
    var id = all[i][0], e = all[i][1];
    var comp = (e.competition || '') + ' · ' + (e.class_name || '');
    if (!groups[comp]) groups[comp] = [];
    groups[comp].push([id, e]);
  }
  var sortedKeys = Object.keys(groups).sort(function(a, b) {
    var aS = a.indexOf('Super') !== -1 ? 0 : 1, bS = b.indexOf('Super') !== -1 ? 0 : 1;
    return aS !== bS ? aS - bS : a.localeCompare(b);
  });

  var totalItems = all.length + compEntries.length;
  $('info').textContent = totalItems + ' items';
  var cnt = $('cnt'); cnt.innerHTML = '';
  var renderedComps = {}, renderedFullComps = {};
  var hpOk = HP.url && HP.key;

  // Poule groups (O14)
  for (var gi = 0; gi < sortedKeys.length; gi++) {
    var comp = sortedKeys[gi], entries = groups[comp];
    renderedComps[comp] = true;
    renderCompHeader(cnt, comp, entries, hpOk);
    entries.sort(function(a, b) { return (a[1].poule_name || '').localeCompare(b[1].poule_name || ''); });
    var capturedIds = {};
    for (var ei = 0; ei < entries.length; ei++) {
      capturedIds[entries[ei][0]] = true;
      renderPouleItem(cnt, entries[ei][0], entries[ei][1]);
    }
    var known = KNOWN_COMPS[comp];
    if (known) {
      for (var ki = 0; ki < known.ids.length; ki++) {
        if (!capturedIds[known.ids[ki]]) renderMissingPoule(cnt, known.ids[ki], known.pouleLabels ? known.pouleLabels[ki] : null);
      }
    }
  }

  // Empty known comps
  for (var compName in KNOWN_COMPS) {
    if (!renderedComps[compName]) {
      var known2 = KNOWN_COMPS[compName];
      renderCompHeader(cnt, compName, [], hpOk);
      for (var ki = 0; ki < known2.ids.length; ki++) renderMissingPoule(cnt, known2.ids[ki], known2.pouleLabels ? known2.pouleLabels[ki] : null);
    }
  }

  // Competition entries (O16)
  for (var ci = 0; ci < compEntries.length; ci++) {
    renderedFullComps[compEntries[ci][0]] = true;
    renderCompEntryItem(cnt, compEntries[ci][0], compEntries[ci][1], hpOk);
  }
  for (var fcKey in KNOWN_FULL_COMPS) {
    if (!renderedFullComps[fcKey]) {
      var fc = KNOWN_FULL_COMPS[fcKey];
      var hdr = document.createElement('div'); hdr.className = 'comp-hdr';
      hdr.innerHTML = '<div class="comp-hdr-left"><span class="comp-name">' + fc.label + '</span><span class="comp-badge comp-badge-empty">niet opgehaald</span></div>';
      cnt.appendChild(hdr);
      var hint = document.createElement('div'); hint.className = 'comp-hint'; hint.textContent = 'Open deze competitie op hockey.nl';
      cnt.appendChild(hint);
    }
  }

  document.querySelectorAll('.pi').forEach(function(el) { el.addEventListener('click', handlePouleClick); });
  updBtn();
}

function renderCompHeader(cnt, comp, entries, hpOk) {
  var known = KNOWN_COMPS[comp];
  var hdr = document.createElement('div'); hdr.className = 'comp-hdr';
  var left = '<span class="comp-name">' + comp + '</span>';
  if (known) {
    var have = 0;
    for (var i = 0; i < known.ids.length; i++) { if (D[known.ids[i]]) have++; }
    var complete = have === known.ids.length;
    left += '<span class="comp-badge ' + (complete ? 'comp-badge-ok' : have > 0 ? 'comp-badge-partial' : 'comp-badge-empty') + '">' +
      (complete ? '✅ ' : '⏳ ') + have + '/' + known.ids.length + '</span>';
  } else {
    left += '<span class="comp-badge comp-badge-other">' + entries.length + ' poules</span>';
  }
  var right = '';
  if (known) {
    right = '<button class="comp-dl-btn" data-comp="' + comp + '">💾</button>';
    if (hpOk) right += '<button class="comp-push-btn" data-comp="' + comp + '">📤 HP</button>';
  }
  hdr.innerHTML = '<div class="comp-hdr-left">' + left + '</div><div class="comp-hdr-right">' + right + '</div>';
  cnt.appendChild(hdr);

  var dlBtn = hdr.querySelector('.comp-dl-btn');
  if (dlBtn) dlBtn.addEventListener('click', function(evt) { evt.stopPropagation(); downloadComp(evt.target.getAttribute('data-comp')); });
  var pushBtn = hdr.querySelector('.comp-push-btn');
  if (pushBtn) pushBtn.addEventListener('click', function(evt) {
    evt.stopPropagation();
    var b = evt.target; b.disabled = true; b.textContent = '⏳';
    pushComp(b.getAttribute('data-comp'));
    setTimeout(function() { b.disabled = false; b.textContent = '📤 HP'; }, 4000);
  });
}

function renderPouleItem(cnt, id, e) {
  var played = 0, rem = 0;
  try { var ma = e.data.data.poule.matches || []; for (var mi = 0; mi < ma.length; mi++) { if (ma[mi].status === 'final') played++; else rem++; } } catch(ex) {}
  var ts = timeAgo(e.timestamp);
  var el = document.createElement('div'); el.className = 'pi' + (SEL.has(id) ? ' sel' : ''); el.setAttribute('data-id', id);
  el.innerHTML = '<div class="pi-row"><span class="pi-name">' + (e.poule_name || '?') + '</span><span class="pi-stat">📊 ' + played + '</span><span class="pi-stat">📅 ' + rem + '</span><span class="pi-via">via ' + (e.team_name || '?').replace(/ [A-Z]?O?\d+-\d+/g, '').trim() + '</span><span class="pi-ts">' + ts + '</span></div>';
  cnt.appendChild(el);
}

function renderMissingPoule(cnt, pouleId, label) {
  var el = document.createElement('div'); el.className = 'pi-missing';
  el.innerHTML = '<span class="pi-missing-name">' + (label || 'Poule ' + pouleId) + '</span><span class="pi-missing-hint">niet opgehaald</span>';
  cnt.appendChild(el);
}

function renderCompEntryItem(cnt, storeKey, entry, hpOk) {
  var fc = KNOWN_FULL_COMPS[storeKey];
  var ts = timeAgo(entry.timestamp);
  var hdr = document.createElement('div'); hdr.className = 'comp-hdr';
  var left = '<span class="comp-name">' + (entry.competition || (fc && fc.label) || storeKey) + '</span>' +
    '<span class="comp-badge comp-badge-ok">✅ ' + (entry.poule_count || '?') + ' poules</span>';
  var right = '';
  if (fc) {
    right = '<button class="comp-dl-btn" data-fcomp="' + storeKey + '">💾</button>';
    if (hpOk) right += '<button class="comp-push-btn" data-fcomp="' + storeKey + '">📤 HP</button>';
  }
  hdr.innerHTML = '<div class="comp-hdr-left">' + left + '</div><div class="comp-hdr-right">' + right + '</div>';
  cnt.appendChild(hdr);

  var dlBtn = hdr.querySelector('.comp-dl-btn');
  if (dlBtn) dlBtn.addEventListener('click', function(evt) { evt.stopPropagation(); downloadFullComp(evt.target.getAttribute('data-fcomp')); });
  var pushBtn = hdr.querySelector('.comp-push-btn');
  if (pushBtn) pushBtn.addEventListener('click', function(evt) {
    evt.stopPropagation();
    var b = evt.target; b.disabled = true; b.textContent = '⏳';
    pushFullComp(b.getAttribute('data-fcomp'));
    setTimeout(function() { b.disabled = false; b.textContent = '📤 HP'; }, 4000);
  });

  var el = document.createElement('div'); el.className = 'pi-row-static';
  el.innerHTML = '<span class="pi-stat">📊 ' + (entry.played_count || 0) + ' gespeeld</span><span class="pi-stat">📅 ' + (entry.remaining_count || 0) + ' resterend</span><span class="pi-ts">' + ts + '</span>';
  cnt.appendChild(el);
}

// ══════════════════════════════════════
// INTERACTIONS
// ══════════════════════════════════════
function handlePouleClick(evt) {
  var id = evt.currentTarget.getAttribute('data-id');
  if (SEL.has(id)) SEL.delete(id); else SEL.add(id);
  document.querySelectorAll('.pi').forEach(function(el) { el.classList.toggle('sel', SEL.has(el.getAttribute('data-id'))); });
  updBtn();
}
function selAll() {
  var ids = Object.keys(D).filter(function(k) { return isPoule(D[k]); });
  if (SEL.size === ids.length) SEL.clear(); else ids.forEach(function(k) { SEL.add(k); });
  document.querySelectorAll('.pi').forEach(function(el) { el.classList.toggle('sel', SEL.has(el.getAttribute('data-id'))); });
  updBtn();
}
function updBtn() {
  var n = SEL.size;
  $('bExp').className = n ? 'bx' : 'bx off';
  $('bJson').className = n ? 'bj' : 'bj off';
  $('bExp').textContent = n ? '📋 Kopieer ' + n : '📋 Selecteer';
}

// ══════════════════════════════════════
// EXPORT / DOWNLOAD
// ══════════════════════════════════════
function buildMC() {
  var mc = {}; var iter = SEL.values(); var next = iter.next();
  while (!next.done) {
    var id = next.value, e = D[id];
    if (e && e.data && e.data.data && e.data.data.poule && e.data.data.poule.standings) {
      var d = e.data.data, letter = d.poule.name.replace('Poule ', ''), key = letter;
      if (mc[key]) key = letter + '_' + id;
      var st = d.poule.standings, ma = d.poule.matches || [], played = [], rem = [];
      for (var i = 0; i < ma.length; i++) { if (ma[i].status === 'final') played.push(ma[i]); else rem.push(ma[i]); }
      var cl = function(n) { return n.replace(/ [A-Z]?O?\d+-\d+/g, '').trim(); };
      mc[key] = {
        poule_id: parseInt(id),
        competition: (e.competition || '') + ' · ' + (e.class_name || ''),
        teams: st.map(function(s) { return cl(s.team.name); }),
        pts: st.map(function(s) { return s.points; }),
        ds: st.map(function(s) { return s.goals_for - s.goals_against; }),
        played_count: played.length,
        remaining: rem.map(function(m) { return [cl(m.home.name), cl(m.away.name)]; }),
        standings: st.map(function(s) { return { rank:s.rank, team:cl(s.team.name), team_id:s.team.id, points:s.points, wins:s.wins, draws:s.draws, losses:s.losses, gf:s.goals_for, ga:s.goals_against, gd:s.goals_for-s.goals_against }; }),
        matches_played: played.map(function(m) { return { round:m.round, home:cl(m.home.name), away:cl(m.away.name), score:m.score.home+'-'+m.score.away }; })
      };
    }
    next = iter.next();
  }
  return mc;
}
function doExport() {
  if (!SEL.size) return;
  navigator.clipboard.writeText(JSON.stringify(buildMC(), null, 2)).then(function() { toast('✅ Gekopieerd!'); });
}
function doJson() {
  if (!SEL.size) return;
  var sel = {}; var iter = SEL.values(); var next = iter.next();
  while (!next.done) { if (D[next.value]) sel[next.value] = D[next.value]; next = iter.next(); }
  downloadFile(JSON.stringify(sel, null, 2), 'hockey_selectie_' + dateStamp() + '.json');
}
function downloadComp(compName) {
  var known = KNOWN_COMPS[compName]; if (!known) return;
  var sel = {}, count = 0;
  for (var i = 0; i < known.ids.length; i++) { if (D[known.ids[i]]) { sel[known.ids[i]] = D[known.ids[i]]; count++; } }
  if (!count) { toast('❌ Geen data'); return; }
  downloadFile(JSON.stringify(sel, null, 2), (known.label || compName).replace(/\s+/g,'_') + '_' + dateStamp() + '.json');
  toast('💾 ' + count + ' poules');
}
function downloadFullComp(storeKey) {
  var entry = D[storeKey]; var fc = KNOWN_FULL_COMPS[storeKey];
  if (!entry) { toast('❌ Geen data'); return; }
  var exp = {}; exp[storeKey] = entry;
  downloadFile(JSON.stringify(exp, null, 2), (fc ? fc.label : storeKey).replace(/\s+/g,'_') + '_' + dateStamp() + '.json');
}
function downloadFile(content, filename) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  a.download = filename; a.click();
}
function doClear() {
  if (!confirm('Alle data wissen?')) return;
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0]) return;
    chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, func: function() { localStorage.removeItem('__hw_poules'); localStorage.removeItem('__hw_captured'); }
    }, function() { D = {}; SEL.clear(); render(); toast('🗑️ Gewist'); addLog('info', 'Data gewist'); });
  });
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { switchTab(btn.getAttribute('data-tab')); });
  });
  $('bAll').addEventListener('click', selAll);
  $('bExp').addEventListener('click', doExport);
  $('bJson').addEventListener('click', doJson);
  $('bRefresh').addEventListener('click', load);
  $('bClear').addEventListener('click', doClear);
  loadSettings();
  renderLog();
  load();
});
