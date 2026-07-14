// Beatport Vanger — popup.js v1.0
// Slaat Beatport playlist/chart/release URLs op en pusht naar BeatCrades.

var HP = { url: '', key: '' };
var QUEUE = [];        // [{ url, name, type, genre, genres, trackCount, artist, savedAt }]
var PUSHING = {};      // itemIdx → true/false
var CURRENT_PAGE = null; // actieve pageInfo incl. geselecteerd genre

var $ = function(id) { return document.getElementById(id); };

// ── URL-type detectie ───────────────────────────────────────────────────────

var TYPE_LABELS = {
  playlists: 'Playlist',
  charts:    'Chart',
  releases:  'Release',
  tracks:    'Track',
  labels:    'Label',
  artists:   'Artiest',
};

// Normaliseer enkelvoud → meervoud zodat TYPE_LABELS altijd matcht
var TYPE_NORMALIZE = {
  playlist: 'playlists',
  chart:    'charts',
  release:  'releases',
  track:    'tracks',
  label:    'labels',
  artist:   'artists',
};

function detectBeatportType(url) {
  // Ondersteunt: /chart/, /charts/, /playlist/, /playlists/, /library/playlists/, etc.
  var m = url.match(/beatport\.com\/(?:[a-z]{2}\/)?(?:(?:catalog|library)\/)?([a-z]+)\//);
  if (!m) return null;
  var seg = m[1].toLowerCase();
  var normalized = TYPE_NORMALIZE[seg] || (TYPE_LABELS[seg] ? seg : null);
  return normalized;
}

function cleanTitle(raw) {
  // "Chart Name | Beatport" of "Playlist Name - Beatport"
  return (raw || '')
    .replace(/\s*[|\-–—]\s*beatport\s*$/i, '')
    .replace(/\s*\|\s*.*$/, '')
    .trim();
}

// ── Toast ───────────────────────────────────────────────────────────────────

function toast(msg, duration) {
  var t = $('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._tid);
  t._tid = setTimeout(function() { t.style.display = 'none'; }, duration || 2500);
}

// ── Tabs ────────────────────────────────────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-tab') === tab);
  });
  $('pane-queue').classList.toggle('hidden', tab !== 'queue');
  $('pane-settings').classList.toggle('hidden', tab !== 'settings');
}

// ── Settings ────────────────────────────────────────────────────────────────

function loadSettings(cb) {
  chrome.storage.sync.get(['bp_hp_url', 'bp_hp_key'], function(r) {
    HP.url = (r.bp_hp_url || '').replace(/\/$/, '');
    HP.key = r.bp_hp_key || '';
    renderSettings();
    if (cb) cb();
  });
}

function saveSettings() {
  var url = ($('hpUrl').value || '').trim().replace(/\/$/, '');
  var key = ($('hpKey').value || '').trim();
  chrome.storage.sync.set({ bp_hp_url: url, bp_hp_key: key }, function() {
    HP.url = url; HP.key = key;
    toast('✅ Opgeslagen');
    renderSettings();
  });
}

function testConnection() {
  if (!HP.url || !HP.key) { toast('❌ Vul eerst URL en key in'); return; }
  fetch(HP.url + '/api/health', {
    headers: { 'Authorization': 'Bearer ' + HP.key }
  })
    .then(function(r) {
      if (r.status === 401) toast('❌ API key ongeldig');
      else if (r.ok) toast('✅ Verbinding OK!');
      else toast('❌ HTTP ' + r.status);
    })
    .catch(function(e) { toast('❌ ' + e.message); });
}

function renderSettings() {
  var pane = $('settings-content');
  var configured = HP.url && HP.key;
  pane.innerHTML =
    '<div class="settings-group">' +
      '<div class="settings-label">Backend URL</div>' +
      '<input class="settings-input" id="hpUrl" value="' + esc(HP.url) + '" placeholder="https://webheaven.nl"/>' +
      '<div class="settings-hint">HomePlatform adres, zonder trailing slash</div>' +
    '</div>' +
    '<div class="settings-group">' +
      '<div class="settings-label">API Key</div>' +
      '<input class="settings-input" id="hpKey" type="password" value="' + esc(HP.key) + '" placeholder="je-api-key"/>' +
      '<div class="settings-hint">Admin → Account → API key aanmaken</div>' +
    '</div>' +
    '<button class="settings-save" id="btnSave">Opslaan</button>' +
    '<button class="settings-save" id="btnTest" style="background:#1e3a5f">🔗 Test verbinding</button>' +
    (configured
      ? '<div class="settings-status settings-ok">✅ Geconfigureerd: ' + esc(HP.url) + '</div>'
      : '<div class="settings-status settings-err">⚠️ Nog niet geconfigureerd</div>');

  setTimeout(function() {
    var s = $('btnSave'); if (s) s.addEventListener('click', saveSettings);
    var t = $('btnTest'); if (t) t.addEventListener('click', testConnection);
  }, 0);
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Queue opslaan/laden ──────────────────────────────────────────────────────

function loadQueue(cb) {
  chrome.storage.local.get(['bp_queue'], function(r) {
    QUEUE = r.bp_queue || [];
    if (cb) cb();
  });
}

function saveQueue() {
  chrome.storage.local.set({ bp_queue: QUEUE });
}

function queueAdd(item) {
  // Voorkom dubbelen op URL
  var exists = QUEUE.some(function(q) { return q.url === item.url; });
  if (exists) return false;
  QUEUE.unshift(item);
  saveQueue();
  return true;
}

function queueRemove(idx) {
  QUEUE.splice(idx, 1);
  saveQueue();
}

// ── Huidige pagina uitlezen ─────────────────────────────────────────────────

function readCurrentPage(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tab = tabs && tabs[0];
    if (!tab) return cb(null);
    var url = tab.url || '';
    if (url.indexOf('beatport.com') === -1) return cb(null);

    var type = detectBeatportType(url);
    if (!type) return cb({ url: url, name: null, type: null });

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function() {
        function meta(attr, val) {
          var el = document.querySelector('meta[' + attr + '="' + val + '"]');
          return el ? (el.getAttribute('content') || '').trim() : '';
        }
        function text(sel) {
          var el = document.querySelector(sel);
          return el ? el.textContent.trim() : '';
        }

        // Naam: og:title > h1 > document.title
        var name = meta('property', 'og:title')
          || text('h1')
          || document.title;

        // Genres: alle genre-links op de pagina (dedupliceren)
        var genreEls = document.querySelectorAll('a[href*="/genre/"]');
        var genres = [];
        for (var gi = 0; gi < genreEls.length; gi++) {
          var gt = genreEls[gi].textContent.trim();
          if (gt && genres.indexOf(gt) === -1) genres.push(gt);
        }

        // JSON-LD structured data (betrouwbaarst)
        var jsonld = {};
        try {
          var lds = document.querySelectorAll('script[type="application/ld+json"]');
          for (var i = 0; i < lds.length; i++) {
            var parsed = JSON.parse(lds[i].textContent);
            var obj = Array.isArray(parsed) ? parsed[0] : parsed;
            if (obj && (obj.name || obj.genre || obj.numberOfTracks)) {
              jsonld = obj;
              break;
            }
          }
        } catch(e) {}

        // Genres uit JSON-LD als DOM-poging niets opleverde
        if (genres.length === 0 && jsonld.genre) {
          var jg = jsonld.genre;
          genres = Array.isArray(jg) ? jg.map(String) : [String(jg)];
        }

        // Track count
        var trackCount = jsonld.numberOfTracks || jsonld.numTracks || null;
        if (!trackCount) {
          // Probeer element met track-teller tekst, bijv. "42 Tracks"
          var countEl = document.querySelector('[class*="track-count"], [class*="TrackCount"], [class*="num-tracks"]');
          if (!countEl) {
            // Fallback: zoek tekst die eruitziet als "N Tracks"
            var allSpans = document.querySelectorAll('span, p, div');
            for (var j = 0; j < allSpans.length; j++) {
              var t = allSpans[j].textContent.trim();
              if (/^\d+\s+Tracks?$/i.test(t)) { trackCount = parseInt(t); break; }
            }
          } else {
            trackCount = parseInt(countEl.textContent) || null;
          }
        }

        // Beschrijving
        var description = meta('property', 'og:description')
          || meta('name', 'description')
          || (jsonld.description || '');

        // Artiest / curator
        var artist = '';
        if (jsonld.author) artist = typeof jsonld.author === 'string' ? jsonld.author : (jsonld.author.name || '');
        if (!artist && jsonld.byArtist) artist = typeof jsonld.byArtist === 'string' ? jsonld.byArtist : (jsonld.byArtist.name || '');

        // Coverafbeelding
        var image = meta('property', 'og:image') || (jsonld.image && (jsonld.image.url || jsonld.image)) || '';

        return { name: name, genres: genres, trackCount: trackCount, description: description, artist: artist, image: image };
      }
    }, function(results) {
      var data = (results && results[0] && results[0].result) || {};
      var allGenres = data.genres || [];
      cb({
        url: url,
        type: type,
        name: cleanTitle(data.name || tab.title || ''),
        genres: allGenres,
        genre: allGenres[0] || '',
        trackCount: data.trackCount || null,
        description: data.description || '',
        artist: data.artist || '',
        image: data.image || '',
      });
    });
  });
}

// ── Naar BeatCrades pushen ──────────────────────────────────────────────────

function pushAllByGenre() {
  if (!HP.url || !HP.key) {
    toast('❌ HomePlatform niet geconfigureerd (zie ⚙️)');
    return;
  }
  if (QUEUE.length === 0) {
    toast('❌ Lijst is leeg');
    return;
  }

  var now = new Date();
  var dd   = String(now.getDate()).padStart(2, '0');
  var mm   = String(now.getMonth() + 1).padStart(2, '0');
  var yyyy = now.getFullYear();
  var hh   = String(now.getHours()).padStart(2, '0');
  var min  = String(now.getMinutes()).padStart(2, '0');
  var sectionName = 'Beatport Vanger — ' + dd + '-' + mm + '-' + yyyy + ' ' + hh + ':' + min;

  var items = QUEUE.map(function(q) {
    return {
      url:         q.url,
      name:        q.name || '',
      genre:       q.genre || 'Overig',
      track_count: q.trackCount || null,
      artist:      q.artist || '',
      format:      'flac',
    };
  });

  var btn = $('btnPushAll');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Bezig…'; }

  fetch(HP.url + '/api/beatcrades/from-vanger', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + HP.key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ section_name: sectionName, items: items }),
  })
    .then(function(r) {
      return r.ok ? r.json() : r.text().then(function(t) { throw new Error('HTTP ' + r.status + ': ' + t.slice(0, 100)); });
    })
    .then(function(data) {
      toast('✅ ' + data.crade_count + ' items in ' + data.rack_count + ' genres aangemaakt in BeatCrades');
      QUEUE = [];
      saveQueue();
      renderSavedList();
    })
    .catch(function(e) {
      toast('❌ ' + e.message.slice(0, 80));
      if (btn) { btn.disabled = false; btn.textContent = '📋 Per genre naar BeatCrades'; }
    });
}

function pushToBeatCrades(item, onDone) {
  if (!HP.url || !HP.key) {
    toast('❌ HomePlatform niet geconfigureerd (zie ⚙️)');
    onDone && onDone(false);
    return;
  }
  fetch(HP.url + '/api/beatcrades/crades', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + HP.key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ source_url: item.url, name: item.name || '', format: 'flac' })
  })
    .then(function(r) {
      return r.ok ? r.json() : r.text().then(function(t) { throw new Error('HTTP ' + r.status + ': ' + t.slice(0, 100)); });
    })
    .then(function() {
      toast('✅ ' + (item.name || item.url) + ' → BeatCrades');
      onDone && onDone(true);
    })
    .catch(function(e) {
      toast('❌ ' + e.message.slice(0, 60));
      onDone && onDone(false);
    });
}

// ── Render huidige pagina card ──────────────────────────────────────────────

function selectGenre(genre) {
  if (!CURRENT_PAGE) return;
  CURRENT_PAGE.genre = genre;
  renderCurrentPage(CURRENT_PAGE);
}

function renderCurrentPage(pageInfo) {
  CURRENT_PAGE = pageInfo;
  var el = $('current-page');
  if (!pageInfo) {
    el.innerHTML = '<div class="not-beatport">Ga naar een Beatport playlist, chart of release</div>';
    return;
  }
  if (!pageInfo.type) {
    el.innerHTML = '<div class="not-beatport">Geen playlist, chart of release pagina</div>';
    return;
  }

  var alreadySaved = QUEUE.some(function(q) { return q.url === pageInfo.url; });
  var typeLabel = TYPE_LABELS[pageInfo.type] || pageInfo.type;
  var allGenres = pageInfo.genres || (pageInfo.genre ? [pageInfo.genre] : []);

  // Genres: meerdere → kiesbare chips; één → gewone chip in meta
  var genreHtml = '';
  if (allGenres.length > 1) {
    genreHtml = '<div class="genre-picker">';
    for (var gi = 0; gi < allGenres.length; gi++) {
      var isSelected = allGenres[gi] === pageInfo.genre;
      genreHtml += '<span class="meta-chip genre-sel' + (isSelected ? ' genre-active' : '') + '" data-genre="' + esc(allGenres[gi]) + '">' + esc(allGenres[gi]) + '</span>';
    }
    genreHtml += '</div>';
  }

  var meta = '';
  if (pageInfo.genre && allGenres.length <= 1) meta += '<span class="meta-chip">' + esc(pageInfo.genre) + '</span>';
  if (pageInfo.trackCount) meta += '<span class="meta-chip">' + pageInfo.trackCount + ' tracks</span>';
  if (pageInfo.artist)     meta += '<span class="meta-chip">' + esc(pageInfo.artist) + '</span>';

  el.innerHTML =
    '<div class="current-card">' +
      '<div class="page-type">' + typeLabel + '</div>' +
      '<div class="page-name">' + esc(pageInfo.name || '(onbekende naam)') + '</div>' +
      (meta ? '<div class="meta-chips">' + meta + '</div>' : '') +
      genreHtml +
      '<div class="page-url">' + esc(pageInfo.url) + '</div>' +
      (alreadySaved
        ? '<div class="saved-badge">✓ Al in lijst</div>'
        : '<button class="btn-save" id="btnSaveThis">+ Opslaan in lijst</button>'
      ) +
    '</div>';

  setTimeout(function() {
    // Genre-chips klikbaar maken
    el.querySelectorAll('.genre-sel').forEach(function(chip) {
      chip.addEventListener('click', function() {
        selectGenre(chip.getAttribute('data-genre'));
      });
    });

    if (!alreadySaved) {
      var btn = $('btnSaveThis');
      if (btn) btn.addEventListener('click', function() {
        var added = queueAdd({
          url: pageInfo.url,
          name: pageInfo.name || '',
          type: pageInfo.type,
          genre: pageInfo.genre || '',
          genres: pageInfo.genres || [],
          trackCount: pageInfo.trackCount || null,
          artist: pageInfo.artist || '',
          savedAt: new Date().toISOString(),
        });
        if (added) {
          toast('✅ Opgeslagen: ' + (pageInfo.name || pageInfo.url));
          renderCurrentPage(Object.assign({}, pageInfo));
          renderSavedList();
        }
      });
    }
  }, 0);
}

function cycleGenre(idx) {
  var item = QUEUE[idx];
  if (!item || !item.genres || item.genres.length <= 1) return;
  var cur = item.genres.indexOf(item.genre);
  item.genre = item.genres[(cur + 1) % item.genres.length];
  saveQueue();
  renderSavedList();
}

// ── Render opgeslagen lijst ─────────────────────────────────────────────────

function renderSavedList() {
  var el = $('saved-list');
  if (QUEUE.length === 0) {
    el.innerHTML = '<div class="empty-list">Nog geen URLs opgeslagen</div>';
    return;
  }

  var html = '<div class="list-header">' + QUEUE.length + ' opgeslagen</div>';
  QUEUE.forEach(function(item, idx) {
    var typeLabel = TYPE_LABELS[item.type] || (item.type || '');
    var pushing = !!PUSHING[idx];
    var chips = '';
    if (item.genre) {
      var hasMulti = item.genres && item.genres.length > 1;
      chips += '<span class="meta-chip' + (hasMulti ? ' genre-multi' : '') + '"' +
        (hasMulti ? ' data-idx="' + idx + '" title="Klik om genre te wisselen"' : '') + '>' +
        esc(item.genre) + (hasMulti ? ' ▾' : '') + '</span>';
    }
    if (item.trackCount) chips += '<span class="meta-chip">' + item.trackCount + ' tracks</span>';
    html +=
      '<div class="saved-item" id="si-' + idx + '">' +
        '<div class="saved-item-info">' +
          '<div class="saved-item-type">' + typeLabel + (chips ? ' · ' + chips : '') + '</div>' +
          '<div class="saved-item-name">' + esc(item.name || item.url) + '</div>' +
          '<div class="saved-item-url">' + esc(item.url) + '</div>' +
        '</div>' +
        '<div class="saved-item-actions">' +
          '<button class="btn-push" data-idx="' + idx + '"' + (pushing ? ' disabled' : '') + '>' +
            (pushing ? '⏳' : '📤') +
          '</button>' +
          '<button class="btn-del" data-idx="' + idx + '">✕</button>' +
        '</div>' +
      '</div>';
  });

  var anyPushing = Object.values(PUSHING).some(Boolean);
  html +=
    '<div class="list-footer">' +
      '<button class="btn-push-all" id="btnPushAll"' + (anyPushing || !HP.url ? ' disabled' : '') + '>📋 Per genre naar BeatCrades</button>' +
      '<button class="btn-clear-all" id="btnClearAll">Wis lijst</button>' +
    '</div>';

  el.innerHTML = html;

  // Events
  el.querySelectorAll('.genre-multi').forEach(function(chip) {
    chip.addEventListener('click', function(e) {
      e.stopPropagation();
      cycleGenre(parseInt(chip.getAttribute('data-idx')));
    });
  });

  el.querySelectorAll('.btn-push').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(btn.getAttribute('data-idx'));
      var item = QUEUE[idx];
      if (!item || PUSHING[idx]) return;
      PUSHING[idx] = true;
      renderSavedList();
      pushToBeatCrades(item, function(ok) {
        delete PUSHING[idx];
        if (ok) { queueRemove(idx); QUEUE = QUEUE; }  // saveQueue al gedaan
        renderSavedList();
      });
    });
  });

  el.querySelectorAll('.btn-del').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(btn.getAttribute('data-idx'));
      queueRemove(idx);
      renderSavedList();
    });
  });

  var pushAll = $('btnPushAll');
  if (pushAll) {
    pushAll.addEventListener('click', pushAllByGenre);
  }

  var clearAll = $('btnClearAll');
  if (clearAll) {
    clearAll.addEventListener('click', function() {
      if (!confirm('Lijst leegmaken?')) return;
      QUEUE = []; saveQueue(); renderSavedList();
    });
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

function refreshCurrentPage() {
  readCurrentPage(function(pageInfo) {
    renderCurrentPage(pageInfo);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { switchTab(btn.getAttribute('data-tab')); });
  });

  loadSettings(function() {
    loadQueue(function() {
      readCurrentPage(function(pageInfo) {
        renderCurrentPage(pageInfo);
        renderSavedList();
      });
    });
  });

  // Automatisch updaten als de gebruiker naar een andere tab of URL navigeert
  chrome.tabs.onActivated.addListener(function() {
    setTimeout(refreshCurrentPage, 300);
  });

  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
    if (changeInfo.status === 'complete') {
      setTimeout(refreshCurrentPage, 500);
    }
  });
});
