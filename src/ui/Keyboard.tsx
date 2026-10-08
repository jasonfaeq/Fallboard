import { PIANO_HIGH, PIANO_LOW, isBlackKey, noteName } from '../engine/input'

const WHITE_W = 10
const HEIGHT = 56
const BLACK_W = 6
const BLACK_H = 35

interface Key { note: number; x: number; black: boolean }

export const KEYS: Key[] = []
let whites = 0
for (let note = PIANO_LOW; note <= PIANO_HIGH; note++) {
  const black = isBlackKey(note)
  KEYS.push({ note, black, x: black ? whites * WHITE_W - BLACK_W / 2 : whites * WHITE_W })
  if (!black) whites++
}
export const KEYBOARD_WIDTH = whites * WHITE_W

/** The 88-key keyboard. `held` lights the keys that are down. */
export default function Keyboard({ held, sounding = new Map() }: { held: ReadonlyMap<number, unknown>; sounding?: ReadonlyMap<number, 'L' | 'R'> }) {
  const key = (k: Key) => (
    <rect
      key={k.note}
      className={`key ${k.black ? 'black' : 'white'}${sounding.has(k.note) ? ` guide-${sounding.get(k.note)}` : ''}${held.has(k.note) ? ' held' : ''}`}
      data-note={k.note}
      x={k.x + 0.5}
      width={(k.black ? BLACK_W : WHITE_W) - 1}
      height={k.black ? BLACK_H : HEIGHT}
      rx={1}
    >
      <title>{noteName(k.note)}</title>
    </rect>
  )
  return (
    <svg className="keyboard" viewBox={`0 0 ${KEYBOARD_WIDTH} ${HEIGHT}`} role="img" aria-label="Piano keyboard">
      {KEYS.filter((k) => !k.black).map(key)}
      {KEYS.filter((k) => k.black).map(key)}
    </svg>
  )
}
