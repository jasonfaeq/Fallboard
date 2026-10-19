import { isBlackKey, noteName, pitchClass } from '../engine/notes'

export interface Key { note: number; x: number; width: number; black: boolean }

/** Keys from `low` to `high` across a width of 1; black keys sit on the line between two whites. */
export function keyLayout(low: number, high: number): Key[] {
  let whites = 0
  for (let n = low; n <= high; n++) if (!isBlackKey(n)) whites++
  const white = 1 / whites
  const keys: Key[] = []
  let i = 0
  for (let note = low; note <= high; note++) {
    const black = isBlackKey(note)
    keys.push(black ? { note, black, x: i * white - white * 0.31, width: white * 0.62 } : { note, black, x: i * white, width: white })
    if (!black) i++
  }
  return keys
}

/** A C-to-B range that holds every note, at least three octaves wide, inside the 88 keys. */
export function keyRange(low: number, high: number): [number, number] {
  let from = Math.floor(low / 12) * 12
  let to = Math.ceil((high + 1) / 12) * 12 - 1
  for (let below = true; to - from + 1 < 36; below = !below) {
    if (below && from >= 24) from -= 12
    else if (to <= 107) to += 12
    else if (from >= 24) from -= 12
    else break
  }
  return [Math.max(21, from), Math.min(108, to)]
}

interface Props {
  keys: Key[]
  /** drawn size in px, so labels are not stretched */
  width: number
  height: number
  /** note → staff index of the score note sounding on it */
  lit: ReadonlyMap<number, number>
  names: boolean
  onPress: (note: number) => void
  onRelease: (note: number) => void
}

/** The on-screen piano. Lit keys show which hand plays them; click a key to hear it. */
export default function Keyboard({ keys, width, height, lit, names, onPress, onRelease }: Props) {
  const blackHeight = height * 0.62
  const front = Math.max(3, Math.min(7, height * .07))
  const font = Math.max(8, Math.min(13, (keys.find((k) => !k.black)?.width ?? 0) * width * 0.42))
  const key = (k: Key) => {
    const staff = lit.get(k.note)
    const label = names || (!k.black && k.note % 12 === 0)
    const x = k.x * width + .5, w = k.width * width - 1
    const bottom = (k.black ? blackHeight : height - 5)
    const state = staff === undefined ? '' : staff < 0 ? ' pressed' : ` lit-${Math.min(staff, 2)}`
    return <g key={k.note} className={`key-assembly ${k.black ? 'black' : 'white'}${staff === undefined ? '' : ' down'}`}>
      <rect className={`key-front${state}`} x={x} y={bottom - front} width={w} height={front} rx={2} />
      <rect
        className={`key ${k.black ? 'black' : 'white'}${state}`}
        data-note={k.note}
        // Drawn from above the top edge, so only the front corners are rounded.
        x={x} y={-6} width={w} height={bottom - front + 6} rx={k.black ? 2.5 : 4}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onPress(k.note) }}
        onPointerUp={() => onRelease(k.note)}
        onPointerCancel={() => onRelease(k.note)}
      ><title>{noteName(k.note)}</title></rect>
      {!k.black && <rect className="key-ivory-edge" x={x + 1} y={0} width={Math.max(.5, Math.min(2, w * .07))} height={bottom - front - 2} fill="url(#kb-edge)" />}
      {k.black && <rect className="key-polish" x={x + w * .12} y={9} width={w * .76} height={Math.max(1, height * .012)} rx={1} />}
      {label && !k.black && <text className="key-name" x={(k.x + k.width / 2) * width} y={bottom - front - 5} fontSize={font}>
        {k.note % 12 === 0 ? noteName(k.note) : pitchClass(k.note)}</text>}
      {label && k.black && names && <text className="key-name black" x={(k.x + k.width / 2) * width} y={blackHeight - 6} fontSize={font * 0.8}>{pitchClass(k.note)}</text>}
    </g>
  }
  return <svg className="keyboard" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Piano keyboard">
    <defs>
      <linearGradient id="kb-white" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--kb-ivory-top, #c8c5b6)" /><stop offset="0.24" stopColor="var(--kb-ivory-mid, #f0eddf)" /><stop offset="0.82" stopColor="var(--kb-ivory-light, #fffcef)" /><stop offset="1" stopColor="var(--kb-ivory-bottom, #e9e4d0)" />
      </linearGradient>
      <linearGradient id="kb-black" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--kb-ebony-top, #090e0d)" /><stop offset="0.7" stopColor="var(--kb-ebony-mid, #303b35)" /><stop offset="0.86" stopColor="var(--kb-ebony-light, #364039)" /><stop offset="1" stopColor="var(--kb-ebony-bottom, #111b15)" />
      </linearGradient>
      <linearGradient id="kb-shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.45" /><stop offset="1" stopColor="#000" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="kb-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--kb-wood-top, #433329)" /><stop offset=".3" stopColor="var(--kb-wood-mid, #6c5038)" /><stop offset="1" stopColor="var(--kb-wood-bottom, #271e19)" /></linearGradient>
      <linearGradient id="kb-edge" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffffff" stopOpacity=".38" /><stop offset="1" stopColor="#ffffff" stopOpacity=".08" /></linearGradient>
    </defs>
    <rect className="kb-case" x={0} y={height - 12} width={width} height={12} fill="url(#kb-wood)" />
    {keys.filter((k) => !k.black).map(key)}
    {keys.filter((k) => k.black).map(key)}
    {/* the felt strip and the shadow the fallboard casts on the keys */}
    <rect className="kb-shade" x={0} y={0} width={width} height={Math.min(14, height * 0.12)} fill="url(#kb-shade)" />
    <rect className="kb-felt" x={0} y={0} width={width} height={3} />
  </svg>
}
