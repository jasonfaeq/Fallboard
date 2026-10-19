// The keys: notes fall onto a piano keyboard and light the keys they land on, in their hand's
// colour. The view covers the piece's range (at least three octaves), so the keys stay large.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MAX_VELOCITY, pitchClass } from '../engine/notes'
import { indexAt, type Timeline } from '../reader/timeline'
import type { StageScene } from '../reader/prefs'
import Keyboard, { keyLayout, keyRange } from './Keyboard'
import { useReducedMotion } from './useReducedMotion'
import StageRoom from './StageRoom'

interface Props {
  timeline: Timeline | null
  time: number
  names: boolean
  muted: ReadonlySet<number>
  /** keys held down with the mouse */
  pressed: ReadonlySet<number>
  lighting: number
  performanceView: boolean
  stageScene: StageScene
  onPress: (note: number) => void
  onRelease: (note: number) => void
}

/** score seconds shown above the keyboard */
const WINDOW = 3.2

export default function KeysView({ timeline, time, names, muted, pressed, lighting, performanceView, stageScene, onPress, onRelease }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const reducedMotion = useReducedMotion()
  const ambient = reducedMotion ? 0 : lighting
  const [low, high] = keyRange(timeline?.low ?? 48, timeline?.high ?? 83)
  const keys = useMemo(() => keyLayout(low, high), [low, high])
  const byNote = useMemo(() => new Map(keys.map((k) => [k.note, k])), [keys])
  const longest = useMemo(() => timeline?.sounds.reduce((max, s) => Math.max(max, s.end - s.time), 0) ?? 0, [timeline])
  const longestRelease = useMemo(() => timeline?.sounds.reduce((max, s) => Math.max(max, s.release - s.time), 0) ?? 0, [timeline])
  const whites = keys.filter((k) => !k.black).length
  const keyboardHeight = Math.round(Math.max(56, Math.min(performanceView ? 180 : 150, size.width / whites * (performanceView ? 4.8 : 4.2), size.height * 0.5)))
  const rollHeight = Math.max(0, size.height - keyboardHeight)

  useEffect(() => {
    const el = box.current!
    const observer = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Which keys the score is playing now: unmuted staves only.
  const lit = new Map<number, number>()
  const energy = new Map<number, number>()
  const sustained = new Map<number, { staff: number; energy: number; remaining: number }>()
  if (timeline) {
    const { sounds } = timeline
    const lookBack = performanceView && ambient > 0 ? longestRelease : longest
    for (let i = indexAt(sounds, time); i >= 0 && sounds[i].time >= time - lookBack - 1e-6; i--) {
      const s = sounds[i]
      if (muted.has(s.staff)) continue
      if (s.end > time + 1e-6 && !lit.has(s.midi)) {
        lit.set(s.midi, s.staff)
        energy.set(s.midi, s.velocity / MAX_VELOCITY)
      } else if (performanceView && ambient > 0 && s.end <= time + 1e-6 && s.release > time + 1e-6 && !sustained.has(s.midi)) {
        sustained.set(s.midi, { staff: s.staff, energy: s.velocity / MAX_VELOCITY,
          remaining: (s.release - time) / (s.release - s.end) })
      }
    }
  }
  for (const note of pressed) { lit.set(note, -1); energy.set(note, .7) }

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

    // A key lifts at its written end; its light can linger until the score's pedal lifts.
    // Recomputed from score time on every draw, so seeks, repeats and transposition cannot
    // leave particles from an earlier position behind.
    if (ambient > 0) for (const [note, tail] of sustained) {
      if (lit.has(note)) continue
      const key = byNote.get(note)
      if (!key) continue
      const width = Math.max(3, key.width * w * .72), x = (key.x + key.width / 2) * w - width / 2
      const height = Math.min(h * .48, 65 + tail.energy * 95) * (.45 + tail.remaining * .55)
      const fill = colours[Math.min(tail.staff, 2)]
      const ribbon = ctx.createLinearGradient(0, h - height, 0, h)
      ribbon.addColorStop(0, 'transparent'); ribbon.addColorStop(.75, fill); ribbon.addColorStop(1, fill)
      ctx.fillStyle = ribbon; ctx.globalAlpha = ambient * (.12 + tail.remaining * .28) * tail.energy
      ctx.shadowColor = fill; ctx.shadowBlur = 18 * ambient
      ctx.beginPath(); ctx.roundRect(x, h - height, width, height, Math.min(width / 2, 6)); ctx.fill()
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0

    // The light follows actual active score notes and their authored dynamics. It has no
    // independent animation clock, and no analyser or extra audio processing is needed.
    if (ambient > 0) {
      for (const [note, staff] of lit) {
        const key = byNote.get(note)
        if (!key) continue
        const x = (key.x + key.width / 2) * w
        const fill = colours[staff < 0 ? 0 : Math.min(staff, 2)]
        const radius = Math.max(60, Math.min(w * .28, h * 1.1))
        const bloom = ctx.createRadialGradient(x, h, 0, x, h, radius)
        bloom.addColorStop(0, fill); bloom.addColorStop(1, 'transparent')
        ctx.globalAlpha = ambient * (energy.get(note) ?? .5) * (performanceView ? .28 : .16)
        ctx.fillStyle = bloom; ctx.fillRect(x - radius, h - radius, radius * 2, radius)
      }
      ctx.globalAlpha = 1
    }

    // Darker lanes above the black keys, octave lines at every C, bar lines with their numbers.
    ctx.fillStyle = colour('--lane')
    for (const k of keys) if (k.black) ctx.fillRect(k.x * w, 0, k.width * w, h)
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
            // Sounding notes glow; every note gets a soft sheen down its left side.
            const sounding = s.time <= time + 1e-6
            if (sounding && ambient > 0) { ctx.shadowColor = fill; ctx.shadowBlur = 24 * ambient }
            ctx.fillStyle = fill
            ctx.fill()
            ctx.shadowBlur = 0
            const sheen = ctx.createLinearGradient(x, 0, x + width, 0)
            sheen.addColorStop(0, sounding ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.32)')
            sheen.addColorStop(0.6, 'rgba(255,255,255,0)')
            ctx.fillStyle = sheen
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
    // A small pool of light where each sounding note meets its key.
    if (ambient > 0) for (const [note, staff] of lit) {
      const key = byNote.get(note)
      if (!key) continue
      const x = (key.x + key.width / 2) * w
      ctx.fillStyle = colours[staff < 0 ? 0 : Math.min(staff, 2)]
      ctx.globalAlpha = ambient * (energy.get(note) ?? .5) * .5
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 15 * ambient
      ctx.beginPath(); ctx.ellipse(x, h - 2, key.width * w * .8, 5 + ambient * 4, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1
    // The line the notes land on.
    const glow = ctx.createLinearGradient(0, h - 22, 0, h)
    glow.addColorStop(0, 'transparent')
    glow.addColorStop(1, ambient > 0 ? colour('--glow') : 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(0, h - 22, w, 22)
    ctx.fillStyle = colour('--right')
    ctx.globalAlpha = 0.7
    ctx.fillRect(0, h - 1.5, w, 1.5)
    ctx.globalAlpha = 1
  }, [time, size, rollHeight, timeline, keys, byNote, longest, names, muted, pressed, ambient, performanceView, stageScene])

  return <div className="keys" ref={box} data-testid="keys" data-lighting={ambient} style={{ '--lighting': ambient } as React.CSSProperties}
    data-lit={[...lit.keys()].sort((a, b) => a - b).join(',')}
    data-sustained={[...sustained.keys()].filter((note) => !lit.has(note)).sort((a, b) => a - b).join(',')}>
    {performanceView && <StageRoom />}
    <canvas ref={canvas} style={{ height: rollHeight }} aria-label="Falling notes" role="img" />
    {performanceView && <div className="stage-fallboard" style={{ bottom: keyboardHeight }} aria-hidden="true"><span>F A L L B O A R D</span></div>}
    {size.width > 0 && <Keyboard keys={keys} width={size.width} height={keyboardHeight} lit={lit} names={names} onPress={onPress} onRelease={onRelease} />}
  </div>
}
