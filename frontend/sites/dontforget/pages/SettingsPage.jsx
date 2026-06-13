import { useState } from 'react'
import ThemeSwitcher from '@components/ThemeSwitcher.jsx'
import ChangelogPage from '@components/ChangelogPage.jsx'
import AppGroupSwitcher from '@components/AppGroupSwitcher.jsx'
import { VERSION, CHANGELOG } from '../changelog.jsx'
import { useUiPref } from '@core/useUiPref.js'

const HISTORY_OPTIONS = ['7 dagen', '30 dagen', 'Altijd']
const MOMENT_OPTIONS  = ['Ochtend', 'Middag', 'Heledag']
const REPEAT_OPTIONS  = ['Eenmalig', 'Dagelijks', 'Wekelijks', 'Maandelijks']

function SectionHeader({ label }) {
  return (
    <div style={{ padding: '16px 16px 6px', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
      {label}
    </div>
  )
}

function Card({ children }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', margin: '0 16px 12px', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function Row({ icon, iconBg, iconColor, title, sub, end, onClick, danger }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '0.5px solid var(--border)', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 16, color: iconColor }} aria-hidden="true" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: danger ? 'var(--danger)' : 'var(--text)' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      {end}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
      background: value ? 'var(--accent)' : 'var(--border)',
      transition: 'background 0.2s', flexShrink: 0,
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2, left: value ? 18 : 2,
        transition: 'left 0.2s',
      }} />
    </div>
  )
}

function ChevronEnd({ value }) {
  return (
    <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
      {value} <i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--text-faint)' }} />
    </div>
  )
}

function SelectRow({ icon, iconBg, iconColor, title, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <Row icon={icon} iconBg={iconBg} iconColor={iconColor} title={title}
        end={<ChevronEnd value={value} />} onClick={() => setOpen(!open)} />
      {open && (
        <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {options.map(o => (
            <div key={o} onClick={() => { onChange(o); setOpen(false) }} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              background: value === o ? 'var(--accent-bg)' : 'var(--bg-card)',
              color: value === o ? 'var(--accent-text)' : 'var(--text-muted)',
              border: '0.5px solid var(--border)',
            }}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ChangelogPopup({ onClose }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 99,
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', width: '100%', borderRadius: '16px 16px 0 0',
        maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '0.5px solid var(--border)',
        }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>Over DontForget</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 18, padding: '2px 6px',
          }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 0 16px' }}>
          <ChangelogPage changelog={CHANGELOG} title="" />
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [photoRequired, setPhotoRequired] = useUiPref('df_photo_required', false, v => v === 'true' || v === true)
  const [moment,        setMoment]        = useUiPref('df_moment', 'Ochtend')
  const [repeat,        setRepeat]        = useUiPref('df_repeat', 'Eenmalig')
  const [history,       setHistory]       = useUiPref('df_history', '30 dagen')
  const [showChangelog, setShowChangelog] = useState(false)

  return (
    <div style={{ paddingBottom: 16 }}>
      {showChangelog && <ChangelogPopup onClose={() => setShowChangelog(false)} />}

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '0.5px solid var(--border)', background: 'var(--bg-card)' }}>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 500, color: 'var(--text)' }}>Instellingen</div>
      </div>

      {/* Huishouden */}
      <SectionHeader label="Huishouden" />
      <Card>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
          <AppGroupSwitcher
            app="dontforget"
            labelStyle={{ color: 'var(--text-muted)' }}
            selectStyle={{
              background: 'var(--bg-secondary)', border: '0.5px solid var(--border)',
              color: 'var(--text)', borderRadius: 8, padding: '7px 10px',
            }}
          />
        </div>
        <a href="/account/groups?back=/dontforget/" style={{ textDecoration: 'none', display: 'block' }}>
          <Row icon="ti-user-circle" iconBg="#E6F1FB" iconColor="#185FA5" title="Profiel &amp; groepen"
            sub="Wachtwoord wijzigen en overige instellingen"
            end={<i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--text-faint)' }} />} />
        </a>
      </Card>

      {/* Weergave */}
      <SectionHeader label="Weergave" />
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-moon" style={{ fontSize: 16, color: '#534AB7' }} aria-hidden="true" />
          </div>
          <div style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>Thema</div>
          <ThemeSwitcher compact />
        </div>
        {/* TODO: taalinstelling — i18n is nog niet geïmplementeerd, altijd Nederlands */}
        <Row icon="ti-language" iconBg="#E6F1FB" iconColor="#185FA5" title="Taal"
          end={<ChevronEnd value="Nederlands" />} onClick={() => {}} />
      </Card>

      {/* Taken */}
      <SectionHeader label="Taken" />
      <Card>
        <SelectRow icon="ti-clock" iconBg="#FAEEDA" iconColor="#854F0B" title="Standaard moment"
          options={MOMENT_OPTIONS} value={moment} onChange={setMoment} />
        <SelectRow icon="ti-repeat" iconBg="#EAF3DE" iconColor="#3B6D11" title="Standaard herhaling"
          options={REPEAT_OPTIONS} value={repeat} onChange={setRepeat} />
        <Row icon="ti-camera" iconBg="#FBEAF0" iconColor="#993556" title="Foto verplicht"
          sub="Altijd een foto bij nieuwe taak"
          end={<Toggle value={photoRequired} onChange={setPhotoRequired} />} />
      </Card>

      {/* Data */}
      <SectionHeader label="Data" />
      <Card>
        <SelectRow icon="ti-history" iconBg="#EAF3DE" iconColor="#3B6D11" title="Geschiedenis bewaren"
          options={HISTORY_OPTIONS} value={history} onChange={setHistory} />
        {/* TODO: alles resetten — nog geen DELETE /api/dontforget/tasks/all endpoint; bevestigingsdialoog + API-call nog te implementeren */}
        <Row icon="ti-trash" iconBg="#FCEBEB" iconColor="#A32D2D" title="Alles resetten"
          sub="Verwijder alle taken en geschiedenis" danger onClick={() => {}} />
      </Card>

      {/* Over */}
      <SectionHeader label="Over" />
      <Card>
        <Row icon="ti-history" iconBg="#EEEDFE" iconColor="#534AB7" title="Changelog"
          sub={`Versie ${VERSION}`}
          end={<ChevronEnd value="" />} onClick={() => setShowChangelog(true)} />
      </Card>

    </div>
  )
}
