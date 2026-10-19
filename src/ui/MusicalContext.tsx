import { useMemo } from 'react'
import { estimateChords } from '../reader/context'
import { indexAt, passAt, type Timeline } from '../reader/timeline'
import Icon from './Icons'

export default function MusicalContext({ timeline, time, playing }: { timeline: Timeline; time: number; playing: boolean }) {
  const chords = useMemo(() => estimateChords(timeline), [timeline])
  const passIndex = passAt(timeline, time), pass = timeline.passes[passIndex]
  const clicks = useMemo(() => {
    let cursor = 0
    return timeline.passes.map((p) => {
      while (cursor < timeline.clicks.length && timeline.clicks[cursor].time < p.time - 1e-6) cursor++
      const first = cursor
      while (cursor < timeline.clicks.length && timeline.clicks[cursor].time < p.end - 1e-6) cursor++
      return timeline.clicks.slice(first, cursor)
    })
  }, [timeline])
  const beat = Math.max(0, indexAt(clicks[passIndex], time))
  const pedal = timeline.pedals.some((p) => time >= p.time && time < p.end)
  return <div className="musical-context" aria-label="Musical context">
    <div className="beat-context" data-beat={beat + 1}><span>Beat <strong>{beat + 1}</strong> / {clicks[passIndex].length || pass.beats}</span>
      <span className="beat-dots" aria-hidden="true">{clicks[passIndex].slice(0, 12).map((_, i) => <i key={`${i}:${i === beat}`} className={`${i === beat ? 'active' : ''}${playing ? ' pulsing' : ''}`} />)}</span></div>
    <div className="chord-context" title="An estimate from the notes in this played bar. Melody notes, unusual voicings and ambiguous sets can leave it unlabelled.">
      <span>Chord estimate</span><strong data-testid="chord-estimate">{chords[passIndex] ?? '—'}</strong></div>
    <div className={`pedal-context${pedal ? ' down' : ''}`} data-testid="pedal-context"><Icon name="pedal" size={17} />
      {timeline.pedals.length ? pedal ? 'Pedal down' : 'Pedal up' : 'Pedal · no marks'}</div>
  </div>
}
