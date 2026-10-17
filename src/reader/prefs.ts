// Settings remembered in this browser: the reader's layout, and per score its speed, transposition
// and each staff's volume. Storage can be unavailable (private windows); everything still works without it.
import type { Room } from '../engine/audio'

export type View = 'sheet' | 'keys' | 'both'
export interface Prefs {
  view: View
  rows: number
  theme: 'paper' | 'night'
  noteNames: boolean
  metronome: boolean
  countIn: boolean
  volume: number
  /** the room the piano plays in (reverb) */
  room: Room
  /** each time a loop comes round, play it 5 % faster, up to 100 % */
  speedUp: boolean
  /** the keys' share of the stage in the Both view */
  split: number
  lastScore: string
}
/** `volumes`: staff index → 0–1 (0 = muted); a staff not listed plays at full volume */
export interface ScorePrefs { speed: number; transpose: number; volumes: Record<number, number> }

export const ROW_CHOICES = [1, 2, 3, 4] as const
const DEFAULTS: Prefs = { view: 'both', rows: 2, theme: 'paper', noteNames: false, metronome: false, countIn: true, volume: 0.8, room: 'off', speedUp: false, split: 0.42, lastScore: '' }
const SCORE_DEFAULTS: ScorePrefs = { speed: 1, transpose: 0, volumes: {} }

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
export function loadScorePrefs(id: string): ScorePrefs {
  const saved: ScorePrefs & { muted?: unknown } = read(`piano-trainer:score:${id}`, SCORE_DEFAULTS)
  // Before hand volumes (D-30) the muted staves were kept as a list.
  if (Array.isArray(saved.muted)) saved.volumes = { ...Object.fromEntries(saved.muted.map((staff: number) => [staff, 0])), ...saved.volumes }
  delete saved.muted
  return saved
}
export const saveScorePrefs = (id: string, prefs: ScorePrefs) => write(`piano-trainer:score:${id}`, prefs)
