import type { Score } from '../engine/score'
import { noteName } from '../engine/input'
import { KEYS, KEYBOARD_WIDTH } from './Keyboard'

export default function Highway({ score, beat, start, end }: { score: Score; beat: number; start: number; end: number }) {
  const height = 180
  const perBeat = 25
  return <svg className="highway" viewBox={`0 0 ${KEYBOARD_WIDTH} ${height}`} preserveAspectRatio="none" role="img" aria-label="Falling notes">
    {KEYS.filter((k) => !k.black).map((k) => <line key={k.note} x1={k.x} x2={k.x} y1={0} y2={height} className="key-lane" />)}
    {score.soundNotes.filter((n) => n.start < end && n.start + n.beats > start && n.start - beat < height / perBeat && n.start + n.beats > beat).map((n) => {
      const key = KEYS.find((k) => k.note === n.pitch.midi)!
      const h = Math.max(4, n.beats * perBeat)
      return <g key={n.id} className={`falling-${n.hand}`}>
        <rect x={key.x + 1} y={height - (n.start - beat) * perBeat - h} width={key.black ? 4 : 8} height={h} rx={1} />
        <title>{noteName(n.pitch.midi)}</title>
      </g>
    })}
    <line x1={0} x2={KEYBOARD_WIDTH} y1={height - 1} y2={height - 1} className="strike-line" />
  </svg>
}
