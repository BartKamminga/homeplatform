// navigator.clipboard bestaat alleen in secure contexts (HTTPS/localhost) -
// acc draait over plain HTTP op een LAN-IP, dus navigator.clipboard is daar
// undefined. Fallback op de oudere execCommand('copy')-route via een
// tijdelijke textarea (zelfde patroon als admin/pages/Roadmap.jsx).
export function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
  }
  return new Promise((resolve, reject) => {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    try {
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      ok ? resolve() : reject(new Error("execCommand('copy') gaf false terug"))
    } catch (e) {
      document.body.removeChild(el)
      reject(e)
    }
  })
}

// Fase 2 (item 1050/1051): MindBox.Run(...) e.d. bestaan nog niet als echte
// commando's - dit bereidt alvast de exacte, kopieerbare aanroep voor zodat
// de workflow straks (zonder UI-wijziging) meteen bruikbaar is.
//
// VASTE NOTATIE (Bart, item 1051, definitief na een paar rondes heen-en-weer):
//   env.MindBox.Entity.Cmd(#id, optional params)
// - env: Prod/Acc/Local - {Env}-prefix vertaalt 1-op-1 naar MindBox.ps1's
//   -Env-parameter. Verplicht, want prod/acc/local hebben elk hun EIGEN
//   database - een item-/case-ID uit acc bestaat niet op prod.
// - Entity.Cmd: Object.Actie-volgorde, bv. Case.Run, File.Enhance - NIET
//   Run.Case of Enhance.File (die kant op geweest, expliciet gecorrigeerd).
// - Uitzondering: een commando zonder specifieke entity (werkt globaal over
//   alles) laat het Entity-segment weg, bv. MindBox.Run(all).
// Nieuwe MindBox-commando's MOETEN dit patroon volgen.
export function mindboxRunAllCommand(env) {
  return `${env}.MindBox.Run(all)`
}
export function mindboxCaseRunCommand(caseId, env) {
  return `${env}.MindBox.Case.Run(#${caseId})`
}

// "env.MindBox.File.Enhance(#id) --> om extra info toe te voegen aan het
// infoveld van een bestand" - lichtgewicht per-bestand-actie (vervangt het
// vervallen Run.File): geen volledige verwerking, alleen het bestand laten
// bekijken en het notities-veld laten aanvullen (via MindBox.ps1 -Note).
export function mindboxFileEnhanceCommand(itemId, env) {
  return `${env}.MindBox.File.Enhance(#${itemId})`
}

// "env.MindBox.File.ParseToTekst(#item)" (Bart, item 1051) - de platte
// tekstinhoud van het bestand zelf laten extraheren (bv. de mail-body van
// een .msg) en opslaan in parsed_text, zichtbaar 'onder' het bestand in de
// UI. Losstaand van Enhance (dat vult notes, Barts EIGEN aantekening).
export function mindboxFileParseToTekstCommand(itemId, env) {
  return `${env}.MindBox.File.ParseToTekst(#${itemId})`
}

// "env.MindBox.File.ExtractAttachments(#item)" (Bart, item 1051: "hoe gaan
// we om met attachments in een mail?") - bijlagen van een mail (bv. een
// .msg) apart als eigen MindboxItems opslaan, gekoppeld via parent_item_id
// en automatisch in dezelfde case als de mail zelf.
export function mindboxFileExtractAttachmentsCommand(itemId, env) {
  return `${env}.MindBox.File.ExtractAttachments(#${itemId})`
}

const ENV_LABELS = { production: 'Prod', acceptatie: 'Acc', development: 'Local' }

// Zelfde bron als EnvBanner (frontend/core/EnvBanner.jsx): /api/config geeft
// settings.ENVIRONMENT terug ("production"/"acceptatie"/"development").
export async function fetchMindboxEnv() {
  try {
    const res = await fetch('/api/config')
    const data = await res.json()
    return ENV_LABELS[data.environment] || 'Local'
  } catch {
    return 'Local'
  }
}
