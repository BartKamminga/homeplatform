// HELP: de helpteksten (statische, eigen HTML) met COPY-knoppen voor de browser-instelling.
import { useEffect, useRef } from 'react'
import { SECTIONS } from './helpContent.js'
import { copyText } from '../../common/clipboard.js'

export default function HelpSection({ focus }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!focus || !ref.current) return
    ref.current.querySelector('#help-' + focus)?.scrollIntoView({ block: 'start' })
  }, [focus])

  const onClick = e => {
    const text = e.target.dataset?.copy
    if (text) copyText(text)
  }

  return (
    <div className="pn-section pn-help" ref={ref} onClick={onClick}>
      <nav className="pn-chips">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => ref.current.querySelector('#help-' + s.id)?.scrollIntoView({ block: 'start' })}>
            {s.title.toUpperCase()}
          </button>
        ))}
      </nav>
      {SECTIONS.map(s => (
        <section key={s.id} id={'help-' + s.id}>
          <h4>{s.title.toUpperCase()}</h4>
          <div dangerouslySetInnerHTML={{ __html: s.html }} />
        </section>
      ))}
    </div>
  )
}
