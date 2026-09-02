// Item 1053: de vaste notatie env.MindBox.Entity.Cmd(#id) leeft nu als data
// in de backend (mindbox_commands, zie CommandsPage.jsx) i.p.v. hardcoded
// per-commando functies hier - dit is de enige overgebleven, generieke
// bouwer: notation_template komt uit de catalogus, {env}/{param} worden
// hier ingevuld voor weergave/kopiëren.
export function buildCommandString(command, param, env) {
  return command.notation_template
    .replace('{env}', env)
    .replace('{param}', param ?? '')
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
