// D-08 spike: can VexFlow draw our notes on a grand staff, tell us where each note is, and
// let us recolour single notes? Throwaway: the real Staff.tsx is fed from the Score model.
// The notes are a sketch of Chopin's Prelude in E minor, bars 1–4, not a checked transcription.
import { useEffect, useRef, useState } from 'react'
import { Accidental, Beam, Dot, Formatter, Renderer, Stave, StaveConnector, StaveNote, VexFlow, Voice } from 'vexflow/bravura'

type Chord = [keys: string, duration: string]
interface Bar { right: Chord[]; left: Chord[] }

const repeat = (keys: string, n: number): Chord[] => Array.from({ length: n }, () => [keys, '8'])
const BARS: Bar[] = [
  { right: [['b/4', 'hd'], ['c/5', 'q']], left: repeat('g/3 b/3 e/4', 8) },
  { right: [['b/4', 'hd'], ['c/5', 'q']], left: [...repeat('f#/3 a/3 e/4', 4), ...repeat('f#/3 a/3 d#/4', 4)] },
  { right: [['b/4', 'hd'], ['c/5', 'q']], left: [...repeat('f/3 a/3 d#/4', 4), ...repeat('f/3 a/3 d/4', 4)] },
  { right: [['b/4', 'hd'], ['bb/4', 'q']], left: [...repeat('f/3 g#/3 d/4', 4), ...repeat('e/3 g#/3 d/4', 4)] },
]

/** E minor: every F is sharp */
const KEY_SIGNATURE: Record<string, string> = { f: '#' }

const FIRST_BAR_W = 420
const BAR_W = 330
const TREBLE_Y = 20
const BASS_Y = 130
const HEIGHT = 260

export default function StaffSpike() {
  const host = useRef<HTMLDivElement>(null)
  const [info, setInfo] = useState('Loading the music font…')

  useEffect(() => {
    let cancelled = false
    const css = getComputedStyle(document.documentElement)
    const colour = (name: string) => css.getPropertyValue(name).trim()
    void VexFlow.loadFonts('Bravura', 'Academico').then(() => {
      const div = host.current
      if (cancelled || !div) return
      VexFlow.setFonts('Bravura', 'Academico')
      const started = performance.now()
      div.replaceChildren()
      const renderer = new Renderer(div, Renderer.Backends.SVG)
      renderer.resize(FIRST_BAR_W + BAR_W * (BARS.length - 1) + 20, HEIGHT)
      const ctx = renderer.getContext()
      ctx.setFillStyle(colour('--ink'))
      ctx.setStrokeStyle(colour('--ink'))

      const xs: number[] = []
      let x = 10
      BARS.forEach((bar, b) => {
        const width = b === 0 ? FIRST_BAR_W : BAR_W
        const treble = new Stave(x, TREBLE_Y, width)
        const bass = new Stave(x, BASS_Y, width)
        if (b === 0) {
          treble.addClef('treble').addKeySignature('G').addTimeSignature('C|')
          bass.addClef('bass').addKeySignature('G').addTimeSignature('C|')
        }
        const startX = Math.max(treble.getNoteStartX(), bass.getNoteStartX())
        for (const stave of [treble, bass]) {
          stave.setNoteStartX(startX)
          stave.setStyle({ strokeStyle: colour('--dim'), fillStyle: colour('--ink') })
          stave.setContext(ctx).draw()
        }
        if (b === 0) new StaveConnector(treble, bass).setType('brace').setContext(ctx).draw()
        new StaveConnector(treble, bass).setType(b === 0 ? 'singleLeft' : 'singleRight').setContext(ctx).draw()

        const ink = { fillStyle: colour('--ink'), strokeStyle: colour('--ink') }
        const make = (chords: Chord[], clef: string) => {
          // Our own accidentals: an accidental holds for its line until the bar ends.
          // (VexFlow's Accidental.applyAccidentals repeated some of them across two voices.)
          const inForce = new Map<string, string>()
          return chords.map(([keys, duration]) => {
            const note = new StaveNote({ keys: keys.split(' '), duration, clef })
            note.setStyle(ink).setLedgerLineStyle(ink)
            keys.split(' ').forEach((key, i) => {
              const [, letter, acc, octave] = key.match(/^([a-g])([#b]?)\/(\d)$/)!
              const line = letter + octave
              if ((inForce.get(line) ?? KEY_SIGNATURE[letter] ?? '') === acc) return
              inForce.set(line, acc)
              note.addModifier(new Accidental(acc || 'n'), i)
            })
            if (duration.endsWith('d')) Dot.buildAndAttach([note], { all: true })
            return note
          })
        }
        const right = make(bar.right, 'treble')
        const left = make(bar.left, 'bass')
        const voices = [right, left].map((notes) => new Voice({ numBeats: 4, beatValue: 4 }).addTickables(notes))
        const beams = [new Beam(left.slice(0, 4)), new Beam(left.slice(4))]
        new Formatter().joinVoices([voices[0]]).joinVoices([voices[1]]).format(voices, width - (startX - x) - 16)

        // what the game needs: colour a single note (hit / miss)…
        if (b === 0) left[2].setStyle({ fillStyle: colour('--left'), strokeStyle: colour('--left') })
        if (b === 0) right[0].setStyle({ fillStyle: colour('--right'), strokeStyle: colour('--right') })
        if (b === 1) left[5].setStyle({ fillStyle: colour('--miss'), strokeStyle: colour('--miss') })

        voices[0].draw(ctx, treble)
        voices[1].draw(ctx, bass)
        for (const beam of beams) beam.setStyle(ink).setContext(ctx).draw()
        // …and the x position of every note, for the playhead
        for (const note of left) xs.push(Math.round(note.getAbsoluteX()))
        x += width
      })

      const ms = Math.round(performance.now() - started)
      div.dataset.noteXs = xs.join(',')
      setInfo(`${BARS.length} bars drawn in ${ms} ms. Left-hand note positions: ${xs.slice(0, 8).join(', ')} …`)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <section className="spike">
      <div className="staff" ref={host} data-testid="staff" />
      <p className="hint" data-testid="staff-info">{info}</p>
    </section>
  )
}
