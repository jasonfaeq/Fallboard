import { useEffect, useRef, useState } from 'react'
import { Accidental, Beam, Dot, Formatter, GraceNote, GraceNoteGroup, Renderer, Stave, StaveConnector, StaveNote, StaveTie, Tuplet, VexFlow, Voice } from 'vexflow/bravura'
import type { Score, ScoreEvent } from '../engine/score'

export type Assist = 'full' | 'staff' | 'page'
interface Position { beat: number; x: number }
const fonts = VexFlow.loadFonts('Bravura', 'Academico')
const keyFor = (name: string) => name.slice(0, -1).toLowerCase() + '/' + name.at(-1)

export default function Staff({ score, beat, assist }: { score: Score; beat: number; assist: Assist }) {
  const host = useRef<HTMLDivElement>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [info, setInfo] = useState('Loading the music font…')
  const page = assist === 'page'
  useEffect(() => {
    let cancelled = false
    void fonts.then(() => {
      if (cancelled || !host.current) return
      VexFlow.setFonts('Bravura', 'Academico')
      const css = getComputedStyle(document.documentElement)
      const colour = (v: string) => css.getPropertyValue(v).trim()
      const div = host.current
      div.replaceChildren()
      const widths = score.bars.map((bar) => Math.max(bar.number === 0 ? 220 : 350,
        130 + Math.max(...(['R', 'L'] as const).flatMap((h) => [...new Set(bar.events.filter((e) => e.hand === h).map((e) => e.voice))]
          .map((v) => bar.events.filter((e) => e.hand === h && e.voice === v).length))) * 32))
      const rows = page ? Math.ceil(score.bars.length / 3) : 1
      const rowWidths = Array.from({ length: rows }, (_, r) => widths.slice(page ? r * 3 : 0, page ? r * 3 + 3 : widths.length).reduce((a, b) => a + b, 20))
      const renderer = new Renderer(div, Renderer.Backends.SVG)
      const width = Math.max(...rowWidths)
      const height = rows * 270
      renderer.resize(width, height)
      const svg = div.querySelector('svg')!
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      // VexFlow sets fixed inline pixel dimensions; Page needs those resized too.
      if (page) { svg.style.width = '100%'; svg.style.height = 'auto' }
      const ctx = renderer.getContext()
      ctx.setFillStyle(colour('--ink')).setStrokeStyle(colour('--ink'))
      const notes = new Map<string, StaveNote>()
      const anchors: Position[] = []
      let x = 10
      score.bars.forEach((bar, i) => {
        const row = page ? Math.floor(i / 3) : 0
        const first = i === 0 || (page && i % 3 === 0)
        if (first) x = 10
        const treble = new Stave(x, row * 270 + 25, widths[i])
        const bass = new Stave(x, row * 270 + 145, widths[i])
        if (first) {
          treble.addClef('treble').addKeySignature(score.key === 'Em' ? 'G' : 'C').addTimeSignature(score.time.join('/'))
          bass.addClef('bass').addKeySignature(score.key === 'Em' ? 'G' : 'C').addTimeSignature(score.time.join('/'))
        }
        const noteStart = Math.max(treble.getNoteStartX(), bass.getNoteStartX())
        for (const stave of [treble, bass]) {
          stave.setNoteStartX(noteStart).setStyle({ strokeStyle: colour('--dim'), fillStyle: colour('--ink') }).setContext(ctx).draw()
        }
        if (first) new StaveConnector(treble, bass).setType('brace').setContext(ctx).draw()
        new StaveConnector(treble, bass).setType('singleRight').setContext(ctx).draw()
        ctx.setFont('Segoe UI', 11).fillText(bar.number === 0 ? 'pickup' : String(bar.number), x + 4, row * 270 + 18)
        const make = (events: ScoreEvent[], clef: 'treble' | 'bass', polyphonic: boolean) => {
          const inForce = new Map<string, string>()
          return events.map((event) => {
            const ink = { fillStyle: colour(page ? '--ink' : event.hand === 'R' ? '--right' : '--left'), strokeStyle: colour(page ? '--ink' : event.hand === 'R' ? '--right' : '--left') }
            const rest = !event.pitches.length
            const note = new StaveNote({ keys: rest ? [clef === 'treble' ? 'b/4' : polyphonic && event.voice === 0 ? 'e/4' : 'd/3'] : event.pitches.map((p) => keyFor(p.name)),
              duration: String(event.denominator) + (event.dotted ? 'd' : '') + (rest ? 'r' : ''), clef })
            if (polyphonic) note.setStemDirection(event.voice === 0 ? 1 : -1)
            note.setStyle(ink).setLedgerLineStyle(ink)
            for (const [index, p] of event.pitches.entries()) {
              const [, letter, acc = '', octave] = /^([A-G])(#{1,2}|b{1,2})?([0-8])$/.exec(p.name)!
              const line = letter + octave
              const signature = score.key === 'Em' && letter === 'F' ? '#' : ''
              if (!event.tieIn && (inForce.get(line) ?? signature) !== acc) note.addModifier(new Accidental(acc || 'n'), index)
              inForce.set(line, acc)
            }
            if (event.dotted) Dot.buildAndAttach([note], { all: true })
            if (event.grace.length) {
              const grace = event.grace.map((p) => new GraceNote({ keys: [keyFor(p.name)], duration: '8', slash: true }).setStyle(ink))
              note.addModifier(new GraceNoteGroup(grace, false), 0)
            }
            notes.set(event.id, note)
            return note
          })
        }
        const rightEvents = bar.events.filter((e) => e.hand === 'R')
        const leftEvents = bar.events.filter((e) => e.hand === 'L')
        const streams = [rightEvents, leftEvents].flatMap((events, h) => {
          const voiceIds = [...new Set(events.map((e) => e.voice))]
          return voiceIds.map((v) => {
            const lane = events.filter((e) => e.voice === v)
            return { events: lane, hand: h, notes: make(lane, h === 0 ? 'treble' : 'bass', voiceIds.length > 1) }
          })
        })
        const tuplets: Tuplet[] = []
        for (const { events } of streams) {
          for (let j = 0; j < events.length; j++) if (events[j].triplet) {
            tuplets.push(new Tuplet(events.slice(j, j + 3).map((e) => notes.get(e.id)!), { numNotes: 3, notesOccupied: 2 }))
            j += 2
          }
        }
        // Attach beams before drawing voices so VexFlow suppresses individual flags.
        const beams = streams.map(({ notes: n, hand: h, events }) => Beam.generateBeams(n,
          new Set(bar.events.filter((e) => e.hand === (h === 0 ? 'R' : 'L')).map((e) => e.voice)).size > 1 ? { stemDirection: events[0].voice === 0 ? 1 : -1 } : {}))
        const voices = streams.map(({ notes: n }) => new Voice({ numBeats: score.time[0], beatValue: score.time[1] }).setStrict(false).addTickables(n))
        const formatter = new Formatter()
        for (const hand of [0, 1]) formatter.joinVoices(voices.filter((_, j) => streams[j].hand === hand))
        formatter.format(voices, widths[i] - (noteStart - x) - 24)
        voices.forEach((v, j) => v.draw(ctx, streams[j].hand === 0 ? treble : bass))
        beams.forEach((group, j) => group.forEach((beam) => {
          const ink = colour(page ? '--ink' : streams[j].hand === 0 ? '--right' : '--left')
          beam.setStyle({ fillStyle: ink, strokeStyle: ink }).setContext(ctx).draw()
        }))
        tuplets.forEach((t) => t.setStyle({ fillStyle: colour('--ink'), strokeStyle: colour('--ink') }).setContext(ctx).draw())
        const beats = [...new Set(bar.events.map((e) => e.start))].sort((a, b) => a - b)
        for (const at of beats) {
          const e = bar.events.find((event) => Math.abs(event.start - at) < 1e-7)!
          anchors.push({ beat: at, x: notes.get(e.id)!.getAbsoluteX() })
        }
        anchors.push({ beat: bar.start + bar.beats, x: x + widths[i] - 8 })
        x += widths[i]
      })
      for (const hand of ['R', 'L'] as const) {
        for (const voice of new Set(score.events.filter((e) => e.hand === hand).map((e) => e.voice))) {
        const events = score.events.filter((e) => e.hand === hand && e.voice === voice)
        events.forEach((e, i) => {
          if (!e.tieIn) return
          const previous = events[i - 1]
          const indexes = e.pitches.map((_, n) => n)
          const split = page && Math.floor(score.bars.findIndex((b) => b.number === previous.bar) / 3) !== Math.floor(score.bars.findIndex((b) => b.number === e.bar) / 3)
          const draw = (firstNote: StaveNote | undefined, lastNote: StaveNote | undefined) =>
            new StaveTie({ firstNote, lastNote, firstIndexes: indexes, lastIndexes: indexes }).setStyle({ fillStyle: colour('--ink'), strokeStyle: colour('--ink') }).setContext(ctx).draw()
          if (split) { draw(notes.get(previous.id), undefined); draw(undefined, notes.get(e.id)) }
          else draw(notes.get(previous.id), notes.get(e.id))
        })
        }
      }
      setPositions(anchors)
      div.dataset.noteXs = anchors.map((p) => Math.round(p.x)).join(',')
      div.dataset.barCount = String(score.bars.length)
      setInfo(`${score.bars.length - (score.pickup ? 1 : 0)} bars${score.pickup ? ' and pickup' : ''} drawn from the score`)
    }).catch((e) => setInfo(`Could not draw staff: ${String(e)}`))
    return () => { cancelled = true }
  }, [score, page])
  const sorted = positions.filter((p, i) => i === positions.length - 1 || p.beat !== positions[i + 1].beat)
  const before = [...sorted].reverse().find((p) => p.beat <= beat) ?? sorted[0]
  const after = sorted.find((p) => p.beat > beat)
  const x = before ? after ? before.x + (after.x - before.x) * Math.max(0, Math.min(1, (beat - before.beat) / (after.beat - before.beat))) : before.x : 0
  return <section className={`score-staff ${page ? 'page' : 'scrolling'}`} aria-label="Grand staff">
    <div className="staff-window">
      <div className="staff-svg" ref={host} data-testid="staff" style={page ? undefined : { transform: `translateX(${120 - x}px)` }} />
      {!page && <div className="staff-playhead" aria-hidden="true" />}
    </div>
    <span className="sr-only" data-testid="staff-info">{info}</span>
  </section>
}
