// interceptor.js v10 — MAIN world
// Intercepts fetch/XHR to app.hockeyweerelt.nl
// Handles: poule teams, competition detail, competition list, club list, club detail

(function() {
  const TARGET          = 'app.hockeyweerelt.nl';
  const STORE_KEY       = '__hw_poules';
  const LOG_KEY         = '__hw_log';
  const CLUBS_KEY       = '__hw_clubs';
  const DETAILS_KEY     = '__hw_club_details';
  const COMP_DETAIL_KEY = '__hw_comp_detail';
  const COMPS_KEY       = '__hw_competitions';
  const POULE_RE        = /\/poules\/(\d+)\/teams\/(\d+)/;
  const COMP_RE         = /\/competitions\/national\/(\d+)/;
  // /clubs/HH11AR3 — club-id uit URL, ongeacht body-veldnamen
  const CLUB_DETAIL_RE  = /\/clubs\/([A-Za-z0-9]+)(?:\/|$)/;

  console.log('[HDV] 🏑 v9 interceptor laden... target:', TARGET);

  function writeLog(type, msg, detail) {
    try {
      const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      const entry = { ts: Date.now(), type: type, msg: msg };
      if (detail) entry.detail = detail;
      log.unshift(entry);
      if (log.length > 50) log.length = 50;
      try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch(e) {
        // Log vol — herstart met alleen dit entry
        try { localStorage.setItem(LOG_KEY, JSON.stringify([entry])); } catch(e2) {}
      }
    } catch(e) {}
    try { window.dispatchEvent(new CustomEvent('__hw_log_updated')); } catch(e) {}
    const color = type === 'ok' ? '#4ade80' : type === 'err' ? '#f87171' : '#93c5fd';
    console.log(`%c[HDV] ${msg}`, `color:${color};font-weight:bold`);
  }

  // ── Club list shape ──────────────────────────────────────
  function isClubList(body) {
    return Array.isArray(body && body.data) &&
      body.data.length > 0 &&
      body.data[0] && body.data[0].federation_reference_id !== undefined;
  }

  // ── Competition list shape ────────────────────────────────
  function isCompetitionList(body) {
    return Array.isArray(body && body.data) &&
      body.data.length > 0 &&
      typeof body.data[0].poule_id === 'number' &&
      typeof body.data[0].class_name === 'string' &&
      typeof body.data[0].id === 'number' &&
      body.data[0].federation_reference_id === undefined;
  }

  // ── Club detail shape ────────────────────────────────────
  function isClubDetail(body) {
    return body && body.data &&
      !Array.isArray(body.data) &&
      body.data.federation_reference_id &&
      Array.isArray(body.data.teams);
  }

  // ── Intercept fetch ──────────────────────────────────────
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url || '');
    const resp = await origFetch.apply(this, args);

    if (url.includes(TARGET)) {
      const shortUrl = url.replace(/^https?:\/\/[^/]+/, '');
      writeLog('info', resp.status + ' → ' + shortUrl);

      const m = url.match(POULE_RE);
      if (m) {
        try { const clone = resp.clone(); const data = await clone.json(); save(url, m[1], m[2], data); }
        catch(e) { writeLog('err', 'Parse fout poule: ' + e.message); }
        return resp;
      }

      const cm = url.match(COMP_RE);
      if (cm) {
        try { const clone = resp.clone(); const data = await clone.json(); saveCompetition(url, cm[1], data); }
        catch(e) { writeLog('err', 'Parse fout comp: ' + e.message); }
        return resp;
      }

      // URL-patroon club detail — body mist soms federation_reference_id in SPA
      const cdMatch = url.match(CLUB_DETAIL_RE);
      if (cdMatch) {
        try {
          const clone = resp.clone();
          const body = await clone.json();
          // Accepteer ook clubs zonder teams-veld (lege clubs)
          if (body && body.data && !Array.isArray(body.data)) {
            if (!body.data.federation_reference_id) body.data.federation_reference_id = cdMatch[1];
            if (!Array.isArray(body.data.teams)) body.data.teams = [];
            saveClubDetail(url, body.data);
          }
        } catch(e) { writeLog('err', 'Club detail parse: ' + e.message); }
        return resp;
      }

      // Shape detection: club list / competition list
      try {
        const clone = resp.clone();
        const body = await clone.json();
        if (isClubList(body)) { saveClubs(url, body.data); }
        else if (isCompetitionList(body)) { saveCompetitionsList(url, body.data); }
      } catch(e) { /* not JSON or irrelevant shape */ }
    }
    return resp;
  };

  // ── Intercept XHR ───────────────────────────────────────
  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._hwUrl = typeof url === 'string' ? url : '';
    return xhrOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    if (this._hwUrl.includes(TARGET)) {
      const url = this._hwUrl;
      this.addEventListener('load', function() {
        writeLog('info', '[XHR] ' + this.status + ' → ' + url.replace(/^https?:\/\/[^/]+/, ''));
        const m = url.match(POULE_RE);
        if (m) {
          try { save(url, m[1], m[2], JSON.parse(this.responseText)); }
          catch(e) { writeLog('err', 'XHR parse fout: ' + e.message); }
          return;
        }
        const cmXhr = url.match(COMP_RE);
        if (cmXhr) {
          try { saveCompetition(url, cmXhr[1], JSON.parse(this.responseText)); }
          catch(e) { writeLog('err', 'XHR comp parse: ' + e.message); }
          return;
        }

        const cdMatchXhr = url.match(CLUB_DETAIL_RE);
        if (cdMatchXhr) {
          try {
            const body = JSON.parse(this.responseText);
            if (body && body.data && !Array.isArray(body.data)) {
              if (!body.data.federation_reference_id) body.data.federation_reference_id = cdMatchXhr[1];
              if (!Array.isArray(body.data.teams)) body.data.teams = [];
              saveClubDetail(url, body.data);
            }
          } catch(e) { writeLog('err', 'XHR club parse: ' + e.message); }
          return;
        }
        // Shape detect: club list / competition list
        try {
          const body = JSON.parse(this.responseText);
          if (isClubList(body)) saveClubs(url, body.data);
          else if (isCompetitionList(body)) saveCompetitionsList(url, body.data);
        } catch(e) {}
      });
    }
    return xhrSend.apply(this, args);
  };

  // ── localStorage helper met quota-recovery ───────────────
  function isQuotaErr(e) {
    return e.name === 'QuotaExceededError' || e.code === 22 ||
           (e.message && e.message.toLowerCase().indexOf('quota') !== -1);
  }
  function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); return; } catch(e) { if (!isQuotaErr(e)) return; }
    // Stap 1: log weggooien
    try { localStorage.removeItem(LOG_KEY); } catch(e) {}
    try { localStorage.setItem(key, value); return; } catch(e) { if (!isQuotaErr(e)) return; }
    // Stap 2: oude comp-detail weggooien (we schrijven er sowieso overheen)
    if (key !== COMP_DETAIL_KEY) { try { localStorage.removeItem(COMP_DETAIL_KEY); } catch(e) {} }
    try { localStorage.setItem(key, value); return; } catch(e) { if (!isQuotaErr(e)) return; }
    // Stap 3: poules trimmen tot laatste 5
    try {
      const store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      const keys = Object.keys(store).sort();
      if (keys.length > 5) keys.slice(0, keys.length - 5).forEach(function(k) { delete store[k]; });
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch(e) {}
    try { localStorage.setItem(key, value); return; } catch(e) {}
    console.warn('[HDV] localStorage blijft vol, data verloren voor:', key);
  }

  // ── Save poule ───────────────────────────────────────────
  function save(url, pouleId, teamId, data) {
    try {
      const store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      let pouleName = '', teamName = '', compName = '', className = '', seizoen = '';
      try {
        pouleName = data.data.poule.name || '';
        teamName  = data.data.team.name || '';
        compName  = data.data.poule.competition.name || '';
        className = data.data.poule.competition.class_name || '';
      } catch(e) {}
      // Seizoen bepalen op basis van eerste wedstrijddatum (geen season-veld in API)
      try {
        var matches = data.data.poule.matches || [];
        if (matches.length > 0) {
          var d = new Date(matches[0].date);
          var y = d.getFullYear(), mo = d.getMonth() + 1;
          seizoen = mo >= 8 ? (y + '-' + (y + 1)) : ((y - 1) + '-' + y);
        }
      } catch(e) {}

      store[pouleId] = {
        poule_id: pouleId, team_id: teamId,
        poule_name: pouleName, team_name: teamName,
        competition: compName, class_name: className,
        seizoen: seizoen,
        url: url, timestamp: Date.now(), data: data,
      };
      safeSetItem(STORE_KEY, JSON.stringify(store));
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

  // ── Save competition detail ───────────────────────────────
  // Sla alleen de huidige comp op — historische entries zijn niet nodig
  // (de Vanger leest direct na capture en POST naar backend)
  function saveCompetition(url, compId, data) {
    try {
      const name   = (data.data && data.data.name) || ('comp_' + compId);
      const poules = (data.data && data.data.poules) || [];
      let played = 0, rem = 0;
      for (const p of poules) for (const m of (p.matches || [])) { if (m.status === 'final') played++; else rem++; }

      const entry = {};
      entry[String(compId)] = {
        type: 'competition_detail', comp_id: compId, name: name,
        poule_count: poules.length, played_count: played, remaining_count: rem,
        url: url, timestamp: Date.now(), data: data,
      };
      safeSetItem(COMP_DETAIL_KEY, JSON.stringify(entry));
      window.dispatchEvent(new CustomEvent('__hw_captured'));
      writeLog('ok', '✅ Competitie: ' + name + ' · ' + poules.length + ' poules · ' + played + ' gespeeld');
    } catch(e) {
      writeLog('err', '❌ Save comp mislukt: ' + e.message);
    }
  }

  // ── Save competitions list ────────────────────────────────
  function saveCompetitionsList(url, competitions) {
    try {
      safeSetItem(COMPS_KEY, JSON.stringify({ ts: Date.now(), url: url, competitions: competitions }));
      window.dispatchEvent(new CustomEvent('__hw_competitions_discovered'));
      writeLog('ok', '🏆 ' + competitions.length + ' nationale competities onderschept');
    } catch(e) {
      writeLog('err', '❌ saveCompetitionsList mislukt: ' + e.message);
    }
  }

  // ── Save clubs list ──────────────────────────────────────
  function saveClubs(url, clubs) {
    try {
      safeSetItem(CLUBS_KEY, JSON.stringify({ ts: Date.now(), url: url, clubs: clubs }));
      window.dispatchEvent(new CustomEvent('__hw_clubs_discovered'));
      writeLog('ok', '🏒 ' + clubs.length + ' clubs onderschept');
    } catch(e) {
      writeLog('err', '❌ saveClubs mislukt: ' + e.message);
    }
  }

  // ── Save club detail ─────────────────────────────────────
  // Bewaar altijd maar één entry — pushClubDetailFromPage() leest alleen de laatste
  function saveClubDetail(url, clubData) {
    try {
      const extId = clubData.federation_reference_id;
      const entry = { [extId]: { ts: Date.now(), url: url, data: clubData } };
      safeSetItem(DETAILS_KEY, JSON.stringify(entry));
      window.dispatchEvent(new CustomEvent('__hw_club_detail_captured'));
      const teams = clubData.teams || [];
      const youth = teams.filter(t => t.category_group_name === 'Junioren');
      writeLog('ok', '🏒 Club: ' + (clubData.friendly_name || clubData.name) +
        ' · ' + teams.length + ' teams (' + youth.length + ' jeugd)');
    } catch(e) {
      writeLog('err', '❌ saveClubDetail mislukt: ' + e.message);
    }
  }

  window.__hwGet       = () => JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  window.__hwLog       = () => JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  window.__hwClubs     = () => JSON.parse(localStorage.getItem(CLUBS_KEY) || 'null');
  window.__hwDetails   = () => JSON.parse(localStorage.getItem(DETAILS_KEY) || '{}');
  window.__hwCompDetail= () => JSON.parse(localStorage.getItem(COMP_DETAIL_KEY) || '{}');
  window.__hwComps     = () => JSON.parse(localStorage.getItem(COMPS_KEY) || 'null');
  window.__hwClear     = () => {
    localStorage.removeItem(STORE_KEY); localStorage.removeItem(LOG_KEY);
    localStorage.removeItem(CLUBS_KEY); localStorage.removeItem(DETAILS_KEY);
    localStorage.removeItem(COMP_DETAIL_KEY); localStorage.removeItem(COMPS_KEY);
    console.log('[HDV] 🗑️ Gewist');
  };
  window.__hwList   = () => Object.entries(window.__hwGet()).map(([id, e]) =>
    `${id}: ${e.poule_name} · ${e.competition} · ${e.class_name} (${e.team_name})`).join('\n');

  writeLog('info', '🏑 v10 actief op ' + location.hostname + ' · target: ' + TARGET);
})();
