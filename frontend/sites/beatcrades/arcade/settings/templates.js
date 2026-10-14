// Voorbeelddata en template-functies voor de Name format-tab (item 1338), gelijk aan classic SettingsPanel.
export const DEFAULTS = { filename_template: '{title} - {artist}', dir_template: '{section}/{rack}/{crade}' }

const base = { genre: 'House', section: 'Mijn Sets', rack: 'House', crade: 'Summer 2025 Chart' }
export const SAMPLES = [
  { ...base, title: 'Piece of Your Heart', artist: 'Meduza', artists: 'Meduza feat. Goodboys', release: 'Piece of Your Heart', year: '2019', track_number: '01', bpm: '124', key: 'Gm', label: 'Virgin EMI' },
  { ...base, title: 'Break My Soul', artist: 'Beyonce', artists: 'Beyonce', release: 'Renaissance', year: '2022', track_number: '02', bpm: '126', key: 'Fm', label: 'Parkwood' },
  { ...base, title: 'Insomnia', artist: 'Faithless', artists: 'Faithless', release: 'Reverence', year: '1995', track_number: '03', bpm: '133', key: 'Em', label: 'Cheeky Records' },
  { title: 'Blue Monday', artist: 'New Order', artists: 'New Order', release: 'Power Corruption and Lies', genre: 'Synth-pop', year: '1983', track_number: '01', bpm: '136', key: 'Dm', label: 'Factory Records', section: 'Klassiekers', rack: 'Synth-pop', crade: 'New Order Best Of' },
  { title: 'Around The World', artist: 'Daft Punk', artists: 'Daft Punk', release: 'Homework', genre: 'Electronic', year: '1997', track_number: '04', bpm: '121', key: 'Am', label: 'Virgin Records', section: 'Klassiekers', rack: 'Electronic', crade: 'Daft Punk Essentials' },
]
export const CRADE_TRACKS = {
  0: [SAMPLES[0], SAMPLES[1], SAMPLES[2], { ...base, title: 'Promises', artist: 'Calvin Harris', artists: 'Calvin Harris feat. Sam Smith', release: 'Funk Wav Vol. 2', year: '2022', track_number: '04', bpm: '121', key: 'Bb', label: 'Columbia' }],
  1: [SAMPLES[0], SAMPLES[1], SAMPLES[2]],
  2: [SAMPLES[0], SAMPLES[1], SAMPLES[2]],
  3: [SAMPLES[3], { ...SAMPLES[3], title: 'True Faith', track_number: '02', year: '1987' }],
  4: [SAMPLES[4], { ...SAMPLES[4], title: 'Harder Better Faster Stronger', track_number: '02', year: '2001' }],
}
export const TRACK_TOKENS = ['title', 'artist', 'artists', 'release', 'genre', 'year', 'track_number', 'bpm', 'key', 'label']
export const DIR_TOKENS = ['section', 'rack', 'crade']
export const DIR_TRACK_TOKENS = ['genre', 'artist', 'year', 'label']

const applyTpl = (tpl, data) => tpl.replace(/\{(\w+)\}/g, (_, k) => (data[k] !== undefined ? data[k] : `{${k}}`))
const safeSeg = s => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
export const renderDir = (tpl, data) => tpl.split('/').map(seg => safeSeg(applyTpl(seg, data))).filter(Boolean)
export const renderFile = (tpl, data) => safeSeg(applyTpl(tpl, data))
export const hasUnresolved = s => /\{\w+\}/.test(s)
