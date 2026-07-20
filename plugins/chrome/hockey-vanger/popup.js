// popup.js v9.8 — real-time log (329), missing nav poules (324)
var D = {};
var HP = { url: '', key: '', delayMin: 10000, delayMax: 15000 };
var LOG = [];
var COVERAGE_BY_LABEL = {};
var COVERAGE_LOADED = false;
var CONFIG = [];
var CONFIG_LOADED = false;
var SUGGESTIONS = {};     // comp-groepnaam → {tournament_id, phase_id, tournament_name, phase_name, score, matched}
var SUGGESTIONS_LOADED = false;
var SESSION_ID = null;    // UUID voor deze popup-sessie, aangemaakt bij eerste archivering

var $ = function(id) { return document.getElementById(id); };

// KNOWN_COMPS en KNOWN_FULL_COMPS zijn vervangen door suggest-match (item 317)
var KNOWN_COMPS = {};
var KNOWN_FULL_COMPS = {};
var _autoRefreshTimer = null;
var _queue = { running: false, preview: false, items: [], currentIdx: 0, countdownMs: 0, tabId: null, tickTimer: null, stepTimer: null };
var _excluded = {}; // keyed by pouleId → true, persisted in chrome.storage.sync

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
function addLog(type, msg, detail) {
  var entry = { time: new Date().toLocaleTimeString('nl-NL'), type: type, msg: msg };
  if (detail) entry.detail = detail;
  LOG.unshift(entry);
  if (LOG.length > 200) LOG.pop();
  renderLog();
}

// Geeft true als de groep nieuwere captures heeft dan de laatste import op de server
function groupHasNewData(entries, label) {
  if (!entries || !entries.length) return false;
  var maxTs = 0;
  for (var i = 0; i < entries.length; i++) {
    var ts = entries[i][1].timestamp || 0;
    if (ts > maxTs) maxTs = ts;
  }
  if (!maxTs) return true;
  var lastImportStr = label && COVERAGE_BY_LABEL[label] ? COVERAGE_BY_LABEL[label].last_import : null;
  if (!lastImportStr) return true;
  return maxTs > new Date(lastImportStr).getTime();
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
  $('capturePane').classList.toggle('hidden', tab !== 'capture');
}

// ══════════════════════════════════════
// SETTINGS (HomePlatform config)
// ══════════════════════════════════════
function loadSettings() {
  chrome.storage.sync.get(['hp_url', 'hp_key', 'hw_delay_min', 'hw_delay_max', 'hw_excluded'], function(r) {
    HP.url = (r.hp_url || '').replace(/\/$/, '');
    HP.key = r.hp_key || '';
    HP.delayMin = r.hw_delay_min ? parseInt(r.hw_delay_min) * 1000 : 10000;
    HP.delayMax = r.hw_delay_max ? parseInt(r.hw_delay_max) * 1000 : 15000;
    _excluded = r.hw_excluded || {};
    renderSettings();
    loadConfig();
    loadCoverage();
  });
}
function loadConfig() {
  if (!HP.url || !HP.key) return;
  fetch(HP.url + '/api/tournix/import/config?season=2026-2027', {
    headers: { 'Authorization': 'Bearer ' + HP.key }
  })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(res) {
      if (!res || !res.entries) { addLog('err', '[BE] config: geen entries'); return; }
      CONFIG = res.entries;
      CONFIG_LOADED = true;
      addLog('info', '[BE] config: ' + CONFIG.length + ' entries geladen');
      render();
    })
    .catch(function(e) { addLog('err', '[BE] config fout: ' + e.message); });
}
function loadCoverage() {
  if (!HP.url || !HP.key) return;
  fetch(HP.url + '/api/tournix/import/coverage?season=2026-2027', {
    headers: { 'Authorization': 'Bearer ' + HP.key }
  })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(res) {
      if (!res) return;
      COVERAGE_BY_LABEL = {};
      for (var i = 0; i < res.tournaments.length; i++) {
        var t = res.tournaments[i];
        var poolsMap = {};
        for (var j = 0; j < t.pools.length; j++) poolsMap[t.pools[j].name] = t.pools[j];
        COVERAGE_BY_LABEL[t.tournament_name] = { pools: poolsMap, last_import: t.last_import, pool_count: t.pool_count };
      }
      COVERAGE_LOADED = true;
      addLog('info', '[BE] coverage: ' + res.tournaments.length + ' toernooien');
      render();
    })
    .catch(function(e) { addLog('err', '[BE] coverage fout: ' + e.message); });
}
function loadSuggestions() {
  if (!HP.url || !HP.key) return;
  var groupTeams = {};
  var keys = Object.keys(D);
  for (var i = 0; i < keys.length; i++) {
    var entry = D[keys[i]];
    if (!isPoule(entry)) continue;
    var comp = (entry.competition || '') + ' · ' + (entry.class_name || '');
    if (!groupTeams[comp]) groupTeams[comp] = [];
    try {
      var standings = entry.data.data.poule.standings || [];
      for (var j = 0; j < standings.length; j++) {
        groupTeams[comp].push(standings[j].team.name);
      }
    } catch(e) {}
  }
  var groups = [];
  for (var comp in groupTeams) {
    if (groupTeams[comp].length > 0) groups.push({ key: comp, teams: groupTeams[comp] });
  }
  if (!groups.length) return;
  fetch(HP.url + '/api/tournix/import/suggest-match', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + HP.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ season: '2026-2027', groups: groups })
  })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(res) {
      if (!res || !res.suggestions) { addLog('err', '[BE] suggest: geen response'); return; }
      SUGGESTIONS = res.suggestions;
      SUGGESTIONS_LOADED = true;
      var keys = Object.keys(SUGGESTIONS);
      if (keys.length) {
        for (var si = 0; si < keys.length; si++) {
          var s = SUGGESTIONS[keys[si]];
          addLog('ok', '[BE] match: "' + keys[si] + '" → ' + s.tournament_name + ' · ' + s.phase_name + ' (' + Math.round(s.score * 100) + '%)', {
            match: s.tournament_name + ' · ' + s.phase_name + ' | score: ' + Math.round(s.score * 100) + '% (' + s.matched + '/' + s.total + ' teams)'
          });
        }
      } else {
        addLog('info', '[BE] suggest: geen matches gevonden voor ' + groups.length + ' groepen');
      }
      render();
    })
    .catch(function(e) { addLog('err', '[BE] suggest fout: ' + e.message); });
}

function getOrCreateSessionId(cb) {
  if (!SESSION_ID) {
    SESSION_ID = 'hwv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }
  cb(SESSION_ID);
}

function archiveCaptures() {
  if (!HP.url || !HP.key) return;
  var items = [];
  var keys = Object.keys(D);
  for (var i = 0; i < keys.length; i++) {
    var entry = D[keys[i]];
    if (!isPoule(entry)) continue;
    var pouleData = null;
    try { pouleData = entry.data.data.poule; } catch(e) {}
    if (!pouleData) continue;
    var standings = pouleData.standings || [];
    var matches = pouleData.matches || [];
    var played = 0, remaining = 0;
    for (var mi = 0; mi < matches.length; mi++) {
      if (matches[mi].status === 'final') played++; else remaining++;
    }
    var teams = [];
    for (var si = 0; si < standings.length; si++) {
      try { teams.push(standings[si].team.name); } catch(e2) {}
    }
    items.push({
      external_id: String(keys[i]),
      capture_type: 'poule',
      payload: entry.data,
      meta: {
        poule_id: keys[i],
        poule_name: entry.poule_name || null,
        competition: entry.competition || null,
        class_name: entry.class_name || null,
        via_team: entry.team_name || null,
        team_count: standings.length,
        teams: teams,
        matches_played: played,
        matches_remaining: remaining,
      }
    });
  }
  if (!items.length) return;
  getOrCreateSessionId(function(sid) {
    fetch(HP.url + '/api/capture/archive', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + HP.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'hockey-vanger', session_id: sid, items: items })
    })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(res) {
        if (res && res.created > 0) {
          addLog('info', '[Archief] ' + res.created + ' nieuwe poules gearchiveerd (sessie: ' + sid.slice(-6) + ')');
        }
      })
      .catch(function() {});
  });
}

function saveSettings() {
  var url = ($('hpUrl').value || '').trim().replace(/\/$/, '');
  var key = ($('hpKey').value || '').trim();
  var dmin = Math.max(3, parseInt(($('hwDelayMin') || {}).value) || 10);
  var dmax = Math.max(dmin, parseInt(($('hwDelayMax') || {}).value) || 15);
  chrome.storage.sync.set({ hp_url: url, hp_key: key, hw_delay_min: dmin, hw_delay_max: dmax }, function() {
    HP.url = url; HP.key = key; HP.delayMin = dmin * 1000; HP.delayMax = dmax * 1000;
    addLog('info', 'Instellingen opgeslagen');
    toast('✅ Opgeslagen');
    renderSettings();
  });
}
function testConnection() {
  if (!HP.url || !HP.key) { toast('❌ Vul eerst URL en API key in'); return; }
  fetch(HP.url + '/api/health', {
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
    '<div class="settings-group">' +
      '<div class="settings-label">Capture vertraging (seconden)</div>' +
      '<div style="display:flex;gap:8px">' +
        '<div style="flex:1"><div class="settings-hint" style="margin-bottom:3px">Min</div>' +
        '<input class="settings-input" id="hwDelayMin" type="number" value="' + Math.round(HP.delayMin / 1000) + '" min="3" max="120"/></div>' +
        '<div style="flex:1"><div class="settings-hint" style="margin-bottom:3px">Max</div>' +
        '<input class="settings-input" id="hwDelayMax" type="number" value="' + Math.round(HP.delayMax / 1000) + '" min="3" max="120"/></div>' +
      '</div>' +
      '<div class="settings-hint">Tussenpoze per klik (standaard 10–15 sec)</div>' +
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
function clearLog() {
  LOG = [];
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tab = tabs && tabs[0];
    if (tab && tab.url && tab.url.indexOf('hockey.nl') !== -1) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function() { try { localStorage.removeItem('__hw_log'); } catch(e) {} }
      });
    }
    renderLog();
  });
}
function renderLog() {
  var pane = $('logPane');
  if (!pane) return;
  if (LOG.length === 0) { pane.innerHTML = '<div class="empty">Nog geen activiteit</div>'; return; }
  var topbar = '<div class="log-topbar"><span class="log-ct">' + LOG.length + ' entries</span>' +
    '<button class="log-clear-btn" id="logClearBtn">🗑️ Leegmaken</button></div>';
  var html = topbar + LOG.map(function(l, idx) {
    var cls = l.type === 'ok' ? 'log-ok' : l.type === 'err' ? 'log-err' : 'log-info';
    var detail = '';
    if (l.detail) {
      var d = l.detail;
      var rows = '';
      if (d.teams && d.teams.length) rows += '<div class="log-detail-teams">' + d.teams.join(', ') + '</div>';
      if (d.match) rows += '<div class="log-detail-match">→ ' + d.match + '</div>';
      if (d.candidates) rows += '<div class="log-detail-match">' + d.candidates + '</div>';
      detail = '<div class="log-detail" id="ld' + idx + '" style="display:none">' + rows + '</div>';
    }
    var toggle = l.detail ? '<span class="log-expand" data-idx="' + idx + '">▶</span> ' : '';
    return '<div class="log-entry">' + toggle + '<span class="log-time">' + l.time + '</span> <span class="' + cls + '">' + escHtml(l.msg) + '</span>' + detail + '</div>';
  }).join('');
  pane.innerHTML = html;
  var clrBtn = $('logClearBtn');
  if (clrBtn) clrBtn.addEventListener('click', clearLog);
  pane.querySelectorAll('.log-expand').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var det = $('ld' + btn.getAttribute('data-idx'));
      if (!det) return;
      var open = det.style.display !== 'none';
      det.style.display = open ? 'none' : 'block';
      btn.textContent = open ? '▶' : '▼';
    });
  });
}

function refreshLogOnly() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tab = tabs && tabs[0];
    if (!tab || tab.url.indexOf('hockey.nl') === -1) return;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function() { try { return localStorage.getItem('__hw_log') || '[]'; } catch(e) { return '[]'; } }
    }, function(r2) {
      var raw2 = r2 && r2[0] && r2[0].result;
      try {
        var entries = JSON.parse(raw2 || '[]');
        var added = 0;
        for (var li = 0; li < entries.length; li++) {
          var e2 = entries[li];
          var t = new Date(e2.ts).toLocaleTimeString('nl-NL');
          if (!LOG.find(function(l) { return l.msg === e2.msg && l.time === t; })) {
            LOG.unshift({ time: t, type: e2.type, msg: '[vangt] ' + e2.msg, detail: e2.detail });
            added++;
          }
        }
        if (added > 0) {
          LOG.sort(function(a, b) { return b.time.localeCompare(a.time); });
          if (LOG.length > 200) LOG.length = 200;
          renderLog();
        }
      } catch(ex) {}
    });
  });
}

// ══════════════════════════════════════
// HOMEPLATFORM PUSH
// ══════════════════════════════════════
function pushToHomePlatform(label, data, tournamentId, phaseId, callback) {
  if (!HP.url || !HP.key) {
    toast('❌ HomePlatform niet geconfigureerd');
    addLog('err', 'Push mislukt — geen config (zie ⚙️ tab)');
    return;
  }
  var body = { label: label, season: '2026-2027', data: data };
  if (tournamentId) body.tournament_id = tournamentId;
  if (phaseId) body.phase_id = phaseId;
  fetch(HP.url + '/api/tournix/import/hockey-nl', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + HP.key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
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
  var effectiveKnown = CONFIG_LOADED && CONFIG.length > 0 ? buildEffectiveKnown() : KNOWN_COMPS;
  var known = effectiveKnown[compName];
  var suggestion = SUGGESTIONS[compName];

  var data = {};
  if (known) {
    for (var i = 0; i < known.ids.length; i++) {
      if (D[known.ids[i]]) data[known.ids[i]] = D[known.ids[i]];
    }
  } else {
    var keys = Object.keys(D);
    for (var ki = 0; ki < keys.length; ki++) {
      var e = D[keys[ki]];
      if (isPoule(e) && (e.competition || '') + ' · ' + (e.class_name || '') === compName) {
        data[keys[ki]] = e;
      }
    }
  }
  if (!Object.keys(data).length) { toast('❌ Geen data'); return; }

  var tid = null, pid = null;
  if (CONFIG_LOADED) {
    for (var ci3 = 0; ci3 < CONFIG.length; ci3++) {
      if (CONFIG[ci3].capture_group === compName) { tid = CONFIG[ci3].tournament_id; pid = CONFIG[ci3].phase_id; break; }
    }
  }
  if (!tid && suggestion) { tid = suggestion.tournament_id; pid = suggestion.phase_id; }

  var label = (known && known.label) || (suggestion && suggestion.tournament_name) || compName;
  toast('📤 Pushen...');
  pushToHomePlatform(label, data, tid, pid, function() { render(); loadCoverage(); });
}

function buildEffectiveKnown() {
  var ek = {};
  for (var i = 0; i < CONFIG.length; i++) {
    var cfg = CONFIG[i];
    if (cfg.capture_type === 'poule' && cfg.capture_group)
      ek[cfg.capture_group] = { ids: cfg.capture_ids || [], pouleLabels: cfg.capture_labels || [], label: cfg.tournament_name };
  }
  return ek;
}
function buildEffectiveFullComps() {
  var ef = {};
  for (var i = 0; i < CONFIG.length; i++) {
    var cfg = CONFIG[i];
    if (cfg.capture_type === 'full' && cfg.capture_ids && cfg.capture_ids[0])
      ef[cfg.capture_ids[0]] = { label: cfg.tournament_name };
  }
  return ef;
}
function pushFullComp(storeKey) {
  var entry = D[storeKey];
  var fc = (CONFIG_LOADED && CONFIG.length > 0 ? buildEffectiveFullComps() : KNOWN_FULL_COMPS)[storeKey];
  if (!entry || !fc) return;
  var data = {}; data[storeKey] = entry;
  var tid = null, pid = null;
  if (CONFIG_LOADED) {
    for (var ci4 = 0; ci4 < CONFIG.length; ci4++) {
      if (CONFIG[ci4].capture_type === 'full' && CONFIG[ci4].capture_ids && CONFIG[ci4].capture_ids[0] === storeKey) {
        tid = CONFIG[ci4].tournament_id;
        pid = CONFIG[ci4].phase_id;
        break;
      }
    }
  }
  toast('📤 Pushen...');
  pushToHomePlatform(fc.label, data, tid, pid, function() { loadCoverage(); });
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
      SUGGESTIONS = {}; SUGGESTIONS_LOADED = false;
      render();
      loadSuggestions();
      archiveCaptures();
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function() { try { return localStorage.getItem('__hw_log') || '[]'; } catch(e) { return '[]'; } }
      }, function(r2) {
        var raw2 = r2 && r2[0] && r2[0].result;
        try {
          var entries = JSON.parse(raw2 || '[]');
          for (var li = 0; li < entries.length; li++) {
            var e2 = entries[li];
            var t = new Date(e2.ts).toLocaleTimeString('nl-NL');
            if (!LOG.find(function(l) { return l.msg === e2.msg && l.time === t; })) {
              LOG.push({ time: t, type: e2.type, msg: '[vangt] ' + e2.msg });
            }
          }
          LOG.sort(function(a, b) { return b.time.localeCompare(a.time); });
        } catch(ex) {}
        renderLog();
      });
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
  var effectiveKnown = KNOWN_COMPS;
  var effectiveFullComps = KNOWN_FULL_COMPS;
  if (CONFIG_LOADED && CONFIG.length > 0) {
    effectiveKnown = {};
    effectiveFullComps = {};
    for (var ci2 = 0; ci2 < CONFIG.length; ci2++) {
      var cfg = CONFIG[ci2];
      if (cfg.capture_type === 'poule' && cfg.capture_group) {
        effectiveKnown[cfg.capture_group] = {
          ids: cfg.capture_ids || [],
          pouleLabels: cfg.capture_labels || [],
          label: cfg.tournament_name,
        };
      } else if (cfg.capture_type === 'full' && cfg.capture_ids && cfg.capture_ids[0]) {
        effectiveFullComps[cfg.capture_ids[0]] = { label: cfg.tournament_name };
      }
    }
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

  for (var gi = 0; gi < sortedKeys.length; gi++) {
    var comp = sortedKeys[gi], entries = groups[comp];
    renderedComps[comp] = true;
    var known = effectiveKnown[comp];
    var serverPools = known && COVERAGE_BY_LABEL[known.label] ? COVERAGE_BY_LABEL[known.label].pools : {};
    renderCompHeader(cnt, comp, entries, hpOk, serverPools, known);
    entries.sort(function(a, b) { return (a[1].poule_name || '').localeCompare(b[1].poule_name || ''); });
    var capturedIds = {};
    for (var ei = 0; ei < entries.length; ei++) {
      capturedIds[entries[ei][0]] = true;
      var onServer = !!(entries[ei][1].poule_name && serverPools[entries[ei][1].poule_name]);
      renderPouleItem(cnt, entries[ei][0], entries[ei][1], onServer);
    }
    if (known) {
      for (var ki = 0; ki < known.ids.length; ki++) {
        if (!capturedIds[known.ids[ki]]) {
          var missLbl = known.pouleLabels ? known.pouleLabels[ki] : null;
          renderMissingPoule(cnt, known.ids[ki], missLbl, !!(missLbl && serverPools[missLbl]));
        }
      }
    }
  }

  for (var compName in effectiveKnown) {
    if (!renderedComps[compName]) {
      var known2 = effectiveKnown[compName];
      var hasAny = false;
      for (var ki2check = 0; ki2check < known2.ids.length; ki2check++) {
        if (D[known2.ids[ki2check]]) { hasAny = true; break; }
      }
      if (!hasAny) continue;
      var serverPools2 = COVERAGE_BY_LABEL[known2.label] ? COVERAGE_BY_LABEL[known2.label].pools : {};
      renderCompHeader(cnt, compName, [], hpOk, serverPools2, known2);
      for (var ki2 = 0; ki2 < known2.ids.length; ki2++) {
        var emptyLbl = known2.pouleLabels ? known2.pouleLabels[ki2] : null;
        renderMissingPoule(cnt, known2.ids[ki2], emptyLbl, !!(emptyLbl && serverPools2[emptyLbl]));
      }
    }
  }

  for (var ci = 0; ci < compEntries.length; ci++) {
    renderedFullComps[compEntries[ci][0]] = true;
    renderCompEntryItem(cnt, compEntries[ci][0], compEntries[ci][1], hpOk, effectiveFullComps);
  }
  for (var fcKey in effectiveFullComps) {
    if (!renderedFullComps[fcKey]) {
      var fc = effectiveFullComps[fcKey];
      var srvFc = COVERAGE_LOADED && COVERAGE_BY_LABEL[fc.label];
      if (!srvFc) continue;
      var hdr = document.createElement('div'); hdr.className = 'comp-hdr';
      var fcBadge = '<span class="comp-badge comp-badge-partial">🗄 ' + srvFc.pool_count + ' poules op server</span>';
      hdr.innerHTML = '<div class="comp-hdr-left"><span class="comp-name">' + fc.label + '</span>' + fcBadge + '</div>';
      cnt.appendChild(hdr);
      var hint = document.createElement('div'); hint.className = 'comp-hint'; hint.textContent = 'Open deze competitie op hockey.nl';
      cnt.appendChild(hint);
    }
  }
}

function renderCompHeader(cnt, comp, entries, hpOk, serverPools, known) {
  if (known === undefined) known = KNOWN_COMPS[comp];
  var suggestion = SUGGESTIONS_LOADED ? SUGGESTIONS[comp] : null;
  var hdr = document.createElement('div'); hdr.className = 'comp-hdr';
  var left = '<span class="comp-name">' + comp + '</span>';
  if (known) {
    var have = 0;
    for (var i = 0; i < known.ids.length; i++) { if (D[known.ids[i]]) have++; }
    var complete = have === known.ids.length;
    left += '<span class="comp-badge ' + (complete ? 'comp-badge-ok' : have > 0 ? 'comp-badge-partial' : 'comp-badge-empty') + '">' +
      (complete ? '✅ ' : '⏳ ') + have + '/' + known.ids.length + '</span>';
    if (COVERAGE_LOADED && serverPools) {
      var srvCnt = Object.keys(serverPools).length;
      var srvCls = srvCnt === known.ids.length ? 'comp-badge-ok' : srvCnt > 0 ? 'comp-badge-partial' : 'comp-badge-empty';
      left += '<span class="comp-badge comp-badge-srv ' + srvCls + '">🗄 ' + srvCnt + '/' + known.ids.length + '</span>';
    }
  } else {
    left += '<span class="comp-badge comp-badge-other">' + entries.length + ' poules</span>';
  }
  if (suggestion) {
    var matchCls = suggestion.score >= 0.8 ? 'comp-badge-ok' : 'comp-badge-partial';
    left += '<span class="comp-badge ' + matchCls + '" title="' + suggestion.matched + '/' + suggestion.total + ' teams">→ ' + suggestion.tournament_name + ' · ' + suggestion.phase_name + '</span>';
  }

  // Push-knop alleen tonen als er nieuwe data is t.o.v. laatste import
  var label = (known && known.label) || (suggestion && suggestion.tournament_name) || null;
  var hasNew = groupHasNewData(entries, label);
  var canPush = hpOk && (known || suggestion) && entries.length > 0;
  var right = '';
  if (canPush) {
    if (hasNew) {
      right = '<button class="comp-push-btn" data-comp="' + comp + '">📤 Push</button>';
    } else {
      right = '<span class="comp-synced">✓ sync</span>';
    }
  }
  hdr.innerHTML = '<div class="comp-hdr-left">' + left + '</div><div class="comp-hdr-right">' + right + '</div>';
  cnt.appendChild(hdr);

  var pushBtn = hdr.querySelector('.comp-push-btn');
  if (pushBtn) pushBtn.addEventListener('click', function(evt) {
    evt.stopPropagation();
    var b = evt.target; b.disabled = true; b.textContent = '⏳';
    pushComp(b.getAttribute('data-comp'));
    setTimeout(function() { b.disabled = false; b.textContent = '📤 Push'; }, 4000);
  });
}

function renderPouleItem(cnt, id, e, onServer) {
  var played = 0, rem = 0;
  try { var ma = e.data.data.poule.matches || []; for (var mi = 0; mi < ma.length; mi++) { if (ma[mi].status === 'final') played++; else rem++; } } catch(ex) {}
  var ts = timeAgo(e.timestamp);
  var el = document.createElement('div'); el.className = 'pi'; el.setAttribute('data-id', id);
  var srvDot = COVERAGE_LOADED ? (onServer ? '<span class="pi-srv pi-srv--ok" title="Op server">🗄</span>' : '<span class="pi-srv pi-srv--no" title="Nog niet op server">○</span>') : '';
  el.innerHTML = '<div class="pi-row"><span class="pi-name">' + (e.poule_name || '?') + '</span>' + srvDot + '<span class="pi-stat">📊 ' + played + '</span><span class="pi-stat">📅 ' + rem + '</span><span class="pi-via">via ' + (e.team_name || '?').replace(/ [A-Z]?O?\d+-\d+/g, '').trim() + '</span><span class="pi-ts">' + ts + '</span></div>';
  cnt.appendChild(el);
}

function renderMissingPoule(cnt, pouleId, label, onServer) {
  var el = document.createElement('div'); el.className = 'pi-missing' + (onServer ? ' pi-missing--server' : '');
  var hint = onServer ? '🗄 op server' : 'niet opgehaald';
  el.innerHTML = '<span class="pi-missing-name">' + (label || 'Poule ' + pouleId) + '</span><span class="pi-missing-hint">' + hint + '</span>';
  cnt.appendChild(el);
}

function renderCompEntryItem(cnt, storeKey, entry, hpOk, fullComps) {
  var fc = (fullComps || KNOWN_FULL_COMPS)[storeKey];
  var ts = timeAgo(entry.timestamp);
  var hdr = document.createElement('div'); hdr.className = 'comp-hdr';
  var left = '<span class="comp-name">' + (entry.competition || (fc && fc.label) || storeKey) + '</span>' +
    '<span class="comp-badge comp-badge-ok">✅ ' + (entry.poule_count || '?') + ' poules</span>';

  // Push conditioneel: vergelijk entry.timestamp met last_import
  var fcLabel = fc ? fc.label : null;
  var entryTs = entry.timestamp ? [[null, entry]] : [];
  var hasNew = groupHasNewData(entryTs, fcLabel);
  var right = '';
  if (fc && hpOk) {
    if (hasNew) {
      right = '<button class="comp-push-btn" data-fcomp="' + storeKey + '">📤 Push</button>';
    } else {
      right = '<span class="comp-synced">✓ sync</span>';
    }
  }
  hdr.innerHTML = '<div class="comp-hdr-left">' + left + '</div><div class="comp-hdr-right">' + right + '</div>';
  cnt.appendChild(hdr);

  var pushBtn = hdr.querySelector('.comp-push-btn');
  if (pushBtn) pushBtn.addEventListener('click', function(evt) {
    evt.stopPropagation();
    var b = evt.target; b.disabled = true; b.textContent = '⏳';
    pushFullComp(b.getAttribute('data-fcomp'));
    setTimeout(function() { b.disabled = false; b.textContent = '📤 Push'; }, 4000);
  });

  var el = document.createElement('div'); el.className = 'pi-row-static';
  el.innerHTML = '<span class="pi-stat">📊 ' + (entry.played_count || 0) + ' gespeeld</span><span class="pi-stat">📅 ' + (entry.remaining_count || 0) + ' resterend</span><span class="pi-ts">' + ts + '</span>';
  cnt.appendChild(el);
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var tab = btn.getAttribute('data-tab');
      switchTab(tab);
      if (tab === 'capture') {
        if (!_queue.items.length && !_queue.running) {
          startCapture();
        } else {
          renderCapturePane();
        }
      }
    });
  });
  $('bRefresh').addEventListener('click', function() { load(); loadConfig(); loadCoverage(); loadSuggestions(); });
  $('bClear').addEventListener('click', doClear);
  loadSettings();
  renderLog();
  load();

  // Auto-refresh zodra de interceptor nieuwe data vangt (via bridge.js → background)
  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg.type === 'hw_data_updated') {
      clearTimeout(_autoRefreshTimer);
      _autoRefreshTimer = setTimeout(function() { load(); }, 600);
    } else if (msg.type === 'hw_log_updated') {
      if (!$('logPane').classList.contains('hidden')) refreshLogOnly();
    }
  });
});

// ══════════════════════════════════════
// CAPTURE QUEUE
// ══════════════════════════════════════
function randDelay() {
  var range = HP.delayMax - HP.delayMin;
  return HP.delayMin + Math.floor(Math.random() * (range + 1));
}
function fmtMs(ms) {
  return (Math.max(0, ms) / 1000).toFixed(1) + 's';
}
function fmtAge(ts) {
  if (!ts) return 'nooit';
  var d = Date.now() - ts;
  if (d < 60000) return Math.round(d / 1000) + 's';
  if (d < 3600000) return Math.round(d / 60000) + 'm';
  return (d / 3600000).toFixed(1) + 'u';
}
function showCapturePane() {
  switchTab('capture');
}
function renderCapturePane() {
  var pane = $('capturePane');
  if (!pane) return;
  var items = _queue.items;
  var isRunning = _queue.running;

  // Count done/skip
  var done = 0, skipped = 0;
  for (var i = 0; i < items.length; i++) {
    if (items[i].state === 'done') done++;
    if (items[i].state === 'skip') skipped++;
  }
  var activeTotal = items.length - skipped;
  var allDone = activeTotal > 0 && done === activeTotal;

  // Group by competition
  var groups = {}, groupOrder = [];
  for (var gi0 = 0; gi0 < items.length; gi0++) {
    var it0 = items[gi0];
    var gKey = it0.competition || 'Onbekend';
    if (!groups[gKey]) { groups[gKey] = []; groupOrder.push(gKey); }
    groups[gKey].push(gi0);
  }
  groupOrder.sort(function(a, b) {
    if (a === 'Onbekend') return 1;
    if (b === 'Onbekend') return -1;
    return a.localeCompare(b);
  });

  var html = '<div class="cp-header">' +
    '<span class="cp-title">📡 AUTO-CAPTURE</span>' +
    '<div class="cp-right">' +
    '<span class="cp-count" id="cpCount">' + done + ' / ' + activeTotal + '</span>' +
    (isRunning ? '<button class="cp-stop" id="cpStop">⏹ Stop</button>' : '') +
    '</div></div>';

  // Freshness counts (only non-excluded)
  var nFresh = 0, nStale = 0, nMissing = 0;
  for (var qi2 = 0; qi2 < items.length; qi2++) {
    var it2 = items[qi2];
    if (!isRunning && it2.pouleId && _excluded[it2.pouleId]) continue;
    if (it2.freshness === 'fresh') nFresh++;
    else if (it2.freshness === 'stale') nStale++;
    else nMissing++;
  }

  // Render groups
  for (var gi = 0; gi < groupOrder.length; gi++) {
    var gName = groupOrder[gi];
    var gIdxs = groups[gName];

    // Per-group freshness summary
    var gFresh = 0, gStale = 0, gMiss = 0, gExcl = 0;
    for (var gii = 0; gii < gIdxs.length; gii++) {
      var git = items[gIdxs[gii]];
      var isExclG = !isRunning && git.pouleId && _excluded[git.pouleId];
      if (isExclG) { gExcl++; continue; }
      if (git.freshness === 'fresh') gFresh++;
      else if (git.freshness === 'stale') gStale++;
      else gMiss++;
    }
    var gCtParts = [];
    if (gFresh)  gCtParts.push('<span class="cp-fresh-ct">●' + gFresh + '</span>');
    if (gStale)  gCtParts.push('<span class="cp-stale-ct">●' + gStale + '</span>');
    if (gMiss)   gCtParts.push('<span class="cp-miss-ct">○' + gMiss + '</span>');
    if (gExcl)   gCtParts.push('<span class="cp-excl-ct">✕' + gExcl + '</span>');

    html += '<div class="cp-group">' +
      '<span class="cp-group-name">' + escHtml(gName) + '</span>' +
      '<span class="cp-group-counts">' + gCtParts.join(' ') + '</span>' +
      '</div>';

    for (var gii2 = 0; gii2 < gIdxs.length; gii2++) {
      var idx = gIdxs[gii2];
      var it3 = items[idx];
      var isExcluded = !isRunning && it3.pouleId && _excluded[it3.pouleId];

      var meta;
      if (it3.state === 'done')        { meta = '✓'; }
      else if (it3.state === 'skip')   { meta = '–'; }
      else if (it3.state === 'active') { meta = fmtMs(_queue.countdownMs); }
      else if (isRunning) {
        var est = _queue.countdownMs;
        for (var ei = _queue.currentIdx + 1; ei < idx; ei++) {
          if (items[ei] && items[ei].state !== 'skip') est += items[ei].delay;
        }
        meta = '~' + fmtMs(Math.max(0, est));
      } else {
        meta = fmtAge(it3.capturedAt);
      }

      var stateClass = (isExcluded || it3.state === 'skip') ? 'qi-excluded' : 'qi-' + it3.state;
      var dStyle = it3.state === 'active' ? ' style="--d:' + (it3.delay / 1000) + 's"' : '';
      var freshAttr = (!isExcluded && it3.freshness) ? ' data-freshness="' + it3.freshness + '"' : '';
      var exclBtn = (!isRunning && it3.pouleId)
        ? '<button class="qi-excl" data-pid="' + escHtml(it3.pouleId) + '">' + (isExcluded ? '+' : '✕') + '</button>'
        : '';

      html += '<div class="qi ' + stateClass + '"' + dStyle + freshAttr + ' id="qi-' + idx + '">' +
        '<div class="qi-dot"></div>' +
        '<span class="qi-name" title="' + escHtml(it3.navLabel || it3.label) + '">' + escHtml(it3.label) + '</span>' +
        '<span class="qi-meta" id="qm-' + idx + '">' + meta + '</span>' +
        exclBtn +
        '<div class="qi-bar"></div>' +
        '</div>';
    }
  }

  // Item 324: toon config-poules die niet in nav staan
  if (!isRunning && _queue.missingPoules && _queue.missingPoules.length > 0) {
    var missByComp = {}, missOrder = [];
    for (var mni = 0; mni < _queue.missingPoules.length; mni++) {
      var mnp = _queue.missingPoules[mni];
      var mng = mnp.competition || 'Onbekend';
      if (!missByComp[mng]) { missByComp[mng] = []; missOrder.push(mng); }
      missByComp[mng].push(mnp);
    }
    html += '<div class="cp-missing-hdr">Niet in nav (' + _queue.missingPoules.length + ')</div>';
    for (var mngi = 0; mngi < missOrder.length; mngi++) {
      var mngName = missOrder[mngi];
      var mnps = missByComp[mngName];
      html += '<div class="cp-group"><span class="cp-group-name">' + escHtml(mngName) + '</span></div>';
      for (var mni2 = 0; mni2 < mnps.length; mni2++) {
        var mnp2 = mnps[mni2];
        html += '<div class="qi qi-missing-nav"><div class="qi-dot"></div>' +
          '<span class="qi-name">' + escHtml(mnp2.label) + '</span>' +
          '<span class="qi-meta">nav?</span><div class="qi-bar"></div></div>';
      }
    }
  }

  var nNeedCapture = nStale + nMissing;
  if (allDone) {
    html += '<div class="cp-summary">✅ Alle ' + activeTotal + ' teams gescraped — data up to date</div>';
  } else if (!isRunning) {
    var tipParts = [];
    if (nFresh)   tipParts.push('<span class="cp-fresh-ct">● ' + nFresh + ' recent</span>');
    if (nStale)   tipParts.push('<span class="cp-stale-ct">● ' + nStale + ' oud</span>');
    if (nMissing) tipParts.push('<span class="cp-miss-ct">○ ' + nMissing + ' nooit</span>');
    html += '<div class="cp-tip">' + tipParts.join(' &nbsp; ') +
      ' &nbsp;·&nbsp; <strong>' + Math.round(HP.delayMin / 1000) + '–' + Math.round(HP.delayMax / 1000) + 's</strong> per klik</div>' +
      '<div class="cp-btns">' +
      '<button class="bx" id="cpStart">▶ Alles (' + activeTotal + ')</button>' +
      (nNeedCapture > 0
        ? '<button class="bs cp-stale-btn" id="cpStale">⚡ Stale/nieuw (' + nNeedCapture + ')</button>'
        : '<button class="bs cp-stale-btn off" disabled>⚡ Alles recent</button>'
      ) +
      '</div>';
  }

  pane.innerHTML = html;
  var stopBtn = $('cpStop');
  if (stopBtn) stopBtn.addEventListener('click', stopCapture);
  var startBtn = $('cpStart');
  if (startBtn) startBtn.addEventListener('click', beginCapture);
  var staleBtn = $('cpStale');
  if (staleBtn) staleBtn.addEventListener('click', beginCaptureStale);
  // Exclude toggle buttons
  pane.querySelectorAll('.qi-excl').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleExclude(btn.getAttribute('data-pid'));
    });
  });
}
function updateCaptureMetasOnly() {
  var items = _queue.items;
  for (var qi = 0; qi < items.length; qi++) {
    var el = $('qm-' + qi);
    if (!el) continue;
    var it = items[qi];
    if (it.state === 'done')   { el.textContent = '✓'; continue; }
    if (it.state === 'skip')   { el.textContent = '–'; continue; }
    if (it.state === 'active') { el.textContent = fmtMs(_queue.countdownMs); continue; }
    var est = _queue.countdownMs;
    for (var ei = _queue.currentIdx + 1; ei < qi; ei++) {
      if (items[ei] && items[ei].state !== 'skip') est += items[ei].delay;
    }
    el.textContent = '~' + fmtMs(Math.max(0, est));
  }
  var countEl = $('cpCount');
  if (countEl) {
    var done = 0, skipped = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].state === 'done') done++;
      if (items[i].state === 'skip') skipped++;
    }
    countEl.textContent = done + ' / ' + (items.length - skipped);
  }
  var btn = $('bCapture');
  if (btn && _queue.running) btn.textContent = '📡 ' + (_queue.currentIdx + 1) + '/' + items.length;
}
function activateNextQueueItem() {
  var items = _queue.items;
  while (_queue.currentIdx < items.length && items[_queue.currentIdx].state === 'skip') {
    _queue.currentIdx++;
  }
  if (_queue.currentIdx >= items.length) {
    _queue.running = false;
    renderCapturePane();
    var btn = $('bCapture');
    if (btn) { btn.textContent = '📡 Capture'; btn.classList.remove('off'); }
    var skipCt = 0; for (var si = 0; si < items.length; si++) { if (items[si].state === 'skip') skipCt++; }
    addLog('ok', '📡 Auto-capture klaar — ' + (items.length - skipCt) + ' teams');
    toast('✅ Capture klaar!');
    load();
    return;
  }
  var it = items[_queue.currentIdx];
  it.state = 'active';
  _queue.countdownMs = it.delay;
  renderCapturePane();
  var capBtn = $('bCapture');
  if (capBtn) { capBtn.textContent = '📡 ' + (_queue.currentIdx + 1) + '/' + items.length; capBtn.classList.add('off'); }
  addLog('info', '📡 → ' + it.label + ' (' + (_queue.currentIdx + 1) + '/' + items.length + ')');
  // Eerst terug naar hoofdpagina zodat de SPA het team altijd vers laadt
  chrome.scripting.executeScript({
    target: { tabId: _queue.tabId },
    func: function() { window.location.hash = '/'; }
  }, function() {
    setTimeout(function() {
      chrome.scripting.executeScript({
        target: { tabId: _queue.tabId },
        func: function(h) {
          var clicked = false;
          function findAndClick(root) {
            if (!root || clicked) return;
            try {
              var links = root.querySelectorAll('a[href="' + h + '"]');
              if (links.length) { links[0].click(); clicked = true; return; }
              root.querySelectorAll('*').forEach(function(el) { if (el.shadowRoot) findAndClick(el.shadowRoot); });
            } catch(e) {}
          }
          findAndClick(document);
          if (!clicked) window.location.hash = h.replace(/^#/, '');
          return clicked;
        },
        args: [it.href]
      }, function(res) {
        var clicked = res && res[0] && res[0].result;
        addLog('info', (clicked ? '🖱️ geklikt' : '🔗 hash gezet') + ': ' + it.href);
    var startTime = Date.now(), duration = it.delay;
    _queue.tickTimer = setInterval(function() {
      _queue.countdownMs = Math.max(0, duration - (Date.now() - startTime));
      updateCaptureMetasOnly();
    }, 60);
    _queue.stepTimer = setTimeout(function() {
      clearInterval(_queue.tickTimer);
      var el = $('qi-' + _queue.currentIdx);
      if (el) { el.classList.remove('qi-active'); el.classList.add('qi-done', 'qi-done-flash'); }
      it.state = 'done';
      _queue.currentIdx++;
      // Log hoeveel data er gevangen is voor dit team
      chrome.scripting.executeScript({
        target: { tabId: _queue.tabId },
        func: function() {
          var raw = localStorage.getItem('__hw_poules') || '{}';
          return raw.length;
        }
      }, function(r) {
        var bytes = r && r[0] && r[0].result;
        if (bytes) addLog('ok', '✅ ' + it.label + ' → ' + Math.round(bytes / 1024) + ' KB totaal in store');
      });
      setTimeout(activateNextQueueItem, 400);
    }, duration);
      });
    }, 800);
  });
}
function toggleExclude(pouleId) {
  if (!pouleId) return;
  if (_excluded[pouleId]) delete _excluded[pouleId]; else _excluded[pouleId] = true;
  chrome.storage.sync.set({ hw_excluded: _excluded });
  renderCapturePane();
}
function beginCaptureStale() {
  var need = _queue.items.filter(function(it) {
    return it.freshness !== 'fresh' && !(it.pouleId && _excluded[it.pouleId]);
  });
  if (!need.length) { toast('✅ Alles is recent!'); return; }
  _queue.items = need.map(function(it) { return Object.assign({}, it, { state: 'pending', delay: randDelay() }); });
  beginCapture();
}
function beginCapture() {
  if (_queue.running || !_queue.items.length) return;
  _queue.running = true;
  _queue.currentIdx = 0;
  var activeCount = 0;
  for (var i = 0; i < _queue.items.length; i++) {
    var it = _queue.items[i];
    if (it.pouleId && _excluded[it.pouleId]) {
      it.state = 'skip';
    } else {
      it.state = 'pending';
      it.delay = randDelay();
      activeCount++;
    }
  }
  addLog('info', '📡 Auto-capture gestart — ' + activeCount + ' teams · ' + Math.round(HP.delayMin/1000) + '–' + Math.round(HP.delayMax/1000) + 's per stap');
  activateNextQueueItem();
}
function stopCapture() {
  clearInterval(_queue.tickTimer);
  clearTimeout(_queue.stepTimer);
  _queue.running = false;
  for (var i = _queue.currentIdx; i < _queue.items.length; i++) _queue.items[i].state = 'pending';
  if (_queue.items[_queue.currentIdx]) _queue.items[_queue.currentIdx].state = 'pending';
  renderCapturePane();
  var btn = $('bCapture');
  if (btn) { btn.textContent = '📡 Capture'; btn.classList.remove('off'); }
  addLog('info', '📡 Capture gestopt na ' + _queue.currentIdx + ' teams');
}
function startCapture() {
  if (_queue.running) { showCapturePane(); renderCapturePane(); return; }
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tab = tabs && tabs[0];
    if (!tab || tab.url.indexOf('hockey.nl') === -1) { toast('❌ Ga naar hockey.nl'); return; }
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function() {
        var seen = {}, items = [], shadowCount = 0;
        function collectWithShadow(root) {
          if (!root) return;
          try {
            Array.from(root.querySelectorAll('a[href^="#/team/"]')).forEach(function(a) {
              var href = a.getAttribute('href');
              if (href && !seen[href]) {
                seen[href] = true;
                items.push({ href: href, label: (a.textContent || '').trim().replace(/\s+/g, ' ') });
              }
            });
            Array.from(root.querySelectorAll('*')).forEach(function(el) {
              if (el.shadowRoot) { shadowCount++; collectWithShadow(el.shadowRoot); }
            });
          } catch(e) {}
        }
        collectWithShadow(document);
        try {
          for (var i = 0; i < window.frames.length; i++) {
            try { collectWithShadow(window.frames[i].document); } catch(e) {}
          }
        } catch(e) {}
        if (!items.length) return { __debug: true, shadowCount: shadowCount, frameCount: window.frames.length };
        // Lees timestamps en competitie-info per poule_id uit localStorage
        var timestamps = {}, compInfo = {};
        try {
          var store = JSON.parse(localStorage.getItem('__hw_poules') || '{}');
          Object.keys(store).forEach(function(pid) {
            var e = store[pid];
            if (e) {
              if (e.timestamp) timestamps[pid] = e.timestamp;
              compInfo[pid] = {
                competition: e.competition || '',
                class_name:  e.class_name  || '',
                poule_name:  e.poule_name  || '',
                team_name:   e.team_name   || '',
              };
            }
          });
        } catch(e) {}
        return { navItems: items, timestamps: timestamps, compInfo: compInfo };
      }
    }, function(results) {
      var result = results && results[0] && results[0].result;
      if (!result || result.__debug) {
        if (result && result.__debug) addLog('info', 'Shadow: ' + result.shadowCount + ' roots · frames: ' + result.frameCount);
        toast('❌ Nav niet gevonden — check Log tab');
        return;
      }
      var rawItems = result.navItems || [];
      var timestamps = result.timestamps || {};
      var compInfo = result.compInfo || {};
      var now = Date.now();
      var STALE_MS = 2 * 60 * 60 * 1000;
      if (!rawItems.length) { toast('❌ Nav niet gevonden — check Log tab'); return; }
      _queue = {
        running: false, preview: true,
        items: rawItems.map(function(it) {
          var pid = (it.href.match(/\|(\d+)/) || [])[1] || null;
          var ts = pid && timestamps[pid] ? timestamps[pid] : null;
          var freshness = ts ? (now - ts < STALE_MS ? 'fresh' : 'stale') : 'missing';
          var ci = pid && compInfo[pid] ? compInfo[pid] : null;
          var competition = ci ? ((ci.competition || '') + (ci.class_name ? ' · ' + ci.class_name : '')) : null;
          var enrichedLabel = (ci && ci.poule_name) ? ci.poule_name : (ci && ci.team_name) ? ci.team_name : (it.label || it.href);
          return { href: it.href, label: enrichedLabel, navLabel: it.label || it.href, state: 'pending', delay: randDelay(),
                   pouleId: pid, capturedAt: ts, freshness: freshness, competition: competition || null };
        }),
        currentIdx: 0, countdownMs: 0,
        tabId: tab.id, tickTimer: null, stepTimer: null,
        missingPoules: []
      };
      // Item 324: config-poules die NIET in de nav staan
      if (CONFIG_LOADED) {
        var navPids = {};
        for (var qi0 = 0; qi0 < _queue.items.length; qi0++) {
          if (_queue.items[qi0].pouleId) navPids[_queue.items[qi0].pouleId] = true;
        }
        for (var ci0 = 0; ci0 < CONFIG.length; ci0++) {
          var cfg0 = CONFIG[ci0];
          if (cfg0.capture_type !== 'poule' || !cfg0.capture_ids) continue;
          for (var pi0 = 0; pi0 < cfg0.capture_ids.length; pi0++) {
            var mpid = String(cfg0.capture_ids[pi0]);
            if (!navPids[mpid]) {
              var mlbl = cfg0.capture_labels && cfg0.capture_labels[pi0] ? cfg0.capture_labels[pi0] : 'Poule ' + mpid;
              _queue.missingPoules.push({ pouleId: mpid, label: mlbl, competition: cfg0.capture_group || cfg0.tournament_name || '' });
            }
          }
        }
      }
      showCapturePane();
      renderCapturePane();
    });
  });
}

function doClear() {
  if (!confirm('Alle data wissen?')) return;
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0]) return;
    chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, func: function() { localStorage.removeItem('__hw_poules'); localStorage.removeItem('__hw_captured'); }
    }, function() { D = {}; render(); toast('🗑️ Gewist'); addLog('info', 'Data gewist'); });
  });
}
