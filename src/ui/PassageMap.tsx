import { useMemo, useRef, useState } from 'react'
import { buildPassages, passageDensity, passageLabel, type Passage } from '../reader/passages'
import { passAt, type Timeline } from '../reader/timeline'
import type { Section } from '../reader/prefs'
import Icon from './Icons'

interface Props {
  timeline: Timeline
  time: number
  loop: [number, number] | null
  sections: Section[]
  onSeek: (first: number) => void
  onLoop: (range: [number, number] | null) => void
  onSave: (name: string, range: [number, number]) => void
  onSavedPick: (index: number) => void
  onClose: () => void
}

/** A map of played passages, with explicit repeat passes and editable loop boundaries. */
export default function PassageMap({ timeline, time, loop, sections, onSeek, onLoop, onSave, onSavedPick, onClose }: Props) {
  const passages = useMemo(() => buildPassages(timeline), [timeline])
  const density = useMemo(() => passageDensity(timeline), [timeline])
  const maximum = Math.max(1, ...density)
  const [selected, setSelected] = useState<Passage | null>(null)
  const overview = useRef<HTMLDivElement>(null)
  const current = passAt(timeline, time)
  const chosen = loop ? { first: loop[0], last: loop[1] }
    : selected && selected.last < timeline.passes.length ? selected
      : passages.find((passage) => current >= passage.first && current <= passage.last) ?? passages[0]
  if (!chosen) return null
  const range: [number, number] = [chosen.first, chosen.last]
  const label = passageLabel(timeline, chosen)
  const first = timeline.passes[chosen.first], last = timeline.passes[chosen.last]
  const same = (a: Passage, b: Passage) => a.first === b.first && a.last === b.last
  const moveBoundary = (edge: 'start' | 'end', index: number) => {
    const at = Math.max(0, Math.min(timeline.passes.length - 1, index))
    const next: [number, number] = edge === 'start' ? [Math.min(at, range[1]), range[1]] : [range[0], Math.max(at, range[0])]
    setSelected({ first: next[0], last: next[1] })
    onLoop(next)
  }
  const atPointer = (x: number) => {
    const box = overview.current!.getBoundingClientRect()
    return passAt(timeline, Math.max(0, Math.min(timeline.end - 1e-6, (x - box.left) / box.width * timeline.end)))
  }
  const handle = (edge: 'start' | 'end') => <button className={`passage-handle ${edge}`} aria-label={`Loop ${edge} boundary`}
    title="Drag, or use left / right arrows to move one played bar"
    onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId) }}
    onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId) && (e.buttons & 1)) moveBoundary(edge, atPointer(e.clientX)) }}
    onKeyDown={(e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault(); e.stopPropagation()
      moveBoundary(edge, (edge === 'start' ? range[0] : range[1]) + (e.key === 'ArrowLeft' ? -1 : 1))
    }}><span /></button>

  return <aside className="passage-map" aria-label="Passage map">
    <header><div><span className="eyebrow">FIND YOUR PLACE</span><h2>Passage map</h2></div>
      <button className="icon-button" aria-label="Close passage map" onClick={onClose}><Icon name="close" size={16} /></button></header>
    <div className="passage-overview" ref={overview} aria-label="Played bars and loop boundaries">
      <svg viewBox="0 0 200 46" preserveAspectRatio="none" aria-hidden="true">
        {density.map((count, i) => <rect key={i} x={timeline.passes[i].time / timeline.end * 200}
          y={40 - count / maximum * 30} width={Math.max(.6, (timeline.passes[i].end - timeline.passes[i].time) / timeline.end * 200 - 1)}
          height={4 + count / maximum * 30} />)}
      </svg>
      <span className={`passage-range${loop ? ' looping' : ''}`} style={{ left: `${first.time / timeline.end * 100}%`, width: `${(last.end - first.time) / timeline.end * 100}%` }}>
        {handle('start')}{handle('end')}
      </span>
      <span className="passage-playhead" style={{ left: `${Math.min(1, time / timeline.end) * 100}%` }} />
    </div>
    <div className="passage-selection"><strong>{label}</strong><span>Played bars {chosen.first + 1}–{chosen.last + 1}</span>
      <button className={`chip${loop ? ' on' : ''}`} aria-pressed={!!loop} onClick={() => onLoop(loop ? null : range)}>
        <Icon name="loop" size={15} />{loop ? 'Release passage loop' : 'Loop passage'}</button>
    </div>
    <form className="passage-save" key={`${chosen.first}:${chosen.last}`} onSubmit={(e) => {
      e.preventDefault()
      const name = new FormData(e.currentTarget).get('passage-name')?.toString().trim()
      onSave(name || label, range)
    }}>
      <input name="passage-name" aria-label="Passage name" placeholder={label} maxLength={80} autoComplete="off" onFocus={() => setSelected(chosen)} />
      <button className="icon-button" type="submit" aria-label="Save passage" title="Save this passage as a named section"><Icon name="sections" size={17} /></button>
    </form>
    <div className="passage-scroll">
      {sections.length > 0 && <><h3>Saved passages</h3><div className="passage-saved">
        {sections.map((section, i) => section.last < timeline.passes.length && <button key={`${section.first}:${section.last}`} className={same(section, chosen) ? 'selected' : ''}
          onClick={() => { setSelected(section); onSavedPick(i) }}><Icon name="sections" size={13} /><span>{section.name}</span><small>{passageLabel(timeline, section)}</small></button>)}
      </div></>}
      <h3>Through the piece</h3>
      <ol className="passage-list">{passages.map((passage, index) => <li key={passage.first}>
        <button className={`${same(passage, chosen) ? 'selected ' : ''}${current >= passage.first && current <= passage.last ? 'current' : ''}`}
          aria-label={`${passageLabel(timeline, passage)}, played bars ${passage.first + 1} to ${passage.last + 1}`}
          aria-pressed={same(passage, chosen)} onClick={() => { setSelected(passage); onSeek(passage.first) }}>
          <span><strong>{passageLabel(timeline, passage)}</strong><small>Passage {index + 1}</small></span>
          <span className="passage-density" aria-hidden="true">{density.slice(passage.first, passage.last + 1).map((value, i) => <i key={i} style={{ height: `${4 + value / maximum * 18}px` }} />)}</span>
        </button>
      </li>)}</ol>
    </div>
    <p className="passage-hint">Drag the handles to shape a loop. Repeated bars have their own place.</p>
  </aside>
}
