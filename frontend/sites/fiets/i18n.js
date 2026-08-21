import { useState, useEffect } from 'react'
import { api } from '@core/api.js'

// Lichte eigen vertaal-dictionary (geen i18n-library) — past bij de minimal-
// dependency stijl van dit platform (item 878). Taalvoorkeur wordt net als
// alle andere fiets-instellingen opgeslagen als fiets_language in
// user_preferences.extra (via het bestaande /api/auth/me/ui-prefs endpoint).
const DICT = {
  nl: {
    loading: 'Prognose laden…',
    weatherUnavailable: 'Weerdata niet beschikbaar',
    emptyState: 'Geen weerdata beschikbaar. Probeer het later opnieuw.',

    'tier.excellent': 'Uitstekend',
    'tier.good': 'Goed',
    'tier.fair': 'Matig',
    'tier.poor': 'Slecht',
    bikingWeather: 'fietsweer',

    howScoreWorks: 'Hoe werkt de score?',
    close: 'Sluiten',
    'weight.rain': 'Regen',
    'weight.temp': 'Temperatuur',
    'weight.sun': 'Zon',
    'weight.wind': 'Wind',
    'weightNote.rain': 'Hoe meer het regent en hoe zwaarder de bui, hoe lager deze bijdrage.',
    'weightNote.temp': 'Prettigst tussen 15-22°C, instelbaar.',
    'weightNote.sun': 'Meer zon (minder bewolking) is beter.',
    'weightNote.wind': 'Harde wind en tegenwind tellen negatief, instelbaar.',
    'debugWeightNote.temp': 'Prettigst tussen 15-22°C, instelbaar in Instellingen.',
    'debugWeightNote.wind': 'Harde wind en tegenwind tellen negatief, instelbaar in Instellingen.',
    weightPct: 'telt voor {pct}% mee.',
    daylightTitle: 'Daglicht',
    daylightExplain: 'werkt los van de 4 gewichten hierboven: \'s nachts dimt de score vloeiend naar 0, overdag blijft hij onveranderd. Instelbaar via "neem ook donkere uren mee" bij Instellingen.',
    sourcesTitle: '3 bronnen',
    sourcesExplain: 'de score is een gemiddelde van KNMI, NOAA GFS en DWD ICON.',

    'tab.fiets': 'Fiets',
    'tab.temp': 'Temp',
    'tab.rain': 'Regen',
    'tab.wind': 'Wind',
    'tab.zon': 'Zon',
    'windMode.chart': 'Grafiek',
    'windMode.arrow': 'Pijl',
    'windMode.both': 'Beide',
    withBreakdown: 'Met opbouw',
    simple: 'Simpel',
    'legend.score': 'Score',
    'legend.light': 'Licht',
    'legend.moderate': 'Matig',
    'legend.heavy': 'Zwaar',

    tijdvakTitle: 'Tijdvak',
    dragHint: 'sleep de handvatjes op de grafiek',
    nextBestTooltip: 'Volgende beste tijdvak vandaag',
    bestMoment: 'Beste moment',
    noGoodMoment: 'Geen goed moment gevonden',
    showThisWindow: 'Toon dit tijdvak in de grafiek',
    backToAllDays: 'Alle dagen',
    now: 'nu',

    'nav.debug': 'Debug-data',
    'nav.settings': 'Instellingen',
    'nav.account': 'Account',

    debugIntro: 'Ruwe brondata per model (KNMI/GFS/ICON los), het geblende resultaat en de score-tussenstappen, per uur. Puur om te leren hoe de score tot stand komt — sleep horizontaal om alle kolommen te zien.',
    notSaved: 'niet opgeslagen — wordt gevraagd bij verlaten',
    confirmLeave: 'Je hebt de verhoudingen aangepast maar nog niet opgeslagen. Nu opslaan?',
    loadingShort: 'Laden…',
    daylightDebugExplain: 'werkt los van deze 4 gewichten: \'s nachts dimt de score vloeiend naar 0 (kolom \'weer\' toont de ongedimde waarde). Live bijgewerkt bij het aanpassen van de gewichten hierboven.',
    'col.time': 'tijd',
    'col.day': 'dag',
    'col.blended': 'Geblend',
    'col.deviation': 'afwijk.',
    'col.deviationTitle': 'Vlag als de actieve bronnen het duidelijk oneens zijn (temp/regenkans-spreiding boven de drempel)',
    'col.score': 'Score',
    'sub.cloud': 'bew%',
    'sub.rain': 'regen',
    'sub.temp': 'temp',
    'sub.sun': 'zon',
    'sub.wind': 'wind',
    'sub.weather': 'weer',
    'sub.total': 'totaal',
    tierColTooltip: 'Regen-intensiteitsklasse (0-3), afgeleid uit de WMO weather_code: 0 = droog/bewolkt, 1 = lichte motregen, 2 = matige motregen/regen, 3 = zware regen/onweer/ijzel. Strengste van de actieve bronnen (voorzichtigheidsprincipe). Bepaalt samen met mm de regen-score.',
    weatherColTooltip: 'Weerscore vóór het dimmen door daglicht (som van regen+temp+zon+wind). \'totaal\' = weer × daglicht-factor uit de dag-kolom (of ongedimd als \'donkere uren meenemen\' aanstaat).',
    daylightFactorTooltip: 'Daglicht-factor (0=nacht, 1=dag, vloeiend in de schemering) — dimt de weerscore naar \'totaal\'.',
    labelThresholdsTitle: 'Score-staffel voor "Beste moment" (0-10 schaal, geldt voor de hoofd-app):',
    'labelThreshold.excellent': 'Uitstekend vanaf',
    'labelThreshold.good': 'Goed vanaf',
    'labelThreshold.fair': 'Matig vanaf',

    'direction.none': 'Geen voorkeur',
    'direction.n': 'Noord',
    'direction.ne': 'Noordoost',
    'direction.e': 'Oost',
    'direction.se': 'Zuidoost',
    'direction.s': 'Zuid',
    'direction.sw': 'Zuidwest',
    'direction.w': 'West',
    'direction.nw': 'Noordwest',
    windPrefIntro: 'Wind uit deze richting telt als meewind (gunstig) in de fietsscore.',
    windPrefLabel: 'Windrichting-voorkeur',
    profileIntro: 'Wat weegt het zwaarst mee in de score: regen, temperatuur, zon of wind?',
    profileLabel: 'Score-profiel',
    'profile.balanced': 'Gebalanceerd',
    'profile.temp': 'Gevoelig voor kou/hitte',
    'profile.wind': 'Fiets liever niet in de wind',
    'profile.rain': 'Regen is een dealbreaker',
    'profile.custom': 'Aangepast (via debug-pagina)',
    rideDurationIntro: '"Beste moment" zoekt een venster van deze lengte i.p.v. altijd het kortste (dat scoort anders structureel te makkelijk hoog).',
    rideDurationLabel: 'Gemiddelde rittijd',
    'unit.hour': 'uur',
    includeNightIntro: 'Standaard dimt de score \'s nachts naar 0, ongeacht het weer — handig aan laten als je met verlichting fietst.',
    includeNightLabel: 'Neem ook donkere uren mee',
    comfortIntro: 'Comfortband en drempels waarop de score rekent (MVP-defaults, hier aan te passen).',
    tempMinLabel: 'Prettige temperatuur vanaf',
    tempMaxLabel: 'Prettige temperatuur tot',
    windKneeLabel: 'Windknikpunt (harder = snel minder prettig)',
    currentLocation: 'Huidige locatie:',
    unknown: 'onbekend',
    searchPlaceholder: 'Plaatsnaam zoeken…',
    searching: 'Zoeken…',
    languageLabel: 'Taal',
    languageIntro: 'Taal van de Fiets-site.',
  },
  en: {
    loading: 'Loading forecast…',
    weatherUnavailable: 'Weather data unavailable',
    emptyState: 'No weather data available. Please try again later.',

    'tier.excellent': 'Excellent',
    'tier.good': 'Good',
    'tier.fair': 'Fair',
    'tier.poor': 'Poor',
    bikingWeather: 'biking weather',

    howScoreWorks: 'How does the score work?',
    close: 'Close',
    'weight.rain': 'Rain',
    'weight.temp': 'Temperature',
    'weight.sun': 'Sun',
    'weight.wind': 'Wind',
    'weightNote.rain': 'The more it rains and the heavier the shower, the lower this contributes.',
    'weightNote.temp': 'Most pleasant between 15-22°C, adjustable.',
    'weightNote.sun': 'More sun (less cloud cover) is better.',
    'weightNote.wind': 'Strong wind and headwind count negatively, adjustable.',
    'debugWeightNote.temp': 'Most pleasant between 15-22°C, adjustable in Settings.',
    'debugWeightNote.wind': 'Strong wind and headwind count negatively, adjustable in Settings.',
    weightPct: 'counts for {pct}% of the score.',
    daylightTitle: 'Daylight',
    daylightExplain: 'works independently of the 4 weights above: at night the score dims smoothly to 0, during the day it stays unchanged. Adjustable via "include dark hours" in Settings.',
    sourcesTitle: '3 sources',
    sourcesExplain: 'the score is an average of KNMI, NOAA GFS and DWD ICON.',

    'tab.fiets': 'Cycling',
    'tab.temp': 'Temp',
    'tab.rain': 'Rain',
    'tab.wind': 'Wind',
    'tab.zon': 'Sun',
    'windMode.chart': 'Chart',
    'windMode.arrow': 'Arrow',
    'windMode.both': 'Both',
    withBreakdown: 'With breakdown',
    simple: 'Simple',
    'legend.score': 'Score',
    'legend.light': 'Light',
    'legend.moderate': 'Moderate',
    'legend.heavy': 'Heavy',

    tijdvakTitle: 'Time window',
    dragHint: 'drag the handles on the chart',
    nextBestTooltip: 'Next best window today',
    bestMoment: 'Best moment',
    noGoodMoment: 'No good moment found',
    showThisWindow: 'Show this time window in the chart',
    backToAllDays: 'All days',
    now: 'now',

    'nav.debug': 'Debug data',
    'nav.settings': 'Settings',
    'nav.account': 'Account',

    debugIntro: 'Raw source data per model (KNMI/GFS/ICON separately), the blended result and the score breakdown, per hour. Purely to learn how the score comes about — scroll horizontally to see all columns.',
    notSaved: 'not saved — you\'ll be asked when you leave',
    confirmLeave: 'You\'ve changed the ratios but not saved yet. Save now?',
    loadingShort: 'Loading…',
    daylightDebugExplain: 'works independently of these 4 weights: at night the score dims smoothly to 0 (the \'weather\' column shows the undimmed value). Updates live as you adjust the weights above.',
    'col.time': 'time',
    'col.day': 'day',
    'col.blended': 'Blended',
    'col.deviation': 'diverge.',
    'col.deviationTitle': 'Flags when the active sources clearly disagree (temp/rain-chance spread above the threshold)',
    'col.score': 'Score',
    'sub.cloud': 'cld%',
    'sub.rain': 'rain',
    'sub.temp': 'temp',
    'sub.sun': 'sun',
    'sub.wind': 'wind',
    'sub.weather': 'weather',
    'sub.total': 'total',
    tierColTooltip: 'Rain intensity tier (0-3), derived from the WMO weather_code: 0 = dry/cloudy, 1 = light drizzle, 2 = moderate drizzle/rain, 3 = heavy rain/thunder/ice. Worst-case of the active sources (cautious approach). Determines the rain score together with mm.',
    weatherColTooltip: 'Weather score before daylight dimming (sum of rain+temp+sun+wind). \'total\' = weather × daylight factor from the day column (or undimmed if \'include dark hours\' is on).',
    daylightFactorTooltip: 'Daylight factor (0=night, 1=day, smooth during twilight) — dims the weather score into \'total\'.',
    labelThresholdsTitle: 'Score tiers for "Best moment" (0-10 scale, applies to the main app):',
    'labelThreshold.excellent': 'Excellent from',
    'labelThreshold.good': 'Good from',
    'labelThreshold.fair': 'Fair from',

    'direction.none': 'No preference',
    'direction.n': 'North',
    'direction.ne': 'Northeast',
    'direction.e': 'East',
    'direction.se': 'Southeast',
    'direction.s': 'South',
    'direction.sw': 'Southwest',
    'direction.w': 'West',
    'direction.nw': 'Northwest',
    windPrefIntro: 'Wind from this direction counts as tailwind (favorable) in the cycling score.',
    windPrefLabel: 'Wind direction preference',
    profileIntro: 'What weighs heaviest in the score: rain, temperature, sun or wind?',
    profileLabel: 'Score profile',
    'profile.balanced': 'Balanced',
    'profile.temp': 'Sensitive to cold/heat',
    'profile.wind': 'Prefer not to cycle in the wind',
    'profile.rain': 'Rain is a dealbreaker',
    'profile.custom': 'Custom (via debug page)',
    rideDurationIntro: '"Best moment" looks for a window of this length instead of always the shortest one (which otherwise structurally scores too easily high).',
    rideDurationLabel: 'Average ride duration',
    'unit.hour': 'hour',
    includeNightIntro: 'By default the score dims to 0 at night, regardless of weather — handy to leave on if you cycle with lights.',
    includeNightLabel: 'Include dark hours',
    comfortIntro: 'Comfort band and thresholds the score is based on (MVP defaults, adjustable here).',
    tempMinLabel: 'Comfortable temperature from',
    tempMaxLabel: 'Comfortable temperature up to',
    windKneeLabel: 'Wind knee point (harder = quickly less pleasant)',
    currentLocation: 'Current location:',
    unknown: 'unknown',
    searchPlaceholder: 'Search for a place…',
    searching: 'Searching…',
    languageLabel: 'Language',
    languageIntro: 'Language of the Cycling site.',
  },
}

export function t(lang, key, vars) {
  let str = (DICT[lang] && DICT[lang][key]) ?? DICT.nl[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, v)
  return str
}

export function localeOf(lang) {
  return lang === 'en' ? 'en-US' : 'nl-NL'
}

// Zelfde staffel als de backend-defaults (services/fiets.py LABEL_EXCELLENT/
// GOOD/FAIR) — voor client-side berekende gemiddelden (tijdvak/volgende-beste)
// die niet via best_window() lopen en dus geen score_tier van de API krijgen.
export function scoreTierKey(score) {
  if (score >= 8) return 'excellent'
  if (score >= 6) return 'good'
  if (score >= 4) return 'fair'
  return 'poor'
}

export function scoreTierLabel(lang, score) {
  return t(lang, `tier.${scoreTierKey(score)}`)
}

// Enige plek die fiets_language leest/schrijft — FietsLayout gebruikt dit en
// geeft lang/setLang door aan de 3 pagina's, zodat er maar 1 ui-prefs-fetch
// voor taal nodig is i.p.v. per pagina.
export function useLanguage() {
  const [lang, setLangState] = useState('nl')

  useEffect(() => {
    api.get('/api/auth/me/ui-prefs')
      .then(prefs => { if (prefs.fiets_language === 'en') setLangState('en') })
      .catch(() => {})
  }, [])

  function setLang(next) {
    setLangState(next)
    api.patch('/api/auth/me/ui-prefs', { fiets_language: next }).catch(() => {})
  }

  return [lang, setLang]
}
