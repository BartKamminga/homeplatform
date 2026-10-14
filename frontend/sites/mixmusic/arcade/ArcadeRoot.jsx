import ArcadeShell from '@components/arcade/ArcadeShell.jsx'
import ArcadeApp from './ArcadeApp.jsx'
import './mixmusic-arcade.css'

// Lazy entry van de arcade-variant (item 1339), geladen via VariantRoot in main.jsx.
export default function ArcadeRoot() {
  return (
    <ArcadeShell>
      <ArcadeApp />
    </ArcadeShell>
  )
}
