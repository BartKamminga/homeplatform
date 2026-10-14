import { useState } from 'react'
import { AcPanel } from '@components/arcade/overlays.jsx'
import { AcTabs, AcVariantSwitch } from '@components/arcade/controls.jsx'
import NameFormatTab from './NameFormatTab.jsx'
import DownloadTab from './DownloadTab.jsx'
import SyncTab from './SyncTab.jsx'
import ProviderTab from './ProviderTab.jsx'

// Instellingen als zijlade in VBT-paneelstijl (item 1338).
const TABS = [
  { value: 'name', label: 'NAME FORMAT' }, { value: 'download', label: 'DOWNLOAD' },
  { value: 'sync', label: 'SYNC' }, { value: 'provider', label: 'PROVIDER' },
]

export default function SettingsDrawer({ onClose, onDone }) {
  const [tab, setTab] = useState('name')
  return (
    <AcPanel drawer title="SETTINGS" sub={TABS.find(t => t.value === tab).label} onClose={onClose} className="bca-drawer"
      tabs={<AcTabs items={TABS} value={tab} onChange={setTab} />}>
      {tab === 'name' && <NameFormatTab />}
      {tab === 'download' && <DownloadTab />}
      {tab === 'sync' && <SyncTab onDone={onDone} onClose={onClose} />}
      {tab === 'provider' && <ProviderTab />}
      <div className="ac-card"><div className="ac-row"><span>INTERFACE<small>Classic is the current design, Arcade the new one.</small></span><AcVariantSwitch site="beatcrades" /></div></div>
    </AcPanel>
  )
}
