import { useRef } from 'react'
import { ROOMS, type Room } from '../engine/audio'
import type { Prefs } from '../reader/prefs'
import type { StaffInfo } from '../reader/timeline'
import { useClickAway } from './clickAway'

interface Props {
  prefs: Prefs
  transpose: number
  speed: number
  onPrefs: (patch: Partial<Prefs>) => void
  onTranspose: (transpose: number) => void
  onSpeed: (speed: number) => void
  onVolume: (volume: number) => void
  onRoom: (room: Room) => void
  metronomeOnly: boolean
  onMetronomeOnly: (on: boolean) => void
  /** the staves with their own volume (none for a one-staff score) */
  staves: StaffInfo[]
  handVolume: (staff: number) => number
  onHandVolume: (staff: number, volume: number) => void
  onClose: () => void
}

const SPEEDS = [0.5, 0.75, 1]
const STEPS = [0.02, 0.05, 0.1]
const COUNT_MAX = { bars: 4, beats: 8 }
const percent = (from: number, to: number) => Array.from({ length: Math.round((to - from) / 5) + 1 }, (_, i) => (from + i * 5) / 100)
const STARTS = percent(25, 150)
const TARGETS = percent(50, 200)

/** The settings that are changed now and then: pitch, labels, sheet colours, practice helpers, volume. */
export default function Settings({ prefs, transpose, speed, onPrefs, onTranspose, onSpeed, onVolume, onRoom, metronomeOnly, onMetronomeOnly, staves, handVolume, onHandVolume, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  useClickAway(panel, 'data-settings-toggle', onClose)

  const slider = (label: string, name: string, value: number, change: (value: number) => void, className = '') =>
    <label className={`setting volume ${className}`} key={label}>
      <span>{label}</span>
      <input type="range" min={0} max={100} value={Math.round(value * 100)} aria-label={name}
        style={{ '--fill': `${value * 100}%` } as React.CSSProperties}
        onChange={(e) => change(Number(e.target.value) / 100)} />
      <output>{Math.round(value * 100)}%</output>
    </label>

  const toggle = (label: string, on: boolean, change: () => void, hint?: string) =>
    <div className="setting">
      <div><span>{label}</span>{hint && <small>{hint}</small>}</div>
      <button className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={change}><i /></button>
    </div>

  return <div className="settings" ref={panel} role="dialog" aria-label="Settings">
    <h3>Practice</h3>
    <div className="setting">
      <div><span>Speed</span></div>
      <div className="segmented small" role="group" aria-label="Speed presets">
        {SPEEDS.map((s) => <button key={s} className={Math.abs(speed - s) < 0.001 ? 'on' : ''} onClick={() => onSpeed(s)}>{s * 100}%</button>)}
      </div>
    </div>
    {toggle('Speed up loops', prefs.speedUp, () => onPrefs({ speedUp: !prefs.speedUp }),
      `${Math.round(prefs.speedUpStep * 100)} % faster each time a loop comes round, up to ${Math.round(prefs.speedUpTo * 100)} %`)}
    {prefs.speedUp && <div className="sub-settings">
      <div className="setting">
        <div><span>Step</span></div>
        <div className="segmented small" role="group" aria-label="Speed-up step">
          {STEPS.map((s) => <button key={s} className={Math.abs(prefs.speedUpStep - s) < 1e-6 ? 'on' : ''} aria-pressed={Math.abs(prefs.speedUpStep - s) < 1e-6}
            onClick={() => onPrefs({ speedUpStep: s })}>{Math.round(s * 100)}%</button>)}
        </div>
      </div>
      <label className="setting">
        <div><span>Start at</span><small>When a loop is set</small></div>
        <select aria-label="Start speed" value={prefs.speedUpFrom} onChange={(e) => onPrefs({ speedUpFrom: Number(e.target.value) })}>
          <option value={0}>The speed now</option>
          {STARTS.map((s) => <option key={s} value={s}>{Math.round(s * 100)}%</option>)}
        </select>
      </label>
      <label className="setting">
        <div><span>Up to</span></div>
        <select aria-label="Target speed" value={prefs.speedUpTo} onChange={(e) => onPrefs({ speedUpTo: Number(e.target.value) })}>
          {TARGETS.map((s) => <option key={s} value={s}>{Math.round(s * 100)}%</option>)}
        </select>
      </label>
    </div>}
    <div className="setting">
      <div><span>Transpose</span><small>Half steps, for this score</small></div>
      <div className="stepper">
        <button aria-label="Transpose down" disabled={transpose <= -12} onClick={() => onTranspose(transpose - 1)}>−</button>
        <output data-testid="transpose">{transpose > 0 ? `+${transpose}` : transpose}</output>
        <button aria-label="Transpose up" disabled={transpose >= 12} onClick={() => onTranspose(transpose + 1)}>+</button>
      </div>
    </div>
    <h3>Count-in and metronome</h3>
    <div className="setting">
      <div><span>Count-in</span></div>
      <div className="setting-controls">
        <div className="stepper">
          <button aria-label="Shorter count-in" disabled={prefs.countInLength <= 1} onClick={() => onPrefs({ countInLength: prefs.countInLength - 1 })}>−</button>
          <output data-testid="count-in-length">{prefs.countInLength}</output>
          <button aria-label="Longer count-in" disabled={prefs.countInLength >= COUNT_MAX[prefs.countInUnit]} onClick={() => onPrefs({ countInLength: prefs.countInLength + 1 })}>+</button>
        </div>
        <div className="segmented small" role="group" aria-label="Count-in unit">
          {(['bars', 'beats'] as const).map((unit) => <button key={unit} className={prefs.countInUnit === unit ? 'on' : ''} aria-pressed={prefs.countInUnit === unit}
            onClick={() => onPrefs({ countInUnit: unit, countInLength: Math.min(prefs.countInLength, COUNT_MAX[unit]) })}>{unit === 'bars' ? 'Bars' : 'Beats'}</button>)}
        </div>
      </div>
    </div>
    {toggle('Count in each loop', prefs.countInLoops, () => onPrefs({ countInLoops: !prefs.countInLoops }), 'Count in again each time a loop comes round')}
    {toggle('Accent the first beat', prefs.accent, () => onPrefs({ accent: !prefs.accent }), 'A higher click on beat one of each bar')}
    {toggle('Metronome only', metronomeOnly, () => onMetronomeOnly(!metronomeOnly), 'Mute the music and keep the click, playhead and lit notes, to play it yourself (Shift+M)')}
    <h3>Display</h3>
    {toggle('Note names', prefs.noteNames, () => onPrefs({ noteNames: !prefs.noteNames }), 'On the keys and falling notes (N)')}
    <div className="setting">
      <div><span>Sheet</span></div>
      <div className="segmented small" role="group" aria-label="Sheet colours">
        <button className={prefs.theme === 'paper' ? 'on' : ''} aria-pressed={prefs.theme === 'paper'} onClick={() => onPrefs({ theme: 'paper' })}>Paper</button>
        <button className={prefs.theme === 'night' ? 'on' : ''} aria-pressed={prefs.theme === 'night'} onClick={() => onPrefs({ theme: 'night' })}>Night</button>
      </div>
    </div>
    <h3>Sound</h3>
    {slider('Volume', 'Volume', prefs.volume, onVolume)}
    <div className="setting">
      <div><span>Room</span></div>
      <div className="segmented small" role="group" aria-label="Room">
        {(Object.keys(ROOMS) as Room[]).map((room) => <button key={room} className={prefs.room === room ? 'on' : ''} aria-pressed={prefs.room === room}
          onClick={() => onRoom(room)}>{ROOMS[room].label}</button>)}
      </div>
    </div>
    {staves.map((s) => slider(s.name, `${s.name} volume`, handVolume(s.index), (v) => onHandVolume(s.index, v), `hand-volume staff-${Math.min(s.index, 2)}`))}
  </div>
}
