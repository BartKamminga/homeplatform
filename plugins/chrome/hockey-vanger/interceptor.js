// interceptor.js v6 — MAIN world
// Intercepts fetch/XHR to app.hockeyweerelt.nl
// Stores /poules/{id}/teams/{id} + /competitions/national/{id}

(function() {
  const TARGET = 'app.hockeyweerelt.nl';
  const STORE_KEY = '__hw_poules';
  const LOG_KEY   = '__hw_log';
  const POULE_RE  = /\/poules\/(\d+)\/teams\/(\d+)/;
  const COMP_RE   = /\/competitions\/national\/(\d+)/;

  console.log('[HDV] 🏑 v6 interceptor laden... target:', TARGET);

  function writeLog(type, msg, detail) {
    try {
      const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      const entry = { ts: Date.now(), type: type, msg: msg };
      if (detail) entry.detail = detail;
      log.unshift(entry);
      if (log.length > 100) log.length = 100;
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch(e) {}
    const color = type === 'ok' ? '#4ade80' : type === 'err' ? '#f87171' : '#93c5fd';
    console.log(`%c[HDV] ${msg}`, `color:${color};font-weight:bold`);
  }

  // ── Intercept fetch ──
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    const resp = await origFetch.apply(this, args);

    if (url.includes(TARGET)) {
      writeLog('info', '→ ' + url.replace(/^https?:\/\/[^/]+/, ''));

      const m = url.match(POULE_RE);
      if (m) {
        try {
          const clone = resp.clone();
          const data = await clone.json();
          save(url, m[1], m[2], data);
        } catch(e) { writeLog('err', 'Parse fout: ' + e.message); }
      }

      const cm = url.match(COMP_RE);
      if (cm) {
        try {
          const clone = resp.clone();
          const data = await clone.json();
          saveCompetition(url, cm[1], data);
        } catch(e) { writeLog('err', 'Parse fout comp: ' + e.message); }
      }
    }
    return resp;
  };

  // ── Intercept XHR ──
  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._hwUrl = typeof url === 'string' ? url : '';
    return xhrOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    if (this._hwUrl.includes(TARGET)) {
      const url = this._hwUrl;
      writeLog('info', '[XHR] → ' + url.replace(/^https?:\/\/[^/]+/, ''));
      if (POULE_RE.test(url)) {
        this.addEventListener('load', function() {
          const m = url.match(POULE_RE);
          if (m) {
            try { save(url, m[1], m[2], JSON.parse(this.responseText)); }
            catch(e) { writeLog('err', 'XHR parse fout: ' + e.message); }
          }
        });
      }
    }
    return xhrSend.apply(this, args);
  };

  // ── Save poule ──
  function save(url, pouleId, teamId, data) {
    try {
      const store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      let pouleName = '', teamName = '', compName = '', className = '';
      try {
        pouleName = data.data.poule.name || '';
        teamName  = data.data.team.name || '';
        compName  = data.data.poule.competition.name || '';
        className = data.data.poule.competition.class_name || '';
      } catch(e) {}

      store[pouleId] = {
        poule_id: pouleId, team_id: teamId,
        poule_name: pouleName, team_name: teamName,
        competition: compName, class_name: className,
        url: url, timestamp: Date.now(), data: data,
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      window.dispatchEvent(new CustomEvent('__hw_captured'));
      const count = Object.keys(store).length;
      let teams = [];
      try { teams = data.data.poule.standings.map(s => s.team.name); } catch(e) {}
      writeLog('ok', '✅ Gevangen: ' + pouleName + ' · ' + compName + ' · ' + className + ' (via ' + teamName + ')  [' + count + ' totaal]', {
        poule_id: pouleId, poule_name: pouleName, comp: compName + ' · ' + className, teams: teams
      });
    } catch(e) {
      writeLog('err', '❌ Save mislukt: ' + e.message);
    }
  }

  // ── Save competition ──
  function saveCompetition(url, compId, data) {
    try {
      const store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      const name   = data.data?.name || ('comp_' + compId);
      const poules = data.data?.poules || [];
      const land   = poules.filter(p => p.competition?.class_name === 'Landelijk');
      let played = 0, rem = 0;
      for (const p of land) for (const m of (p.matches || [])) { if (m.status === 'final') played++; else rem++; }

      store['comp_' + compId] = {
        type: 'competition', comp_id: compId,
        competition: name, poule_count: land.length,
        played_count: played, remaining_count: rem,
        url: url, timestamp: Date.now(), data: data,
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      window.dispatchEvent(new CustomEvent('__hw_captured'));
      writeLog('ok', '✅ Competitie: ' + name + ' · ' + land.length + ' poules · ' + played + ' gespeeld');
    } catch(e) {
      writeLog('err', '❌ Save comp mislukt: ' + e.message);
    }
  }

  window.__hwGet   = () => JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  window.__hwLog   = () => JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  window.__hwClear = () => { localStorage.removeItem(STORE_KEY); localStorage.removeItem(LOG_KEY); console.log('[HDV] 🗑️ Gewist'); };
  window.__hwList  = () => Object.entries(window.__hwGet()).map(([id, e]) =>
    `${id}: ${e.poule_name} · ${e.competition} · ${e.class_name} (${e.team_name})`).join('\n');

  writeLog('info', '🏑 v6 actief op ' + location.hostname + ' · target: ' + TARGET);
})();
