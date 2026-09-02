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
export function mindboxRunCommand(target) {
  return `MindBox.Run(${target})`
}
