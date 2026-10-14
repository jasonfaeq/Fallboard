import { PIANO_HIGH, PIANO_LOW, noteNumber } from './input'

export type Hand = 'L' | 'R'
export interface Pitch { name: string; midi: number }
export interface ScoreEvent {
  id: string; hand: Hand; voice: number; bar: number; start: number; beats: number
  pitches: Pitch[]; denominator: number; dotted: boolean; triplet: boolean
  grace: Pitch[]; tieIn: boolean; tieOut: boolean
}
export interface ScoreNote {
  id: string; eventIds: string[]; hand: Hand; pitch: Pitch; start: number; beats: number
}
export interface Bar { number: number; start: number; beats: number; events: ScoreEvent[] }
export interface Section { name: string; bars: [number, number] }
export interface PieceSpec {
  id: string; title: string; composer: string; source: string; licence: string; verified: boolean
  tempo: number; key: 'C' | 'Em'; time: [number, number]; pickup?: number; finalBeats?: number
  right: string | string[]; left: string | string[]; sections: Section[]; practice: string[]; notes?: string
}
export interface Score extends PieceSpec { bars: Bar[]; events: ScoreEvent[]; soundNotes: ScoreNote[]; start: number; end: number }

const EPS = 1e-7
const pitch = (name: string): Pitch => {
  const midi = noteNumber(name)
  if (midi < PIANO_LOW || midi > PIANO_HIGH) throw new Error(`Pitch outside piano: ${name}`)
  return { name, midi }
}

/** Explicit spelling/duration on every token; beats are quarter notes, including 2/2. */
export function definePiece(spec: PieceSpec): Score {
  if (!spec.id || !spec.title || !spec.source || !spec.licence) throw new Error('Piece needs id, title, source and licence')
  if (!Number.isFinite(spec.tempo) || spec.tempo <= 0) throw new Error('Invalid tempo')
  if (!spec.time.every((n) => Number.isInteger(n) && n > 0)) throw new Error('Invalid time signature')
  const beatsPerBar = spec.time[0] * 4 / spec.time[1]
  const streams = (text: string | string[]) => (Array.isArray(text) ? text : [text]).map((s) => s.trim().split('|').map((bar) => bar.trim()))
  const right = streams(spec.right), left = streams(spec.left)
  const count = right[0]?.length
  if (!count || !left.length || [...right, ...left].some((bars) => bars.length !== count)) throw new Error('Hands/voices have different bar counts')
  const lengths = right[0].map((_, i) => i === 0 && spec.pickup ? spec.pickup :
    i === count - 1 && spec.finalBeats ? spec.finalBeats : beatsPerBar)
  if (lengths.some((b) => b <= 0 || b > beatsPerBar)) throw new Error('Invalid partial bar')
  let start = spec.pickup ? -spec.pickup : 0
  const bars: Bar[] = lengths.map((beats, i) => {
    const bar = { number: i + (spec.pickup ? 0 : 1), start, beats, events: [] }
    start += beats
    return bar
  })
  const events: ScoreEvent[] = []
  for (const [hand, voices] of [['R', right], ['L', left]] as const) {
    voices.forEach((lines, voice) => {
    let previous: ScoreEvent | undefined
    lines.forEach((line, b) => {
      const bar = bars[b]
      let at = bar.start
      let grace: Pitch[] = []
      let triplets = 0
      for (const token of line.split(/\s+/).filter(Boolean)) {
        if (token.startsWith('^')) { grace.push(pitch(token.slice(1))); continue }
        const match = /^(r|[A-G](?:#{1,2}|b{1,2})?[0-8]|\[[^\]]+\]):(1|2|4|8|16|32|64)(\.?)(t?)(~?)$/.exec(token)
        if (!match) throw new Error(`${hand} bar ${bar.number}: invalid token ${token}`)
        const [, keys, length, dot, triplet, tie] = match
        if (dot && triplet) throw new Error('Dotted triplets are not supported')
        const denominator = Number(length)
        const beats = 4 / denominator * (dot ? 1.5 : 1) * (triplet ? 2 / 3 : 1)
        const pitches = keys === 'r' ? [] : (keys.startsWith('[') ? keys.slice(1, -1).split(',') : [keys]).map(pitch)
        if (new Set(pitches.map((p) => p.midi)).size !== pitches.length) throw new Error('Duplicate chord pitch')
        if (!pitches.length && (tie || grace.length)) throw new Error('Rest cannot have a tie or grace note')
        const tieIn = previous?.tieOut ?? false
        if (tieIn && (!pitches.length || previous!.pitches.map((p) => p.name).join() !== pitches.map((p) => p.name).join())) {
          throw new Error(`${hand} bar ${bar.number}: tie must continue the same pitches`)
        }
        const event: ScoreEvent = { id: `${hand}-${voice}-${bar.number}-${bar.events.filter((e) => e.hand === hand && e.voice === voice).length}`,
          hand, voice, bar: bar.number, start: at, beats, pitches, denominator, dotted: !!dot,
          triplet: !!triplet, grace, tieIn, tieOut: !!tie }
        grace = []
        events.push(event)
        bar.events.push(event)
        previous = event
        at += beats
        if (triplet) triplets++
        else if (triplets % 3) throw new Error('Triplet group must contain three notes')
      }
      if (grace.length || triplets % 3) throw new Error(`Incomplete ornament/triplet in bar ${bar.number}`)
      if (Math.abs(at - bar.start - bar.beats) > EPS) throw new Error(`${hand} bar ${bar.number}: ${at - bar.start} beats, expected ${bar.beats}`)
    })
    if (previous?.tieOut) throw new Error('Unfinished tie at end of piece')
    })
  }
  const soundNotes: ScoreNote[] = []
  const tied = new Map<string, ScoreNote>()
  for (const event of events) {
    for (const p of event.pitches) {
      const key = `${event.hand}:${event.voice}:${p.name}`
      let note = tied.get(key)
      if (event.tieIn && note) { note.beats += event.beats; note.eventIds.push(event.id) }
      else {
        note = { id: `${event.id}:${p.name}`, eventIds: [event.id], hand: event.hand, pitch: p, start: event.start, beats: event.beats }
        soundNotes.push(note)
      }
      if (event.tieOut) tied.set(key, note)
      else tied.delete(key)
    }
    // Grace notes borrow 1/8 beat from the start of their principal note.
    if (event.grace.length) {
      const borrowed = Math.min(0.125, event.beats / 4)
      const principal = soundNotes.filter((n) => n.eventIds[0] === event.id)
      for (const n of principal) { n.start += borrowed; n.beats -= borrowed }
      event.grace.forEach((p, i) => soundNotes.push({ id: `${event.id}:grace-${i}`, eventIds: [event.id], hand: event.hand,
        pitch: p, start: event.start + i * borrowed / event.grace.length, beats: borrowed / event.grace.length }))
    }
  }
  for (const section of spec.sections) {
    if (!section.name || section.bars[0] > section.bars[1] || !bars.some((b) => b.number === section.bars[0]) || !bars.some((b) => b.number === section.bars[1])) {
      throw new Error(`Invalid section: ${section.name}`)
    }
  }
  return { ...spec, bars, events: events.sort((a, b) => a.start - b.start), soundNotes: soundNotes.sort((a, b) => a.start - b.start), start: bars[0].start, end: start }
}

export function sectionBounds(score: Score, range: [number, number]) {
  const first = score.bars.find((b) => b.number === range[0])
  const last = score.bars.find((b) => b.number === range[1])
  if (!first || !last || first.number > last.number) throw new Error('Invalid bar range')
  return { start: first.number === 1 && score.pickup ? score.start : first.start, end: last.start + last.beats }
}
