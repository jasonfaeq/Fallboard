// Settings remembered in this browser: the reader's layout, and per score its speed, transposition
// and muted staves. Storage can be unavailable (private windows); everything still works without it.

export type View = 'sheet' | 'keys' | 'both'
export interface Prefs {
  view: View
  rows: number
  theme: 'paper' | 'night'
  noteNames: boolean
  metronome: boolean
  countIn: boolean
  volume: number
  lastScore: string
}
export interface ScorePrefs { speed: number; transpose: number; muted: number[] }

export const ROW_CHOICES = [1, 2, 3, 4] as const
const DEFAULTS: Prefs = { view: 'both', rows: 2, theme: 'paper', noteNames: false, metronome: false, countIn: true, volume: 0.8, lastScore: '' }
const SCORE_DEFAULTS: ScorePrefs = { speed: 1, transpose: 0, muted: [] }

function read<T extends object>(key: string, defaults: T): T {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
    return saved && typeof saved === 'object' ? { ...defaults, ...saved } : { ...defaults }
  } catch { return { ...defaults } }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* not stored this time */ }
}

export const loadPrefs = () => read('piano-trainer:prefs', DEFAULTS)
export const savePrefs = (prefs: Prefs) => write('piano-trainer:prefs', prefs)
export const loadScorePrefs = (id: string) => read(`piano-trainer:score:${id}`, SCORE_DEFAULTS)
export const saveScorePrefs = (id: string, prefs: ScorePrefs) => write(`piano-trainer:score:${id}`, prefs)
