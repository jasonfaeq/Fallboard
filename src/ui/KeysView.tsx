// The keys: notes fall onto a piano keyboard and light the keys they land on, in their hand's
// colour. The view covers the piece's range (at least three octaves), so the keys stay large.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { pitchClass } from '../engine/notes'
import { indexAt, type Timeline } from '../reader/timeline'
import Keyboard, { keyLayout, keyRange } from './Keyboard'

interface Props {
  timeline: Timeline | null
  time: number
  names: boolean
  muted: ReadonlySet<number>
  /** keys held down with the mouse */
  pressed: ReadonlySet<number>
  onPress: (note: number) => void
  onRelease: (note: number) => void
}

/** score seconds shown above the keyboard */
const WINDOW = 3.2

export default function KeysView({ timeline, time, names, muted, pressed, onPress, onRelease }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [low, high] = keyRange(timeline?.low ?? 48, timeline?.high ?? 83)
  const keys = useMemo(() => keyLayout(low, high), [low, high])
  const byNote = useMemo(() => new Map(keys.map((k) => [k.note, k])), [keys])
  const longest = useMemo(() => timeline?.sounds.reduce((max, s) => Math.max(max, s.end - s.time), 0) ?? 0, [timeline])
  const whites = keys.filter((k) => !k.black).length
  const keyboardHeight = Math.round(Math.max(56, Math.min(150, size.width / whites * 4.2, size.height * 0.5)))
  const rollHeight = Math.max(0, size.height - keyboardHeight)

  useEffect(() => {
    const el = box.current!
    const observer = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Which keys the score is playing now: unmuted staves only.
  const lit = new Map<number, number>()
  if (timeline) {
    const { sounds } = timeline
    for (let i = indexAt(sounds, time); i >= 0 && sounds[i].time >= time - longest - 1e-6; i--) {
      const s = sounds[i]
      if (s.end > time + 1e-6 && !muted.has(s.staff) && !lit.has(s.midi)) lit.set(s.midi, s.staff)
    }
  }
  for (const note of pressed) lit.set(note, -1)

  useLayoutEffect(() => {
    const el = canvas.current
    if (!el || !size.width || !rollHeight) return
    const dpr = window.devicePixelRatio || 1
    const w = size.width, h = rollHeight
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
    }
    const ctx = el.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const css = getComputedStyle(el)
    const colour = (name: string) => css.getPropertyValue(name).trim()
    const colours = [colour('--right'), colour('--left'), colour('--other')]
    const perSecond = h / WINDOW
    const y = (t: number) => h - (t - time) * perSecond

    // Octave lines at every C, bar lines with their numbers.
    ctx.fillStyle = colour('--line')
    for (const k of keys) if (k.note % 12 === 0) ctx.fillRect(Math.round(k.x * w), 0, 1, h)
    if (timeline) {
      ctx.font = '11px "Segoe UI", system-ui, sans-serif'
      for (let i = Math.max(0, indexAt(timeline.passes, time)); i < timeline.passes.length; i++) {
        const pass = timeline.passes[i]
        if (pass.time > time + WINDOW) break
        if (pass.time < time) continue
        const at = Math.round(y(pass.time))
        ctx.fillStyle = colour('--line')
        ctx.fillRect(0, at, w, 1)
        ctx.fillStyle = colour('--dim')
        if (pass.number > 0) ctx.fillText(String(pass.number), 4, at - 4)
      }
      // White-key notes first, so black-key notes stay visible on top.
      const { sounds } = timeline
      const first = Math.max(0, indexAt(sounds, time - longest))
      for (const black of [false, true]) {
        for (let i = first; i < sounds.length; i++) {
          const s = sounds[i]
          if (s.time > time + WINDOW) break
          const key = byNote.get(s.midi)
          if (!key || key.black !== black || s.end <= time) continue
          const top = Math.max(-4, y(s.end)), bottom = Math.min(h, y(s.time))
          const x = key.x * w + 1.5, width = key.width * w - 3, height = Math.max(3, bottom - top - 1.5)
          const fill = colours[Math.min(s.staff, 2)]
          ctx.beginPath()
          ctx.roundRect(x, top, width, height, Math.min(4, width / 3))
          if (muted.has(s.staff)) {
            ctx.strokeStyle = fill
            ctx.globalAlpha = 0.45
            ctx.stroke()
            ctx.globalAlpha = 1
          } else {
            ctx.fillStyle = fill
            ctx.fill()
            if (names && height > 15 && width > 11) {
              ctx.fillStyle = colour('--stage')
              ctx.font = `600 ${Math.min(12, width * 0.5)}px "Segoe UI", system-ui, sans-serif`
              ctx.textAlign = 'center'
              ctx.fillText(pitchClass(s.midi), x + width / 2, top + height - 4)
              ctx.textAlign = 'start'
            }
          }
        }
      }
    }
    // The line the notes land on.
    const glow = ctx.createLinearGradient(0, h - 14, 0, h)
    glow.addColorStop(0, 'transparent')
    glow.addColorStop(1, colour('--glow'))
    ctx.fillStyle = glow
    ctx.fillRect(0, h - 14, w, 14)
  }, [time, size, rollHeight, timeline, keys, byNote, longest, names, muted])

  return <div className="keys" ref={box} data-testid="keys" data-lit={[...lit.keys()].sort((a, b) => a - b).join(',')}>
    <canvas ref={canvas} style={{ height: rollHeight }} aria-label="Falling notes" role="img" />
    {size.width > 0 && <Keyboard keys={keys} width={size.width} height={keyboardHeight} lit={lit} names={names} onPress={onPress} onRelease={onRelease} />}
  </div>
}
