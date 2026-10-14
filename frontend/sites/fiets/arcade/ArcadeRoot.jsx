import ArcadeShell from '@components/arcade/ArcadeShell.jsx'
import ArcadeApp from './ArcadeApp.jsx'
import './fiets-arcade.css'

// Lazy entry van de arcade-variant (item 1337), geladen via VariantRoot in main.jsx.
export default function ArcadeRoot() {
  return (
    <ArcadeShell>
      <ArcadeApp />
    </ArcadeShell>
  )
}
