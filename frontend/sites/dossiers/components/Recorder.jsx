import { useEffect, useRef, useState } from 'react'
import { uploadRecording } from '../api.js'

// Gesprek opnemen in de browser (MediaRecorder) of een audiobestand kiezen; de server laat het
// uitschrijven door Whisper op G4. De microfoon werkt alleen via https (productie), niet op http (acc).
export default function Recorder({ dossier, onAdded }) {
  const [consent, setConsent] = useState(false)
  const [title, setTitle] = useState('')
  const [state, setState] = useState('idle') // idle | recording | uploading
  const [seconds, setSeconds] = useState(0)
  const [status, setStatus] = useState('')
  const recorder = useRef(null)
  const chunks = useRef([])
  const timer = useRef(null)
  const fileInput = useRef(null)
  const micAvailable = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

  useEffect(() => () => { clearInterval(timer.current); recorder.current?.stream.getTracks().forEach((t) => t.stop()) }, [])

  async function send(blob, filename) {
    setState('uploading')
    setStatus('Saving the recording…')
    try {
      await uploadRecording(dossier.id, blob, filename, title, consent)
      setStatus('Saved. The transcript appears in the list below when it is ready (a few minutes per quarter of an hour).')
      setTitle('')
      onAdded()
    } catch (e) { setStatus(e.message) } finally { setState('idle'); setSeconds(0) }
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
      chunks.current = []
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
        send(blob, rec.mimeType?.includes('ogg') ? 'recording.ogg' : 'recording.webm')
      }
      rec.start(10000) // elke 10 s een stuk, zodat een lange opname niet in één keer in het geheugen hoeft
      recorder.current = rec
      setState('recording')
      setStatus('')
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setStatus('No access to the microphone. Allow it in the browser, or choose an audio file.')
    }
  }

  function stop() {
    clearInterval(timer.current)
    recorder.current?.stop()
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div className="ds-form">
      <input id="rec-title" className="ds-input" placeholder="Title, for example: Meeting with the commissioning parties"
        value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" disabled={state !== 'idle'} />
      <label className="ds-check" htmlFor="rec-consent">
        <input id="rec-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={state !== 'idle'} />
        Everyone in this conversation knows it is being recorded and agrees.
      </label>
      {micAvailable ? (
        <div className="ds-rec">
          {state === 'recording' ? (
            <>
              <span className="ds-rec-dot" aria-hidden="true" />
              <span className="ds-rec-time" aria-live="polite">{mm}:{ss}</span>
              <button type="button" className="ds-btn ds-btn-primary" onClick={stop}>Stop and transcribe</button>
            </>
          ) : (
            <button type="button" className="ds-btn ds-btn-primary" onClick={start} disabled={!consent || state !== 'idle'}>Start recording</button>
          )}
        </div>
      ) : (
        <p className="ds-muted ds-small">The microphone only works over https (the production site). Here you can choose an audio file instead.</p>
      )}
      <div className="ds-inline">
        <button type="button" className="ds-btn" onClick={() => fileInput.current?.click()} disabled={!consent || state !== 'idle'}>Choose audio file</button>
        <span className="ds-muted ds-small">.m4a, .mp3, .wav, .webm, .ogg</span>
        <input ref={fileInput} id="rec-file" type="file" accept=".m4a,.mp3,.wav,.webm,.ogg,.mp4,audio/*" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f, f.name); e.target.value = '' }} />
      </div>
      {status && <p className="ds-status" aria-live="polite">{status}</p>}
    </div>
  )
}
