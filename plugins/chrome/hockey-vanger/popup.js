// popup.js v11.2 — idle polling: 20 min na lege queue (384)
var HP = { url: '', key: '', delayMin: 10000, delayMax: 15000 };
var LOG = [];
var IDLE_TIMEOUT_MS  = 20 * 60 * 1000;
var IDLE_POLL_MS     = 30 * 1000;
var _vanger = {
  running: false, currentCmd: null, doneCount: 0, failCount: 0,
  countdownMs: 0, tabId: null, tickTimer: null, stepTimer: null, tabLoadedListener: null,
  idleStartMs: 0, startMs: 0, sessionTimer: null, flowStep: '',
  tabOk: false, tabUrlListener: null
};
var _heartbeatTimer = null;

var $ = function(id) { return document.getElementById(id); };

// ══════════════════════════════════════
// HELPERS
// ══════════════════════════════════════
function toast(m) {
  var t = $('toast'); if (!t) return;
  t.textContent = m; t.style.display = 'block';
  setTimeout(function() { t.style.display = 'none'; }, 2500);
}
function randDelay() {
  return HP.delayMin + Math.floor(Math.random() * (HP.delayMax - HP.delayMin + 1));
}
function fmtMs(ms) { return (Math.max(0, ms) / 1000).toFixed(1) + 's'; }
function fmtElapsed(startMs) {
  var s = Math.floor((Date.now() - startMs) / 1000);
  var m = Math.floor(s / 60); s = s % 60;
  return (m > 0 ? m + 'm ' : '') + s + 's';
}

// ══════════════════════════════════════
// TABS
// ══════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-tab') === tab);
  });
  $('vangerPane').classList.toggle('hidden', tab !== 'vanger');
  $('settingsPane').classList.toggle('hidden', tab !== 'settings');
  $('logPane').classList.toggle('hidden', tab !== 'log');
  $('helpPane').classList.toggle('hidden', tab !== 'help');
  if (tab === 'vanger')   renderVangerPane();
  if (tab === 'settings') renderSettings();
  if (tab === 'log')      renderLog();
}

// ══════════════════════════════════════
// LOG
// ══════════════════════════════════════
function addLog(type, msg) {
  var entry = { time: new Date().toLocaleTimeString('nl-NL'), type: type, msg: msg };
  LOG.unshift(entry);
  if (LOG.length > 200) LOG.pop();
  if (!$('logPane').classList.contains('hidden')) renderLog();
  if (type === 'err' && HP.url && HP.key) {
    fetch(HP.url + '/api/tournix/discovery/plugin-error', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + HP.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, context: null, session_id: null })
    }).catch(function() {});
  }
}
function renderLog() {
  var pane = $('logPane');
  if (!pane) return;
  var colors = { ok: '#4caf50', err: '#f44336', warn: '#ff9800', info: '#90caf9' };
  var html = '<div style="font-family:monospace;font-size:11px;padding:8px;display:flex;flex-direction:column;gap:2px;">';
  for (var i = 0; i < Math.min(LOG.length, 80); i++) {
    var e = LOG[i];
    html += '<div style="display:flex;gap:6px;border-bottom:1px solid rgba(255,255,255,0.05);padding:2px 0;">' +
      '<span style="color:#666;flex-shrink:0;">' + e.time + '</span>' +
      '<span style="color:' + (colors[e.type] || '#ccc') + '">' + (e.msg || '').replace(/</g, '&lt;') + '</span>' +
      '</div>';
  }
  html += '</div>';
  pane.innerHTML = html;
}

// ══════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════
function loadSettings() {
  chrome.storage.sync.get(['hp_url', 'hp_key', 'hw_delay_min', 'hw_delay_max'], function(r) {
    HP.url      = (r.hp_url  || '').replace(/\/$/, '');
    HP.key      = r.hp_key   || '';
    HP.delayMin = r.hw_delay_min ? parseInt(r.hw_delay_min) * 1000 : 10000;
    HP.delayMax = r.hw_delay_max ? parseInt(r.hw_delay_max) * 1000 : 15000;
    renderSettings();
    startHeartbeat();
    renderVangerPane();
  });
}
function renderSettings() {
  var pane = $('settingsPane');
  if (!pane) return;
  pane.innerHTML =
    '<div style="padding:12px;display:flex;flex-direction:column;gap:10px;">' +
    '<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888;letter-spacing:.05em;">HomePlatform</div>' +
    '<label style="font-size:12px;">URL<br><input id="sUrl" style="width:100%;box-sizing:border-box;padding:5px 8px;border-radius:5px;border:1px solid #444;background:#1a1a1a;color:#eee;font-size:12px;" value="' + (HP.url || '') + '"></label>' +
    '<label style="font-size:12px;">API Key<br><input id="sKey" type="password" style="width:100%;box-sizing:border-box;padding:5px 8px;border-radius:5px;border:1px solid #444;background:#1a1a1a;color:#eee;font-size:12px;" value="' + (HP.key || '') + '"></label>' +
    '<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888;letter-spacing:.05em;margin-top:4px;">Navigatie delay</div>' +
    '<div style="display:flex;gap:8px;align-items:center;font-size:12px;">' +
    'Min <input id="sMin" type="number" style="width:60px;padding:4px 6px;border-radius:5px;border:1px solid #444;background:#1a1a1a;color:#eee;font-size:12px;" value="' + (HP.delayMin/1000) + '">' +
    's &nbsp; Max <input id="sMax" type="number" style="width:60px;padding:4px 6px;border-radius:5px;border:1px solid #444;background:#1a1a1a;color:#eee;font-size:12px;" value="' + (HP.delayMax/1000) + '">s' +
    '</div>' +
    '<button id="sSave" style="padding:6px 16px;border-radius:6px;border:none;background:#1565c0;color:#fff;font-size:12px;cursor:pointer;">Opslaan</button>' +
    '</div>';

  $('sSave').addEventListener('click', function() {
    var url = ($('sUrl').value || '').trim().replace(/\/$/, '');
    var key = ($('sKey').value || '').trim();
    var mn  = Math.max(1, parseInt($('sMin').value) || 10);
    var mx  = Math.max(mn, parseInt($('sMax').value) || 15);
    chrome.storage.sync.set({ hp_url: url, hp_key: key, hw_delay_min: mn, hw_delay_max: mx }, function() {
      HP.url = url; HP.key = key;
      HP.delayMin = mn * 1000; HP.delayMax = mx * 1000;
      toast('✅ Opgeslagen');
    });
  });
}

// ══════════════════════════════════════
// HEARTBEAT
// ══════════════════════════════════════
function sendHeartbeat() {
  if (!HP.url || !HP.key) return;
  var cmd = _vanger.currentCmd;
  fetch(HP.url + '/api/tournix/discovery/vanger/heartbeat', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + HP.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      running:     _vanger.running,
      mode:        _vanger.running ? (cmd ? cmd.cmd_type : 'polling') : 'idle',
      task:        cmd ? (cmd.params.label || cmd.params.external_id || null) : null,
      cmd_id:      cmd ? cmd.id : null,
      done_count:  _vanger.doneCount,
      fail_count:  _vanger.failCount,
      queue_total: 0,
    })
  }).catch(function() {});
}
function startHeartbeat() {
  if (_heartbeatTimer) return;
  sendHeartbeat();
  _heartbeatTimer = setInterval(sendHeartbeat, 15000);
}
function stopHeartbeat() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (HP.url && HP.key) {
    fetch(HP.url + '/api/tournix/discovery/vanger/heartbeat', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + HP.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ running: false, mode: 'idle', task: null, cmd_id: null, done_count: 0, fail_count: 0, queue_total: 0 })
    }).catch(function() {});
  }
}

// ══════════════════════════════════════
// VANGER — cmd loop
// ══════════════════════════════════════
function startVanger() {
  if (_vanger.running) return;
  if (!HP.url || !HP.key) { toast('❌ Geen HomePlatform verbinding'); return; }
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tab = tabs && tabs[0];
    if (!tab || tab.url.indexOf('hockey.nl') === -1) { toast('❌ Ga naar www.hockey.nl'); return; }
    _vanger = {
      running: true, currentCmd: null, doneCount: 0, failCount: 0,
      countdownMs: 0, tabId: tab.id, tickTimer: null, stepTimer: null, tabLoadedListener: null,
      idleStartMs: 0, startMs: Date.now(), sessionTimer: null, flowStep: '',
      tabOk: true, tabUrlListener: null,
      sessionId: crypto.randomUUID()
    };
    _vanger.tabUrlListener = function(tabId, info) {
      if (tabId !== _vanger.tabId) return;
      var ok = info.url ? info.url.indexOf('hockey.nl') !== -1 : _vanger.tabOk;
      if (ok !== _vanger.tabOk) {
        _vanger.tabOk = ok;
        var el = $('vcTabStatus');
        if (el) { el.textContent = ok ? '🟢' : '🔴'; el.title = ok ? 'hockey.nl actief' : 'Niet op hockey.nl'; }
      }
    };
    chrome.tabs.onUpdated.addListener(_vanger.tabUrlListener);
    _vanger.sessionTimer = setInterval(function() {
      var el = $('vSessionElapsed');
      if (el) el.textContent = fmtElapsed(_vanger.startMs);
      var idleEl = $('vIdleCountdown');
      if (idleEl && _vanger.idleStartMs > 0) {
        var rem = Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - _vanger.idleStartMs));
        idleEl.textContent = Math.ceil(rem / 60000) + ' min';
      }
    }, 1000);
    // Ruim __hw_log op om localStorage-ruimte vrij te maken
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function() { try { localStorage.removeItem('__hw_log'); } catch(e) {} }
    });
    addLog('info', '▶ Vanger 3.0 gestart');
    startHeartbeat();
    renderVangerPane();
    pollNextCmd();
  });
}

function stopVanger() {
  if (_vanger.tabUrlListener) {
    chrome.tabs.onUpdated.removeListener(_vanger.tabUrlListener);
    _vanger.tabUrlListener = null;
  }
  clearInterval(_vanger.tickTimer);
  clearInterval(_vanger.sessionTimer);
  clearTimeout(_vanger.stepTimer);
  if (_vanger.tabLoadedListener) {
    chrome.tabs.onUpdated.removeListener(_vanger.tabLoadedListener);
    _vanger.tabLoadedListener = null;
  }
  _vanger.running = false;
  _vanger.currentCmd = null;
  _vanger.idleStartMs = 0;
  addLog('info', '■ Gestopt — ✓ ' + _vanger.doneCount + '  ✗ ' + _vanger.failCount);
  stopHeartbeat();
  renderVangerPane();
}

function pollNextCmd() {
  if (!_vanger.running) return;
  cockpitPollPing();
  fetch(HP.url + '/api/tournix/discovery/vanger/cmd-queue/next', {
    headers: { 'Authorization': 'Bearer ' + HP.key }
  })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (!data || data.done) {
        if (!_vanger.idleStartMs) {
          _vanger.idleStartMs = Date.now();
          addLog('ok', '⏸ Queue leeg — pollen tot 20 min inactief (✓ ' + _vanger.doneCount + ')');
          toast('⏸ Queue leeg — wacht 20 min');
          var banner = $('vcIdleBanner');
          if (banner) banner.classList.remove('hidden');
          var sl = $('vcStateLbl'); if (sl) sl.textContent = 'Wacht op queue';
        }
        if (Date.now() - _vanger.idleStartMs >= IDLE_TIMEOUT_MS) {
          addLog('ok', '✅ 20 min inactief — sessie gesloten · ✓ ' + _vanger.doneCount + '  ✗ ' + _vanger.failCount);
          toast('✅ Sessie gesloten na 20 min');
          stopVanger();
          return;
        }
        _vanger.stepTimer = setTimeout(pollNextCmd, IDLE_POLL_MS);
        return;
      }
      _vanger.idleStartMs = 0;
      var banner = $('vcIdleBanner'); if (banner) banner.classList.add('hidden');
      executeCmd(data);
    })
    .catch(function(err) {
      addLog('err', '⚠️ Kan cmd niet ophalen: ' + err.message);
      _vanger.running = false;
      renderVangerPane();
    });
}

// ══════════════════════════════════════
// COCKPIT DOM-UPDATES (geen re-render)
// ══════════════════════════════════════
var FLOW_STEPS = [
  { key: 'nav',     icon: '⌗', label: 'Hash' },
  { key: 'reload',  icon: '↺', label: 'Reload' },
  { key: 'loading', icon: '…', label: 'Laden' },
  { key: 'wait',    icon: '◷', label: 'Wacht' },
  { key: 'read',    icon: '○', label: 'Lees' },
  { key: 'post',    icon: '↑', label: 'POST' },
];

function setFlowStep(key) {
  _vanger.flowStep = key;
  var activeIdx = -1;
  for (var i = 0; i < FLOW_STEPS.length; i++) {
    if (FLOW_STEPS[i].key === key) { activeIdx = i; break; }
  }
  var isDone = key === 'done';
  for (var i = 0; i < FLOW_STEPS.length; i++) {
    var s = FLOW_STEPS[i];
    var stepEl = $('vfStep_' + s.key);
    var dotEl  = $('vfDot_'  + s.key);
    var lineEl = i < FLOW_STEPS.length - 1 ? $('vfLine_' + i) : null;
    if (!stepEl || !dotEl) continue;
    var sc = isDone ? 'vflow-done' : (i < activeIdx ? 'vflow-done' : (i === activeIdx ? 'vflow-active' : 'vflow-pending'));
    stepEl.className = 'vflow-step ' + sc;
    dotEl.textContent = (isDone || i < activeIdx) ? '✓' : s.icon;
    if (lineEl) lineEl.className = 'vflow-line' + (isDone || i < activeIdx ? ' vflow-line-done' : '');
    if (s.key === 'wait') {
      var wl = $('flowWaitLabel');
      if (wl) wl.style.display = (i === activeIdx && !isDone) ? 'block' : 'none';
    }
  }
  var barEl = $('vfLoopBar');
  if (barEl) {
    var pct = isDone ? 100 : (activeIdx < 0 ? 0 : Math.round(activeIdx / (FLOW_STEPS.length - 1) * 100));
    barEl.style.width = pct + '%';
    barEl.className = 'vflow-loop-bar' + (isDone ? ' vflow-loop-bar--done' : '');
  }
  var ck = $('vcCockpit');
  if (ck && key && key !== 'done') ck.setAttribute('data-state', 'active');
}

function cockpitSetCmd(cmd) {
  var ck = $('vcCockpit'); if (!ck) return;
  var t = $('vcCmdType'); if (t) t.textContent = cmd.cmd_type;
  var n = $('vcCmdName'); if (n) n.textContent = cmd.params.label || cmd.params.external_id || '';
  var sl = $('vcStateLbl'); if (sl) sl.textContent = 'Verwerken...';
  var banner = $('vcIdleBanner'); if (banner) banner.classList.add('hidden');
  setFlowStep('');
  ck.setAttribute('data-state', 'active');
}

function cockpitCollapse() {
  var ck = $('vcCockpit'); if (!ck) return;
  var sl = $('vcStateLbl'); if (sl) sl.textContent = 'Aan het pollen...';
  ck.setAttribute('data-state', 'idle');
}

function cockpitPollPing() {
  var el = $('vcPollDot'); if (!el) return;
  el.classList.remove('vc-poll-ping');
  void el.offsetWidth;
  el.classList.add('vc-poll-ping');
}

function updateCounters() {
  var d = $('vDoneCount'); if (d) d.textContent = _vanger.doneCount;
  var f = $('vFailCount'); if (f) f.textContent = _vanger.failCount;
}

// ══════════════════════════════════════
// CMD LOOP
// ══════════════════════════════════════
function executeCmd(cmd) {
  _vanger.currentCmd = cmd;
  addLog('info', '→ ' + cmd.cmd_type + ' · ' + (cmd.params.label || cmd.params.external_id || ''));
  sendHeartbeat();
  cockpitSetCmd(cmd);

  var hash, lsKey, lsId;
  if (cmd.cmd_type === 'get_poule') {
    hash  = '/team/' + cmd.params.team_id + '|' + cmd.params.poule_id + '/standings';
    lsKey = '__hw_poules';
    lsId  = String(cmd.params.poule_id);
  } else if (cmd.cmd_type === 'scan_club') {
    hash  = '/club/' + cmd.params.external_id + '/field-teams';
    lsKey = '__hw_club_details';
    lsId  = String(cmd.params.external_id);
  } else if (cmd.cmd_type === 'get_clubs') {
    hash  = '/search/clubs';
    lsKey = '__hw_clubs';
    lsId  = null;
  } else if (cmd.cmd_type === 'get_competition_detail') {
    hash  = '/competitions/' + cmd.params.comp_id;
    lsKey = '__hw_comp_detail';
    lsId  = String(cmd.params.comp_id);
  } else if (cmd.cmd_type === 'get_competitions') {
    hash  = '/search/competition';
    lsKey = '__hw_competitions';
    lsId  = null;
  } else {
    addLog('warn', '⚠️ Onbekend cmd_type: ' + cmd.cmd_type);
    reportResult(cmd.id, null, 'Onbekend cmd_type: ' + cmd.cmd_type);
    return;
  }

  addLog('info', '⚙ nav: hash=' + hash + '  zoekt: ' + lsKey + '[' + (lsId || 'lijst') + ']');

  if (_vanger.tabLoadedListener) {
    chrome.tabs.onUpdated.removeListener(_vanger.tabLoadedListener);
    _vanger.tabLoadedListener = null;
  }

  setFlowStep('nav');

  chrome.scripting.executeScript({
    target: { tabId: _vanger.tabId },
    func: function(h) { window.location.hash = h; },
    args: [hash]
  }, function() {
    setFlowStep('reload');

    setTimeout(function() {
      if (!_vanger.running) return;
      setFlowStep('loading');

      var onReloadDone = function(tabId, info) {
        if (tabId !== _vanger.tabId || info.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onReloadDone);
        _vanger.tabLoadedListener = null;

        var delay = randDelay();
        addLog('info', '♻ tab herladen · wacht ' + Math.round(delay / 1000) + 's');
        var startTime = Date.now();
        _vanger.countdownMs = delay;
        setFlowStep('wait');

        _vanger.tickTimer = setInterval(function() {
          _vanger.countdownMs = Math.max(0, delay - (Date.now() - startTime));
          var el = $('flowWaitLabel');
          if (el) el.textContent = fmtMs(_vanger.countdownMs);
        }, 120);
        _vanger.stepTimer = setTimeout(function() {
          clearInterval(_vanger.tickTimer);
          readAndReport(cmd, lsKey, lsId);
        }, delay);
      };
      _vanger.tabLoadedListener = onReloadDone;
      chrome.tabs.onUpdated.addListener(onReloadDone);
      chrome.tabs.reload(_vanger.tabId, { bypassCache: true });
    }, 600);
  });
}

function readAndReport(cmd, lsKey, lsId) {
  setFlowStep('read');
  chrome.scripting.executeScript({
    target: { tabId: _vanger.tabId },
    func: function(key, id) {
      try {
        var raw = localStorage.getItem(key);
        var store = raw ? JSON.parse(raw) : {};
        var keys = Object.keys(store);
        var data = (id === null) ? store : (store[id] || null);
        var status = data ? 'ok' : (raw ? 'key_ontbreekt' : 'ls_leeg');
        // Lees recente interceptor-log voor diagnostiek
        var hwLog = [];
        try {
          var lr = localStorage.getItem('__hw_log');
          if (lr) hwLog = JSON.parse(lr).slice(0, 10);
        } catch(e) {}
        return { data: data, status: status, keys: keys, hwLog: hwLog };
      } catch(e) { return { data: null, status: 'parse_fout:' + e.message, keys: [], hwLog: [] }; }
    },
    args: [lsKey, lsId]
  }, function(results) {
    var res = results && results[0] && results[0].result;
    var raw = res && res.data;
    if (!raw && res) {
      var keysStr = (res.keys && res.keys.length) ? res.keys.join(', ') : '(geen)';
      addLog('warn', '🔍 ' + lsKey + '[' + (lsId || 'lijst') + '] → ' + res.status + ' · aanwezig: ' + keysStr);
      if (res.hwLog && res.hwLog.length) {
        var lines = res.hwLog.slice(0, 6).map(function(e) {
          var icon = e.type === 'ok' ? '✅' : e.type === 'err' ? '❌' : '·';
          return icon + ' ' + e.msg;
        }).join('  |  ');
        addLog('info', '📋 interceptor log: ' + lines);
      }
    }
    reportResult(cmd.id, raw, null);
  });
}

function reportResult(cmdId, raw, error) {
  setFlowStep('post');
  fetch(HP.url + '/api/tournix/discovery/vanger/cmd-queue/' + cmdId + '/result', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + HP.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: raw || null, error: error || null, session_id: _vanger.sessionId || null })
  })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(res) {
      var status = res ? res.status : 'done';
      if (error || !raw) {
        _vanger.failCount++;
        addLog('warn', '⏭ cmd ' + cmdId + (error ? ': ' + error : ' — geen data, skip'));
      } else {
        _vanger.doneCount++;
        addLog('ok', '✓ cmd ' + cmdId + (res && res.label ? ' · ' + res.label : '') + ' [' + status + ']');
      }
      setFlowStep('done');
      updateCounters();
      setTimeout(function() {
        cockpitCollapse();
        _vanger.currentCmd = null;
        setTimeout(function() { pollNextCmd(); }, 350);
      }, 600);
    })
    .catch(function(e) {
      _vanger.failCount++;
      addLog('err', '❌ result POST: ' + e.message);
      setFlowStep('done');
      updateCounters();
      setTimeout(function() {
        cockpitCollapse();
        _vanger.currentCmd = null;
        setTimeout(function() { pollNextCmd(); }, 1000);
      }, 600);
    });
}

// ══════════════════════════════════════
// VANGER PANE RENDER (shell, eenmalig)
// ══════════════════════════════════════
function renderVangerPane() {
  var pane = $('vangerPane');
  if (!pane) return;
  var connected = !!(HP.url && HP.key);
  var running   = _vanger.running;

  var html = '<div class="vcockpit"' + (running ? ' id="vcCockpit" data-state="idle"' : '') + '>';

  if (!running) {
    html += '<div class="vcockpit-idle">' +
      '<div class="vc-logo-wrap"><div class="vc-ring vc-ring-1 vc-ring--off"></div><div class="vc-ring vc-ring-2 vc-ring--off"></div><div class="vc-dot-static">🏑</div></div>' +
      '<div class="vcockpit-idle-title">' + (connected ? 'Hockey Vanger' : 'Niet verbonden') + '</div>' +
      '<div class="vcockpit-idle-sub">' + (connected ? 'Klaar om te starten' : 'Stel URL en API-key in bij Instellingen') + '</div>' +
      '<button id="vStart" class="vcockpit-start-btn"' + (connected ? '' : ' disabled') + '>▶ Start Vanger</button>' +
      (_vanger.doneCount > 0 || _vanger.failCount > 0
        ? '<div class="vcockpit-lastsession">Vorige sessie: <span class="vcs-ok">' + _vanger.doneCount + ' ✓</span>' +
          (_vanger.failCount > 0 ? ' <span class="vcs-fail">' + _vanger.failCount + ' ✗</span>' : '') + '</div>'
        : '') +
      '</div>';
  } else {
    // Header: tab-status + elapsed + tellers + idle + stop
    html += '<div class="vcockpit-hdr">' +
      '<span id="vcTabStatus" class="vc-tab-status" title="hockey.nl actief">' + (_vanger.tabOk ? '🟢' : '🔴') + '</span>' +
      '<span class="vcockpit-elapsed" id="vSessionElapsed">' + fmtElapsed(_vanger.startMs) + '</span>' +
      '<span class="vcc-inline"><span class="vcc-ok" id="vDoneCount">' + _vanger.doneCount + '</span> ✓' +
      '  <span class="vcc-fail" id="vFailCount">' + _vanger.failCount + '</span> ✗</span>' +
      '<span class="vcc-idle hidden" id="vcIdleBanner">⏸ <span id="vIdleCountdown">20 min</span></span>' +
      '<button id="vStop" class="vcockpit-stop-btn">■ Stop</button>' +
      '</div>';

    // Radar cirkel (always visible when running)
    html += '<div class="vc-center">' +
      '<div class="vc-ring vc-ring-1"></div>' +
      '<div class="vc-ring vc-ring-2"></div>' +
      '<div class="vc-ring vc-ring-3"></div>' +
      '<div class="vc-dot" id="vcPollDot">🏑</div>' +
      '<div class="vc-state-lbl" id="vcStateLbl">Aan het pollen...</div>' +
      '</div>';

    // Steps wrap — expands when active
    html += '<div class="vc-steps-wrap">';
    html += '<div class="vflow-cmd-info"><div class="vflow-cmd-label" id="vcCmdType"></div><div class="vflow-cmd-name" id="vcCmdName"></div></div>';
    html += '<div class="vflow" id="vcFlow">';
    for (var fi = 0; fi < FLOW_STEPS.length; fi++) {
      var s = FLOW_STEPS[fi];
      html += '<div class="vflow-step vflow-pending" id="vfStep_' + s.key + '" style="--i:' + fi + '">' +
        '<div class="vflow-dot" id="vfDot_' + s.key + '">' + s.icon + '</div>' +
        '<div class="vflow-lbl">' + s.label +
        (s.key === 'wait' ? '<span class="vflow-countdown" id="flowWaitLabel" style="display:none"></span>' : '') +
        '</div>' +
        '</div>';
      if (fi < FLOW_STEPS.length - 1) {
        html += '<div class="vflow-line" id="vfLine_' + fi + '"></div>';
      }
    }
    html += '</div>';
    html += '<div class="vflow-loop-track"><div class="vflow-loop-bar" id="vfLoopBar" style="width:0"></div></div>';
    html += '</div>'; // vc-steps-wrap

  }

  html += '</div>';
  pane.innerHTML = html;

  var startBtn = $('vStart');
  if (startBtn) startBtn.addEventListener('click', startVanger);
  var stopBtn = $('vStop');
  if (stopBtn) stopBtn.addEventListener('click', stopVanger);

  // Herstel state na tab-switch
  if (running && _vanger.currentCmd) {
    cockpitSetCmd(_vanger.currentCmd);
    if (_vanger.flowStep) setFlowStep(_vanger.flowStep);
  } else if (running && _vanger.idleStartMs > 0) {
    var banner = $('vcIdleBanner'); if (banner) banner.classList.remove('hidden');
    var sl = $('vcStateLbl'); if (sl) sl.textContent = 'Wacht op queue';
  }
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  var ver = chrome.runtime.getManifest().version;
  var vEl = document.getElementById('appVersion');
  if (vEl) vEl.textContent = ver;
  var hvEl = document.getElementById('helpVersion');
  if (hvEl) hvEl.textContent = ver;

  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  loadSettings();
  renderLog();
});
