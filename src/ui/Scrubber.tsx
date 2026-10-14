import { useRef } from 'react'
import type { Timeline } from '../reader/timeline'
import type { Loop } from '../reader/player'

export const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** The whole piece as a bar: a tick per bar, the loop, how far we are. Click or drag to move. */
export default function Scrubber({ timeline, time, loop, onSeek }: { timeline: Timeline | null; time: number; loop: Loop | null; onSeek: (time: number) => void }) {
  const bar = useRef<HTMLDivElement>(null)
  const end = timeline?.end || 1
  const at = (clientX: number) => {
    const box = bar.current!.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - box.left) / box.width)) * end
  }
  const percent = (t: number) => `${(t / end) * 100}%`
  const passes = timeline && timeline.passes.length <= 600 ? timeline.passes : []
  return <div className="scrubber-row">
    <span className="clock">{clock(time)}</span>
    <div className="scrubber" ref={bar} role="slider" aria-label="Position in the piece" tabIndex={-1}
      aria-valuemin={0} aria-valuemax={Math.round(end)} aria-valuenow={Math.round(time)} aria-valuetext={clock(time)}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onSeek(at(e.clientX)) }}
      onPointerMove={(e) => { if (e.buttons & 1) onSeek(at(e.clientX)) }}>
      <div className="scrub-track">
        {passes.map((p, i) => i > 0 && <span key={i} className="scrub-tick" style={{ left: percent(p.time) }} />)}
        {loop && <span className="scrub-loop" style={{ left: percent(loop.start), width: percent(loop.end - loop.start) }} />}
        <span className="scrub-fill" style={{ width: percent(Math.min(time, end)) }} />
      </div>
      <span className="scrub-knob" style={{ left: percent(Math.min(time, end)) }} />
    </div>
    <span className="clock">{clock(timeline?.end ?? 0)}</span>
  </div>
}
