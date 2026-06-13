import { useState, useRef } from 'react'
import { api } from '@core/api.js'
import { uploadPhoto, uploadAudio } from '../api.js'

// Read UI-prefs that were stored by useUiPref (localStorage mirror of backend)
function getPref(key, fallback) {
  const v = localStorage.getItem(key)
  return v !== null ? v : fallback
}

export const REPEAT   = ['Eenmalig', 'Dagelijks', 'Wekelijks', 'Maandelijks']
export const HORIZONS = ['Vandaag', 'Morgen', 'Deze week', 'Deze maand']
export const TIMES    = ['Ochtend', 'Middag', 'Heledag']
export const PRIO     = ['Hoog', 'Normaal', 'Laag']
export const DAYS     = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

const REPEAT_MAP  = { 'Eenmalig': 'once', 'Dagelijks': 'daily', 'Wekelijks': 'weekly', 'Maandelijks': 'monthly' }
const PRIO_MAP    = { 'Hoog': 'high', 'Normaal': 'normal', 'Laag': 'low' }
const HORIZON_MAP = { 'Vandaag': null, 'Morgen': 'tomorrow', 'Deze week': 'week', 'Deze maand': 'month' }
const TIME_MAP    = { 'Ochtend': 'morning', 'Middag': 'afternoon', 'Heledag': 'allday' }

const REPEAT_REV = Object.fromEntries(Object.entries(REPEAT_MAP).map(([k, v]) => [v, k]))
const PRIO_REV   = Object.fromEntries(Object.entries(PRIO_MAP).map(([k, v]) => [v, k]))

function whenToHorizon(w) {
  return { tomorrow: 'Morgen', week: 'Deze week', month: 'Deze maand' }[w] ?? 'Vandaag'
}
function whenToTime(w) {
  return { morning: 'Ochtend', afternoon: 'Middag' }[w] ?? 'Heledag'
}

export function useTaskForm(task, { onSaved, onClose }) {
  const editing = !!task

  // For new tasks, fall back to user's default prefs (saved by SettingsPage via useUiPref)
  const defaultRepeat  = getPref('df_repeat', 'Eenmalig')
  const defaultMoment  = getPref('df_moment', 'Ochtend')
  const photoRequired  = getPref('df_photo_required', 'false') === 'true'

  const [repeat,        setRepeat]        = useState(task ? (REPEAT_REV[task.repeat] ?? 'Eenmalig') : defaultRepeat)
  const [horizon,       setHorizon]       = useState(task ? whenToHorizon(task.when) : 'Vandaag')
  const [timeOfDay,     setTimeOfDay]     = useState(task ? whenToTime(task.when) : defaultMoment)
  const [dayOfWeek,     setDayOfWeek]     = useState(task?.day_of_week ?? null)
  const [prio,          setPrio]          = useState(task ? (PRIO_REV[task.priority] ?? 'Normaal') : 'Normaal')
  const [title,         setTitle]         = useState(task?.title ?? '')
  const [photoFile,     setPhotoFile]     = useState(null)
  const [photoPreview,  setPhotoPreview]  = useState(task?.photo_path ? `/api/uploads/${task.photo_path}` : null)
  const [audioBlob,     setAudioBlob]     = useState(null)
  const [audioPreview,  setAudioPreview]  = useState(task?.audio_path ? `/api/uploads/${task.audio_path}` : null)
  const [audioCleared,  setAudioCleared]  = useState(false)
  const [recording,     setRecording]     = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState(null)

  const fileRef     = useRef()
  const recorderRef = useRef(null)
  const chunksRef   = useRef([])
  const timerRef    = useRef(null)

  function getWhen() {
    if (repeat !== 'Eenmalig') return 'allday'
    if (horizon !== 'Vandaag') return HORIZON_MAP[horizon]
    return TIME_MAP[timeOfDay]
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' })
        setAudioBlob(blob)
        setAudioPreview(URL.createObjectURL(blob))
        setAudioCleared(false)
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRecorder.start()
      recorderRef.current = mediaRecorder
      setRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch {
      setError('Microfoon toegang geweigerd')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    clearInterval(timerRef.current)
    setRecording(false)
  }

  function clearAudio() {
    if (recording) stopRecording()
    setAudioBlob(null)
    setAudioPreview(null)
    setAudioCleared(true)
  }

  async function handleSave() {
    if (!title.trim()) { setError('Vul een titel in'); return }
    if (!editing && photoRequired && !photoFile) { setError('Een foto is verplicht bij deze taak'); return }
    if (recording) stopRecording()
    setSaving(true); setError(null)
    try {
      let photo_path = task?.photo_path ?? null
      if (photoFile) {
        const result = await uploadPhoto(photoFile)
        photo_path = result.path
      }
      let audio_path = audioCleared ? null : (task?.audio_path ?? null)
      if (audioBlob) {
        const result = await uploadAudio(audioBlob)
        audio_path = result.path
      }
      const data = {
        title:       title.trim(),
        photo_path,
        audio_path,
        when:        getWhen(),
        repeat:      REPEAT_MAP[repeat],
        priority:    PRIO_MAP[prio],
        day_of_week: repeat === 'Wekelijks' ? dayOfWeek : null,
      }
      if (editing) {
        await api.patch(`/api/dontforget/tasks/${task.id}`, data)
      } else {
        await api.post('/api/dontforget/tasks', data)
      }
      onSaved?.(); onClose()
    } catch (e) {
      setError(e.message || 'Er ging iets mis')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await api.delete(`/api/dontforget/tasks/${task.id}`)
      onSaved?.(); onClose()
    } catch (e) {
      setError(e.message || 'Verwijderen mislukt')
    } finally {
      setSaving(false)
    }
  }

  return {
    editing,
    repeat, setRepeat,
    horizon, setHorizon,
    timeOfDay, setTimeOfDay,
    dayOfWeek, setDayOfWeek,
    prio, setPrio,
    title, setTitle,
    photoPreview, fileRef,
    photoRequired,
    audioPreview, recording, recordingTime,
    saving, error,
    handlePhotoChange, handleSave, handleDelete,
    startRecording, stopRecording, clearAudio,
  }
}
