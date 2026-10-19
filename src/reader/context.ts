import { pitchClass, pitchClassNumber } from '../engine/notes'
import { indexAt, type Timeline } from './timeline'

// Exact pitch-class sets only. Melody notes and ambiguous sets are left unlabelled.
const CHORDS = [
  { suffix: '', intervals: [0, 4, 7] }, { suffix: 'm', intervals: [0, 3, 7] },
  { suffix: 'dim', intervals: [0, 3, 6] }, { suffix: '7', intervals: [0, 4, 7, 10] },
  { suffix: 'maj7', intervals: [0, 4, 7, 11] }, { suffix: 'm7', intervals: [0, 3, 7, 10] },
  { suffix: 'm7♭5', intervals: [0, 3, 6, 10] },
]

/** An estimate for each played bar, from pitched notes that overlap it; never a source chord symbol. */
export function estimateChords(timeline: Timeline): (string | null)[] {
  const longest = timeline.sounds.reduce((n, s) => Math.max(n, s.end - s.time), 0)
  return timeline.passes.map((pass) => {
    const notes: number[] = []
    for (let i = Math.max(0, indexAt(timeline.sounds, pass.time - longest)); i < timeline.sounds.length; i++) {
      const sound = timeline.sounds[i]
      if (sound.time >= pass.end - 1e-6) break
      if (sound.end > pass.time + 1e-6) notes.push(sound.midi)
    }
    const classes = new Set(notes.map(pitchClassNumber))
    if (classes.size < 3 || classes.size > 4) return null
    const matches: string[] = []
    for (const root of classes) for (const chord of CHORDS) {
      if (chord.intervals.length !== classes.size || !chord.intervals.every((n) => classes.has((root + n) % 12))) continue
      const bass = pitchClassNumber(Math.min(...notes))
      matches.push(`${pitchClass(root)}${chord.suffix}${bass === root ? '' : `/${pitchClass(bass)}`}`)
    }
    return matches.length === 1 ? matches[0] : null
  })
}
