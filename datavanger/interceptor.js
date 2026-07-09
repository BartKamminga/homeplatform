// interceptor.js v5 — MAIN world
// Intercepts fetch to app.hockeyweerelt.nl
// Stores /poules/{id}/teams/{id} responses
// Keys by poule_id to avoid collisions

(function() {
  const TARGET = 'app.hockeyweerelt.nl';
  const STORE_KEY = '__hw_poules';
  const POULE_RE = /\/poules\/(\d+)\/teams\/(\d+)/;
  const COMP_RE = /\/competitions\/national\/(\d+)/;

  // Known competition endpoints (1 call = all data)
  const COMP_IDS = {
    '22': 'MO16',   // Landelijk Meisjes O16
    '21': 'JO16',   // Landelijk Jongens O16
  };

  console.log('[HDV] 🏑 v5 interceptor laden...');

  // ── Intercept fetch ──
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    const resp = await origFetch.apply(this, args);

    if (url.includes(TARGET)) {
      const m = url.match(POULE_RE);
      if (m) {
        try {
          const clone = resp.clone();
          const data = await clone.json();
          save(url, m[1], m[2], data);
        } catch(e) {}
      }

      // Also capture /competitions/national/{id}
      const cm = url.match(COMP_RE);
      if (cm && COMP_IDS[cm[1]]) {
        try {
          const clone = resp.clone();
          const data = await clone.json();
          saveCompetition(url, cm[1], data);
        } catch(e) {}
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
    if (this._hwUrl.includes(TARGET) && POULE_RE.test(this._hwUrl)) {
      const url = this._hwUrl;
      this.addEventListener('load', function() {
        const m = url.match(POULE_RE);
        if (m) {
          try { save(url, m[1], m[2], JSON.parse(this.responseText)); } catch(e) {}
        }
      });
    }
    return xhrSend.apply(this, args);
  };

  // ── Save ──
  function save(url, pouleId, teamId, data) {
    try {
      const store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');

      let pouleName = '', teamName = '', compName = '', className = '';
      try {
        pouleName = data.data.poule.name || '';
        teamName = data.data.team.name || '';
        compName = data.data.poule.competition.name || '';
        className = data.data.poule.competition.class_name || '';
      } catch(e) {}

      store[pouleId] = {
        poule_id: pouleId,
        team_id: teamId,
        poule_name: pouleName,
        team_name: teamName,
        competition: compName,
        class_name: className,
        url: url,
        timestamp: Date.now(),
        data: data
      };

      localStorage.setItem(STORE_KEY, JSON.stringify(store));

      const count = Object.keys(store).length;
      console.log(`%c[HDV] ✅ ${pouleName} · ${compName} · ${className} (${count} poules opgeslagen)`,
        'color:#4ade80;font-weight:bold');
    } catch(e) {
      console.error('[HDV] ❌ Save failed:', e.message);
    }
  }

  // ── Save competition (O16 format: all poules in 1 call) ──
  function saveCompetition(url, compId, data) {
    try {
      const store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      const label = COMP_IDS[compId] || ('comp_' + compId);
      const name = data.data?.name || label;

      // Count Landelijk poules and matches
      const poules = data.data?.poules || [];
      const landelijk = poules.filter(p => p.competition?.class_name === 'Landelijk');
      let totalPlayed = 0, totalRemaining = 0;
      for (const p of landelijk) {
        for (const m of (p.matches || [])) {
          if (m.status === 'final') totalPlayed++; else totalRemaining++;
        }
      }

      store['comp_' + compId] = {
        type: 'competition',
        comp_id: compId,
        label: label,
        competition: name,
        poule_count: landelijk.length,
        played_count: totalPlayed,
        remaining_count: totalRemaining,
        url: url,
        timestamp: Date.now(),
        data: data
      };

      localStorage.setItem(STORE_KEY, JSON.stringify(store));

      console.log(`%c[HDV] ✅ ${name} · ${landelijk.length} poules · ${totalPlayed} gespeeld (comp/${compId})`,
        'color:#4ade80;font-weight:bold');
    } catch(e) {
      console.error('[HDV] ❌ Save competition failed:', e.message);
    }
  }

  // ── Console helpers ──
  window.__hwGet = () => JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  window.__hwClear = () => { localStorage.removeItem(STORE_KEY); console.log('[HDV] 🗑️ Gewist'); };
  window.__hwList = () => {
    const s = window.__hwGet();
    return Object.entries(s).map(([id, e]) =>
      `${id}: ${e.poule_name} · ${e.competition} · ${e.class_name} (${e.team_name})`
    ).join('\n');
  };

  console.log('[HDV] 🏑 v5 actief! Commands: __hwGet() __hwList() __hwClear()');
})();
