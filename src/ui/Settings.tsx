import { useEffect, useRef } from 'react'
import type { Prefs } from '../reader/prefs'

interface Props {
  prefs: Prefs
  transpose: number
  speed: number
  onPrefs: (patch: Partial<Prefs>) => void
  onTranspose: (transpose: number) => void
  onSpeed: (speed: number) => void
  onVolume: (volume: number) => void
  onClose: () => void
}

const SPEEDS = [0.5, 0.75, 1]

/** The settings that are changed now and then: pitch, labels, sheet colours, practice helpers, volume. */
export default function Settings({ prefs, transpose, speed, onPrefs, onTranspose, onSpeed, onVolume, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  // Close on a click anywhere else; the button that opened it toggles it itself.
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const target = e.target as Element
      if (!panel.current?.contains(target) && !target.closest('[data-settings-toggle]')) onClose()
    }
    window.addEventListener('pointerdown', away)
    return () => window.removeEventListener('pointerdown', away)
  }, [onClose])

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
    {toggle('Speed up loops', prefs.speedUp, () => onPrefs({ speedUp: !prefs.speedUp }), '5 % faster each time a loop comes round, up to 100 %')}
    <div className="setting">
      <div><span>Transpose</span><small>Half steps, for this score</small></div>
      <div className="stepper">
        <button aria-label="Transpose down" disabled={transpose <= -12} onClick={() => onTranspose(transpose - 1)}>−</button>
        <output data-testid="transpose">{transpose > 0 ? `+${transpose}` : transpose}</output>
        <button aria-label="Transpose up" disabled={transpose >= 12} onClick={() => onTranspose(transpose + 1)}>+</button>
      </div>
    </div>
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
    <label className="setting volume">
      <span>Volume</span>
      <input type="range" min={0} max={100} value={Math.round(prefs.volume * 100)} aria-label="Volume"
        style={{ '--fill': `${prefs.volume * 100}%` } as React.CSSProperties}
        onChange={(e) => onVolume(Number(e.target.value) / 100)} />
    </label>
  </div>
}
