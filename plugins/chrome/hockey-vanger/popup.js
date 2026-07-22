// popup.js v11.0 — Vanger 3.0: pure bridge via server cmd-queue (364)
var HP = { url: '', key: '', delayMin: 10000, delayMax: 15000 };
var LOG = [];
var _vanger = {
  running: false, currentCmd: null, doneCount: 0, failCount: 0,
  countdownMs: 0, tabId: null, tickTimer: null, stepTimer: null, tabLoadedListener: null
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
      countdownMs: 0, tabId: tab.id, tickTimer: null, stepTimer: null, tabLoadedListener: null
    };
    addLog('info', '▶ Vanger 3.0 gestart');
    startHeartbeat();
    renderVangerPane();
    pollNextCmd();
  });
}

function stopVanger() {
  clearInterval(_vanger.tickTimer);
  clearTimeout(_vanger.stepTimer);
  if (_vanger.tabLoadedListener) {
    chrome.tabs.onUpdated.removeListener(_vanger.tabLoadedListener);
    _vanger.tabLoadedListener = null;
  }
  _vanger.running = false;
  _vanger.currentCmd = null;
  addLog('info', '■ Gestopt — ✓ ' + _vanger.doneCount + '  ✗ ' + _vanger.failCount);
  stopHeartbeat();
  renderVangerPane();
}

function pollNextCmd() {
  if (!_vanger.running) return;
  fetch(HP.url + '/api/tournix/discovery/vanger/cmd-queue/next', {
    headers: { 'Authorization': 'Bearer ' + HP.key }
  })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (!data || data.done) {
        addLog('ok', '✅ Queue leeg — ✓ ' + _vanger.doneCount + '  ✗ ' + _vanger.failCount);
        toast('✅ Queue leeg!');
        stopVanger();
        return;
      }
      executeCmd(data);
    })
    .catch(function(err) {
      addLog('err', '⚠️ Kan cmd niet ophalen: ' + err.message);
      _vanger.running = false;
      renderVangerPane();
    });
}

function executeCmd(cmd) {
  _vanger.currentCmd = cmd;
  addLog('info', '→ ' + cmd.cmd_type + ' · ' + (cmd.params.label || cmd.params.external_id || ''));
  sendHeartbeat();
  renderVangerPane();

  var hash, lsKey, lsId;
  if (cmd.cmd_type === 'get_poule') {
    hash  = '/team/' + cmd.params.team_id + '|' + cmd.params.poule_id + '/standings';
    lsKey = '__hw_poules';
    lsId  = String(cmd.params.poule_id);
  } else if (cmd.cmd_type === 'scan_club') {
    hash  = '/club/' + cmd.params.external_id + '/field-teams';
    lsKey = '__hw_clubs';
    lsId  = String(cmd.params.external_id);
  } else {
    addLog('warn', '⚠️ Onbekend cmd_type: ' + cmd.cmd_type);
    reportResult(cmd.id, null, 'Onbekend cmd_type: ' + cmd.cmd_type);
    return;
  }

  if (_vanger.tabLoadedListener) {
    chrome.tabs.onUpdated.removeListener(_vanger.tabLoadedListener);
    _vanger.tabLoadedListener = null;
  }

  var onTabLoaded = function(tabId, info) {
    if (tabId !== _vanger.tabId || info.status !== 'complete') return;
    chrome.tabs.onUpdated.removeListener(onTabLoaded);
    _vanger.tabLoadedListener = null;

    var delay = randDelay();
    var startTime = Date.now();
    _vanger.countdownMs = delay;
    _vanger.tickTimer = setInterval(function() {
      _vanger.countdownMs = Math.max(0, delay - (Date.now() - startTime));
      var el = $('vCountdown');
      if (el) el.textContent = fmtMs(_vanger.countdownMs);
    }, 120);
    _vanger.stepTimer = setTimeout(function() {
      clearInterval(_vanger.tickTimer);
      readAndReport(cmd, lsKey, lsId);
    }, delay);
  };
  _vanger.tabLoadedListener = onTabLoaded;
  chrome.tabs.onUpdated.addListener(onTabLoaded);

  chrome.scripting.executeScript({
    target: { tabId: _vanger.tabId },
    func: function(h) { window.location.hash = h; },
    args: [hash]
  }, function() {
    setTimeout(function() { chrome.tabs.reload(_vanger.tabId); }, 300);
  });
}

function readAndReport(cmd, lsKey, lsId) {
  chrome.scripting.executeScript({
    target: { tabId: _vanger.tabId },
    func: function(key, id) {
      try {
        var store = JSON.parse(localStorage.getItem(key) || '{}');
        return store[id] || null;
      } catch(e) { return null; }
    },
    args: [lsKey, lsId]
  }, function(results) {
    var raw = results && results[0] && results[0].result;
    reportResult(cmd.id, raw, null);
  });
}

function reportResult(cmdId, raw, error) {
  fetch(HP.url + '/api/tournix/discovery/vanger/cmd-queue/' + cmdId + '/result', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + HP.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: raw || null, error: error || null })
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
      _vanger.currentCmd = null;
      renderVangerPane();
      setTimeout(function() { pollNextCmd(); }, 400);
    })
    .catch(function(e) {
      _vanger.failCount++;
      addLog('err', '❌ result POST: ' + e.message);
      _vanger.currentCmd = null;
      renderVangerPane();
      setTimeout(function() { pollNextCmd(); }, 1000);
    });
}

// ══════════════════════════════════════
// VANGER PANE RENDER
// ══════════════════════════════════════
function renderVangerPane() {
  var pane = $('vangerPane');
  if (!pane) return;
  var connected = !!(HP.url && HP.key);
  var running   = _vanger.running;
  var cmd       = _vanger.currentCmd;

  var statusDot  = connected ? (running ? '🟢' : '🟡') : '⚫';
  var statusText = running ? 'Bezig' : connected ? 'Online · inactief' : 'Niet verbonden';

  var html = '<div style="padding:12px;display:flex;flex-direction:column;gap:10px;">';

  // Status balk
  html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,255,255,.05);border-radius:8px;">' +
    '<span style="font-size:16px;">' + statusDot + '</span>' +
    '<span style="font-size:12px;font-weight:600;flex:1;">' + statusText + '</span>' +
    '</div>';

  // Start / stop knop
  if (!running) {
    html += '<button id="vStart" style="padding:10px;border-radius:8px;border:none;background:#1565c0;color:#fff;font-size:13px;font-weight:600;cursor:pointer;"' +
      (connected ? '' : ' disabled') + '>▶ Start</button>';
  } else {
    html += '<button id="vStop" style="padding:10px;border-radius:8px;border:none;background:#b71c1c;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">■ Stop</button>';
  }

  // Huidige cmd
  if (running && cmd) {
    var cdMs = _vanger.countdownMs;
    html += '<div style="background:rgba(255,255,255,.05);border-radius:8px;padding:10px 12px;">' +
      '<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">' + cmd.cmd_type + '</div>' +
      '<div style="font-size:12px;font-weight:600;">' + (cmd.params.label || cmd.params.external_id || '') + '</div>' +
      (cdMs > 0 ? '<div style="font-size:11px;color:#90caf9;margin-top:4px;" id="vCountdown">' + fmtMs(cdMs) + '</div>' : '') +
      '</div>';
  }

  // Sessie tellers
  if (running || _vanger.doneCount > 0 || _vanger.failCount > 0) {
    html += '<div style="display:flex;gap:8px;">' +
      '<div style="flex:1;text-align:center;padding:8px;background:rgba(76,175,80,.15);border-radius:8px;">' +
      '<div style="font-size:18px;font-weight:700;color:#4caf50;">' + _vanger.doneCount + '</div>' +
      '<div style="font-size:10px;color:#888;">gedaan</div></div>' +
      '<div style="flex:1;text-align:center;padding:8px;background:rgba(244,67,54,.15);border-radius:8px;">' +
      '<div style="font-size:18px;font-weight:700;color:#f44336;">' + _vanger.failCount + '</div>' +
      '<div style="font-size:10px;color:#888;">fouten</div></div>' +
      '</div>';
  }

  html += '</div>';
  pane.innerHTML = html;

  var startBtn = $('vStart');
  if (startBtn) startBtn.addEventListener('click', startVanger);
  var stopBtn = $('vStop');
  if (stopBtn) stopBtn.addEventListener('click', stopVanger);
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  var vEl = document.getElementById('appVersion');
  if (vEl) vEl.textContent = chrome.runtime.getManifest().version;

  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  loadSettings();
  renderLog();
});
