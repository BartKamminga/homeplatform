/* verdict: 'yes' | 'partial' | 'no' — geschiktheid van de call als directe context-input voor een agent */

export const EXTERNAL_GROUPS = [
  {
    title: 'Fiets',
    rows: [
      { source: 'Open-Meteo Forecast API', purpose: 'Weersvoorspelling (regen/temp/wind/zon) voor fietsscore', file: 'backend/services/fiets.py', verdict: 'yes', note: 'Gratis, gestructureerde JSON, stabiel schema — direct te droppen in een prompt.' },
      { source: 'Open-Meteo Geocoding API', purpose: 'Plaatsnaam → coördinaten', file: 'backend/services/fiets.py', verdict: 'yes', note: 'Kleine lookup, geen ruis.' },
    ],
  },
  {
    title: 'Hockey Inside — Vanger-ecosysteem',
    rows: [
      { source: 'hockey.nl', purpose: 'Inlogportaal + matchcenter (Chrome-extensie + Ghost/Playwright)', file: 'plugins/chrome/hockey-vanger, plugins/ghost/ghost.py', verdict: 'no', note: 'Vereist ingelogde sessie + DOM; te fragiel om rechtstreeks als agent-input te gebruiken.' },
      { source: 'app.hockeyweerelt.nl', purpose: 'KNHB-API achter hockey.nl (poules, standings, clubs)', file: 'plugins/chrome/hockey-vanger/interceptor.js, plugins/ghost/ghost.py', verdict: 'partial', note: 'Data is prima gestructureerd, maar moet eerst via Scout/Ghost naar de eigen DB — daarna wel bruikbaar (huidige aanpak van de hockey scan-agent).' },
    ],
  },
  {
    title: 'Scrapster',
    rows: [
      { source: 'masters.altiusrt.com (AltiusRT)', purpose: 'Wedstrijden/standen Masters-hockeytoernooien', file: 'backend/routers/scrapster.py', verdict: 'partial', note: 'Publiek toegankelijk, maar ruwe HTML — moet eerst geparsed worden (gebeurt al met BeautifulSoup).' },
    ],
  },
  {
    title: 'BeatCrades — Beatport-vanger',
    rows: [
      { source: 'api.beatport.com/v4', purpose: 'OAuth2-API voor tracks, tokens en downloadlinks', file: 'backend/routers/providers/beatport/native/*.py', verdict: 'partial', note: 'Schema is prima, maar bevat persoonlijke accountdata — alleen na filteren van gevoelige velden geschikt als context.' },
      { source: 'www.beatport.com', purpose: 'DOM-scrape van playlists/charts door de extensie', file: 'plugins/chrome/beatport-vanger', verdict: 'no', note: 'Alleen bruikbaar binnen een live extensie-sessie, niet programmatisch aanroepbaar.' },
      { source: 'beatportdl (Go-binary)', purpose: 'Downloadprovider (subprocess)', file: 'backend/routers/providers/beatport/binary.py', verdict: 'no', note: 'Downloadtool, geen databron.' },
      { source: 'yt-dlp', purpose: 'Downloadprovider YouTube/SoundCloud', file: 'backend/routers/providers/ytdlp/provider.py', verdict: 'no', note: 'Downloadtool, geen databron.' },
      { source: 'api.github.com (Releases API)', purpose: 'Versiecheck beatportdl / yt-dlp', file: 'backend/routers/downloader.py', verdict: 'partial', note: 'Technisch prima aanroepbaar, maar te smal (alleen versienummer) om als agent-context waarde te hebben.' },
    ],
  },
  {
    title: 'Agent-worker — smart agents',
    rows: [
      { source: 'Anthropic Claude Messages API', purpose: 'LLM-analyse voor hockey scan-, poulebord- en roadmap-agent', file: 'plugins/agent-worker/worker.py', verdict: 'no', note: 'Dit is de agent zelf, geen databron voor context.' },
      { source: 'Interne Agent-API', purpose: 'Context ophalen + resultaat terugposten', file: 'plugins/agent-worker/worker.py', verdict: 'yes', note: 'Al in gebruik als context — bewezen patroon voor nieuwe agents.' },
    ],
  },
  {
    title: 'NKHockey',
    rows: [
      { source: 'GitHub Pages — nk-hockey/data', purpose: 'Statische JSON met poule-competitiedata', file: 'frontend/sites/nkhockey/constants.js', verdict: 'yes', note: 'Publiek, stabiel, geen auth — geschikt voor een toekomstige NK-hockey-agent.' },
    ],
  },
  {
    title: 'Roadmap-CLI',
    rows: [
      { source: 'Interne roadmap-API (G4)', purpose: 'Roadmap-items lezen/wijzigen, changelog/release triggeren', file: 'roadmap.ps1, backend/routers/roadmap.py', verdict: 'yes', note: 'Al in gebruik als context voor de roadmap-agent.' },
    ],
  },
  {
    title: 'Monitoring & infrastructuur',
    rows: [
      { source: 'Bugsink (errortracking)', purpose: 'Crashes/foutmeldingen backend + Ghost-worker', file: 'docker-compose.g4.yml, backend/main.py', verdict: 'yes', note: 'Gestructureerd en kansrijk voor een toekomstige "ops-agent".' },
      { source: 'Docker Engine API', purpose: 'Containerstatus voor het admin-infra-paneel', file: 'backend/routers/infra.py', verdict: 'yes', note: 'Direct bruikbaar als context.' },
      { source: 'Cloudflare Tunnel / analytics', purpose: 'Externe bereikbaarheid + dashboard-links', file: 'backend/routers/system.py', verdict: 'no', note: 'Nu alleen links, geen daadwerkelijke API-aanroep in code.' },
      { source: 'Synology NAS', purpose: 'Netwerkopslag/backup', file: 'backend/core/settings.py', verdict: 'no', note: 'Alleen volume-mount, geen actieve API-call.' },
    ],
  },
  {
    title: 'Alle frontend-sites',
    rows: [
      { source: 'Google Fonts', purpose: 'Lettertype "Inter" laden', file: 'frontend/sites/*/index.html', verdict: 'no', note: 'Geen data, niet relevant als agent-context.' },
    ],
  },
];
