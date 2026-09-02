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

// Fase 2 (item 1050): MindBox.Run(...) bestaat nog niet als echt commando -
// dit bereidt alvast de exacte, kopieerbare aanroep voor zodat de workflow
// straks (zonder UI-wijziging) meteen bruikbaar is.
//
// Item 1051 (Bart): "de commando's moeten wel omgeving bewust zijn" - prod/
// acc/local hebben elk hun EIGEN database, dus een item-/case-ID uit acc
// bestaat niet op prod. Bart's gekozen notatie: "{Env}.MindBox.Run(all)",
// "{Env}.MindBox.Run.File(#item_id)", "{Env}.MindBox.Run.Case(#case_id)" -
// de {Env}-prefix vertaalt 1-op-1 naar MindBox.ps1's -Env-parameter.
export function mindboxRunAllCommand(env) {
  return `${env}.MindBox.Run(all)`
}
export function mindboxRunFileCommand(itemId, env) {
  return `${env}.MindBox.Run.File(#${itemId})`
}
export function mindboxRunCaseCommand(caseId, env) {
  return `${env}.MindBox.Run.Case(#${caseId})`
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
