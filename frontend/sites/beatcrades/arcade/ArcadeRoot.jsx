import ArcadeShell from '@components/arcade/ArcadeShell.jsx'
import ArcadeApp from './ArcadeApp.jsx'
import './beatcrades-arcade.css'
import './beatcrades-settings.css'

// Lazy entry van de arcade-variant (item 1338), geladen via VariantRoot in main.jsx.
export default function ArcadeRoot() {
  return (
    <ArcadeShell>
      <ArcadeApp />
    </ArcadeShell>
  )
}
