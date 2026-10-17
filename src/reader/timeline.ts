// The score as a timeline: what sounds when, where every measure pass starts, and where the cursor
// stops. Built from OpenSheetMusicDisplay's parsed model (no DOM). Its iterator follows repeats
// and voltas, so a repeated measure appears once per pass. Times are "score seconds": seconds at
// 100 % speed, with the score's tempo changes applied.
//
// It is built in two steps. First everything is placed by its played position: whole notes from
// the start in playing order (a repeated bar adds its length again). Then a clock turns positions
// into score seconds, so every note, step, pass and click follows the same tempo, including
// fermatas and ritardandos.
import { AccidentalEnum, ArticulationEnum, KeyInstruction, OrnamentEnum, Pitch } from 'opensheetmusicdisplay'
import type { Fraction, MusicSheet, MusicPartManagerIterator, Note, SourceStaffEntry, VoiceEntry } from 'opensheetmusicdisplay'
import { PIANO_HIGH, PIANO_LOW, midiFromHalfTone } from '../engine/notes'

/** a note to sound: tied notes are merged into one. `release` is when its damper falls: the end,
 *  or later while the sustain pedal is down. */
export interface Sound { midi: number; time: number; end: number; release: number; staff: number; velocity: number }
/** a printed note, lit on the sheet while it sounds */
export interface Mark { note: Note; entry: SourceStaffEntry; measure: number; staff: number; time: number; end: number }
/** one played pass through a measure */
export interface Pass { measure: number; number: number; time: number; end: number; bpm: number; beats: number; beatSeconds: number }
/** a cursor stop: the score position (whole notes from the start, as printed) at a time */
export interface Step { time: number; measure: number; pass: number; at: Fraction }
export interface Click { time: number; accent: boolean }
export interface StaffInfo { index: number; name: string }
/** the sustain pedal is down from `time` to `end` */
export interface Pedal { time: number; end: number }
export interface Timeline {
  sounds: Sound[]; marks: Mark[]; passes: Pass[]; steps: Step[]; clicks: Click[]; staves: StaffInfo[]; pedals: Pedal[]
  end: number; bpm: number; low: number; high: number
}

const EPS = 1e-6
/** on-beat grace notes, in score seconds each */
const GRACE = 0.07
/** Loudness for each dynamic mark, as note velocity (1–127). Music without marks plays at mf. */
const LEVELS: Record<string, number> = {
  pppppp: 12, ppppp: 18, pppp: 24, ppp: 32, pp: 42, p: 54, mp: 66, mf: 78, f: 92, ff: 106, fff: 118, ffff: 124, fffff: 127, ffffff: 127,
}
/** sudden accents: how much louder the notes at the mark play; the level carries on as before */
const SUDDEN: Record<string, number> = { sf: 1.3, sfz: 1.3, sffz: 1.4, fz: 1.3, rf: 1.2, rfz: 1.2 }
/** loud, then soft at once: the notes at the mark play forte, then this level holds */
const FORTE_PIANO: Record<string, string> = { fp: 'p', sfp: 'p', sfpp: 'pp' }
/** A fermata doubles the held part of its note (from the last step before its end), adding at
 *  most this many score seconds. */
const FERMATA_MAX = 1.5
/** rit./rall. slow to this share of the tempo by the next tempo mark; accel. speeds up to the other */
const RIT = 0.7
const ACCEL = 1.3
const SLOWER = /(^|[^a-z])(rit|rall|allarg|slent|calando)/i
const FASTER = /(^|[^a-z])(accel|string)/i
const RESUME = /(^|[^a-z])(a tempo|tempo (i|1|primo)|in tempo)([^a-z]|$)/i
/** each note of a trill, turn or mordent, in score seconds (shorter if the note is short) */
const ORNAMENT_NOTE = 0.09
/** C D E F G A B as OSMD's NoteEnum values */
const LETTERS = [0, 2, 4, 5, 7, 9, 11]
/** a hairpin with no mark after it changes the loudness by this much */
const HAIRPIN_STEP = 14
/** the lower staves play a little softer than the top one, as before dynamics were read */
const BALANCE = [1, 64 / 78]

type MultiExpression = MusicSheet['SourceMeasures'][number]['StaffLinkedExpressions'][number][number]
/** OSMD's ContDynamicEnum (not exported): crescendo = 0, diminuendo = 1 */
const CRESCENDO = 0

/** Positions are played whole notes. `delay` is in score seconds after the position (grace notes). */
interface RawSound { midi: number; staff: number; at: number; until: number; delay: number; grace: boolean; accent: number; ornament?: Ornament }
/** a trill, turn or mordent on a note, with its neighbours in the key */
interface Ornament { kind: OrnamentEnum; upper: number; lower: number }
/** what the voice entries add: sounds, lit notes, fermatas (played positions); the key signatures they need */
interface Collect { sounds: RawSound[]; marks: RawMark[]; fermatas: { at: number; until: number }[]; keys: number[][] }
/** a dynamic mark in playing order: a level, a sudden accent, or a hairpin */
interface Dynamic { at: number; staff: number; level?: number; sudden?: number; after?: number; hairpin?: { louder: boolean; until: number } }
interface RawMark { note: Note; entry: SourceStaffEntry; measure: number; staff: number; at: number; until: number; delay: number; grace: boolean }
interface RawStep { at: number; bpm: number; measure: number; pass: number; printed: Fraction }
interface RawPass { measure: number; number: number; at: number; until: number; bpm: number; beats: number; beat: number }

const tempoAt = (it: MusicPartManagerIterator, fallback: number) => {
  const bpm = it.CurrentBpm || it.CurrentMeasure?.TempoInBPM
  return bpm && Number.isFinite(bpm) && bpm > 0 ? bpm : fallback
}
const wholeSeconds = (bpm: number) => 240 / bpm

/** the counted beat: dotted quarters in 6/8, 9/8, 12/8; otherwise the time signature's denominator */
function beatOf(numerator: number, denominator: number) {
  return denominator === 8 && numerator > 3 && numerator % 3 === 0 ? 3 / 8 : 1 / denominator
}

/** Played position → score seconds: piecewise linear between knots. */
class Clock {
  private at: number[] = []
  private time: number[] = []
  private rate: number[] = []
  /** `rateAt(p)` = seconds per whole note at `p`, taken in the middle of each piece between breakpoints */
  constructor(breakpoints: number[], rateAt: (p: number) => number) {
    const points = [...new Set(breakpoints)].sort((a, b) => a - b)
    let t = 0
    points.forEach((p, i) => {
      if (i > 0) t += (p - points[i - 1]) * this.rate[i - 1]
      this.at.push(p)
      this.time.push(t)
      this.rate.push(rateAt((p + (points[i + 1] ?? p + 1)) / 2))
    })
  }
  seconds(p: number) {
    const i = Math.max(0, lastAtOrBefore(this.at, p))
    return this.time[i] + (p - this.at[i]) * this.rate[i]
  }
}

/** index of the last value ≤ x in a sorted array (binary search); -1 if none */
function lastAtOrBefore(values: number[], x: number) {
  let lo = 0, hi = values.length - 1, found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (values[mid] <= x + EPS) { found = mid; lo = mid + 1 } else hi = mid - 1
  }
  return found
}

export function buildTimeline(sheet: MusicSheet, transpose = 0): Timeline {
  const raw: RawSound[] = []
  const rawMarks: RawMark[] = []
  const collect: Collect = { sounds: raw, marks: rawMarks, fermatas: [], keys: keySignatures(sheet) }
  const rawPasses: RawPass[] = []
  const rawSteps: RawStep[] = []
  const start = sheet.HasBPMInfo ? sheet.DefaultStartTempoInBpm || 100 : 100
  const it = sheet.MusicPartManager.getIterator()
  let at = 0
  let bpm = tempoAt(it, start)
  let reported = bpm
  let previous: { at: number; measureEnd: number } | null = null

  for (let guard = 0; !it.EndReached && guard < 1_000_000; guard++, it.moveToNext()) {
    const measure = it.CurrentMeasure
    if (!measure) continue
    const printed = it.CurrentSourceTimestamp.RealValue
    const rel = it.CurrentRelativeInMeasureTimestamp.RealValue
    const index = it.CurrentMeasureIndex
    const last = rawPasses.at(-1)
    // A new pass starts at a new measure, or when a repeat jumps back into the same one.
    const newPass = !last || last.measure !== index || (previous !== null && printed <= previous.at + EPS)
    if (previous) at += newPass ? previous.measureEnd - previous.at + rel : printed - previous.at
    // OSMD gives words like "accel." a made-up tempo of its own; those change gradually instead (D-29).
    const now = tempoAt(it, reported)
    if (now !== reported && !gradualWordAt(measure, rel)) bpm = now
    reported = now
    if (newPass) {
      const passStart = at - rel
      if (last) last.until = passStart
      const sig = measure.ActiveTimeSignature
      const beat = sig ? beatOf(sig.Numerator, sig.Denominator) : 1 / 4
      rawPasses.push({ measure: index, number: measure.MeasureNumber, at: passStart, until: passStart + measure.Duration.RealValue, bpm,
        beats: sig ? Math.max(1, Math.round(sig.RealValue / beat)) : 4, beat })
    }
    previous = { at: printed, measureEnd: measure.AbsoluteTimestamp.RealValue + measure.Duration.RealValue }
    rawSteps.push({ at, bpm, measure: index, pass: rawPasses.length - 1, printed: it.CurrentSourceTimestamp.clone() })
    addNotes(it.CurrentVoiceEntries, at, index, transpose, collect)
  }

  // The tempo: each step's tempo holds until the next step, shaped by rit./accel. and fermatas.
  const stepAts = rawSteps.map((s) => s.at)
  const lastAt = raw.reduce((max, s) => Math.max(max, s.until), rawPasses.at(-1)?.until ?? 0)
  const bpmAt = (p: number) => rawSteps[Math.max(0, lastAtOrBefore(stepAts, p))]?.bpm ?? start
  const shape = tempoShape(tempoMarksFor(sheet, rawPasses, rawSteps), lastAt)
  const holds = fermataHolds(collect.fermatas, stepAts, (p) => wholeSeconds(bpmAt(p)) / shape.factor(p))
  const clock = new Clock([0, ...stepAts, lastAt, ...shape.breakpoints, ...holds.flatMap((h) => [h.from, h.until])], (p) =>
    wholeSeconds(bpmAt(p)) / shape.factor(p) * holds.reduce((m, h) => p > h.from && p < h.until ? Math.max(m, h.stretch) : m, 1))
  const seconds = (p: number) => clock.seconds(p)

  const sounds: Sound[] = raw.map((s) => {
    const from = seconds(s.at)
    const end = s.grace ? from + s.delay + GRACE : seconds(s.until)
    const time = s.grace ? from + s.delay : from + Math.min(s.delay, (end - from) / 2)
    return { midi: s.midi, time, end, release: end, staff: s.staff, velocity: 0 }
  })
  setVelocities(sheet, raw, sounds, dynamicsFor(sheet, rawPasses))
  const played = sounds.flatMap((s, i) => raw[i].ornament ? ornamentNotes(s, raw[i].ornament!) : [s])
  const marks: Mark[] = rawMarks.map((m) => {
    const time = seconds(m.at) + m.delay
    return { note: m.note, entry: m.entry, measure: m.measure, staff: m.staff, time, end: m.grace ? time + GRACE : seconds(m.until) }
  })
  const passes: Pass[] = rawPasses.map((p) => ({ measure: p.measure, number: p.number, time: seconds(p.at), end: seconds(p.until),
    bpm: p.bpm, beats: p.beats, beatSeconds: p.beat * wholeSeconds(p.bpm) }))
  const steps: Step[] = rawSteps.map((s) => ({ time: seconds(s.at), measure: s.measure, pass: s.pass, at: s.printed }))
  const end = played.reduce((max, s) => Math.max(max, s.end), passes.at(-1)?.end ?? 0)
  const pedals = pedalsFor(sheet, rawPasses, lastAt).map(([from, to]) => ({ time: seconds(from), end: Math.min(end, seconds(to)) }))
  played.sort((a, b) => a.time - b.time || a.midi - b.midi)
  marks.sort((a, b) => a.time - b.time)
  setReleases(played, pedals)
  const midis = played.map((s) => s.midi)
  return {
    sounds: played, marks, passes, steps, pedals, clicks: clicksFor(sheet, rawPasses, seconds), staves: staffNames(sheet), end, bpm: passes[0]?.bpm ?? start,
    low: midis.length ? Math.min(...midis) : 60, high: midis.length ? Math.max(...midis) : 72,
  }
}

function addNotes(entries: VoiceEntry[], at: number, measure: number, transpose: number, { sounds, marks, fermatas, keys }: Collect) {
  // Grace notes are played on the beat, quickly; their main note starts after them.
  const graces = new Map<unknown, number>()
  for (const entry of entries) {
    const staff = entry.ParentSourceStaffEntry.ParentStaff.idInMusicSheet
    if (!entry.IsGrace && entry.Articulations.some((a) => a.articulationEnum === ArticulationEnum.fermata || a.articulationEnum === ArticulationEnum.invertedfermata)) {
      fermatas.push({ at, until: at + Math.max(0, ...entry.Notes.map((n) => n.Length.RealValue)) })
    }
    // An ornament on a chord is played on its top note.
    const ornament = entry.IsGrace ? undefined : entry.OrnamentContainer
    const top = ornament && entry.Notes.filter((n) => n.Pitch && !n.isRest()).reduce<Note | undefined>((a, n) => !a || n.Pitch.getHalfTone() > a.Pitch.getHalfTone() ? n : a, undefined)
    const voice = entry.ParentVoice
    let offset = 0
    let accent = 1
    for (const a of entry.Articulations) {
      if (a.articulationEnum === ArticulationEnum.accent) accent = Math.max(accent, 1.2)
      if (a.articulationEnum === ArticulationEnum.strongaccent || a.articulationEnum === ArticulationEnum.marcatoup
        || a.articulationEnum === ArticulationEnum.marcatodown) accent = Math.max(accent, 1.3)
    }
    if (entry.IsGrace) {
      offset = graces.get(voice) ?? 0
      graces.set(voice, offset + GRACE)
    } else offset = graces.get(voice) ?? 0
    for (const note of entry.Notes) {
      if (!note.Pitch || note.isRest() || note.IsCueNote) continue
      const length = note.Length.RealValue
      const tie = note.NoteTie
      const continuation = !!tie && tie.StartNote !== note
      const grace = entry.IsGrace
      marks.push({ note, entry: entry.ParentSourceStaffEntry, measure, staff, at, until: at + length, delay: grace ? offset : 0, grace })
      if (continuation) continue
      // note.halfTone already follows the sheet's transposition while it is drawn; use the written pitch.
      const midi = midiFromHalfTone(note.Pitch.getHalfTone()) + transpose
      if (midi < PIANO_LOW || midi > PIANO_HIGH) continue
      const total = tie ? tie.Notes.reduce((sum, n) => sum + n.Length.RealValue, 0) : length
      const fifths = keys[measure]?.[staff] ?? 0
      sounds.push({ midi, staff, at, until: grace ? at : at + total, delay: offset, grace, accent, ornament: ornament && note === top ? {
        kind: ornament.GetOrnament,
        upper: neighbour(note.Pitch, midi, 1, fifths, ornament.AccidentalAbove),
        lower: neighbour(note.Pitch, midi, -1, fifths, ornament.AccidentalBelow),
      } : undefined })
    }
  }
}

/** whether the last tempo mark at or before `rel` in this measure is a rit./accel. word, not a metronome mark */
function gradualWordAt(measure: MusicSheet['SourceMeasures'][number], rel: number) {
  const mark = measure.TempoExpressions.filter((t) => t.Timestamp.RealValue <= rel + EPS).at(-1)
  const label = [mark?.InstantaneousTempo?.Label, mark?.ContinuousTempo?.Label].join(' ')
  return !!mark && !mark.InstantaneousTempo?.isMetronomeMark && !RESUME.test(label) && (SLOWER.test(label) || FASTER.test(label))
}

/** The key signature (sharps > 0, flats < 0) of every measure and staff, as printed. */
function keySignatures(sheet: MusicSheet): number[][] {
  let current = sheet.Staves.map(() => 0)
  return sheet.SourceMeasures.map((measure) => {
    current = current.map((fifths, staff) => {
      const key = measure.FirstInstructionsStaffEntries[staff]?.Instructions.find((i) => i instanceof KeyInstruction)
      return key instanceof KeyInstruction ? key.Key : fifths
    })
    return current
  })
}

/** The note a step above or below in the key (or with the ornament's own accidental). */
function neighbour(pitch: Pitch, midi: number, step: 1 | -1, fifths: number, accidental: AccidentalEnum) {
  const letter = LETTERS.indexOf(pitch.FundamentalNote)
  const next = (letter + step + 7) % 7
  const distance = step > 0 ? (LETTERS[next] - LETTERS[letter] + 12) % 12 : -((LETTERS[letter] - LETTERS[next] + 12) % 12)
  const order = fifths > 0 ? [3, 0, 4, 1, 5, 2, 6] : [6, 2, 5, 1, 4, 0, 3] // F C G D A E B sharpened, B E A D G C F flattened
  const fromKey = order.slice(0, Math.abs(fifths)).includes(next) ? Math.sign(fifths) : 0
  const alter = accidental === AccidentalEnum.NONE ? fromKey : Pitch.HalfTonesFromAccidental(accidental)
  return midi - pitch.AccidentalHalfTones + distance + alter
}

/** A trill, turn or mordent as the notes it plays (D-29). Every note keeps the main note's velocity. */
function ornamentNotes(s: Sound, { kind, upper, lower }: Ornament): Sound[] {
  const length = s.end - s.time
  const main = s.midi
  /** notes of length `d` from `from` seconds into the note, the last one held to the end */
  const run = (midis: number[], d: number, from = 0) => midis.map((midi, i) => {
    const time = s.time + from + i * d
    const end = i === midis.length - 1 ? s.end : time + d
    return { ...s, midi, time, end, release: end }
  })
  switch (kind) {
    case OrnamentEnum.Trill: {
      const count = Math.max(3, Math.floor(length / ORNAMENT_NOTE)) | 1 // odd, so it ends on the main note
      return run(Array.from({ length: count }, (_, i) => i % 2 ? upper : main), length / count)
    }
    case OrnamentEnum.Turn: return run([upper, main, lower, main], Math.min(ORNAMENT_NOTE, length / 4))
    case OrnamentEnum.InvertedTurn: return run([lower, main, upper, main], Math.min(ORNAMENT_NOTE, length / 4))
    case OrnamentEnum.DelayedTurn: case OrnamentEnum.DelayedInvertedTurn: {
      const d = Math.min(ORNAMENT_NOTE, length / 5)
      const turn = kind === OrnamentEnum.DelayedTurn ? [upper, main, lower, main] : [lower, main, upper, main]
      return [{ ...s, end: s.end - 4 * d, release: s.end - 4 * d }, ...run(turn, d, length - 4 * d)]
    }
    case OrnamentEnum.Mordent: return run([main, lower, main], Math.min(ORNAMENT_NOTE, length / 3))
    case OrnamentEnum.InvertedMordent: return run([main, upper, main], Math.min(ORNAMENT_NOTE, length / 3))
    default: return [s]
  }
}

/** rit., accel. and a tempo marks in playing order. A new metronome tempo, and a jump back for a
 *  repeat, count as a tempo. */
function tempoMarksFor(sheet: MusicSheet, passes: RawPass[], steps: RawStep[]) {
  const marks: { at: number; change: 'slower' | 'faster' | 'resume' }[] = []
  const add = (at: number, text: string, resume = false) => {
    const change = resume || RESUME.test(text) ? 'resume' : SLOWER.test(text) ? 'slower' : FASTER.test(text) ? 'faster' : null
    if (change && !marks.some((m) => Math.abs(m.at - at) < EPS && m.change === change)) marks.push({ at, change })
  }
  passes.forEach((pass, i) => { if (i > 0 && pass.measure <= passes[i - 1].measure) add(pass.at, '', true) })
  for (const pass of passes) {
    const measure = sheet.SourceMeasures[pass.measure]
    for (const tempo of measure.TempoExpressions) {
      const at = pass.at + tempo.Timestamp.RealValue
      const text = [tempo.InstantaneousTempo?.Label, tempo.ContinuousTempo?.Label].join(' ')
      // A new tempo restores it, unless it is OSMD's guess for a rit./accel. word.
      const gradual = !tempo.InstantaneousTempo?.isMetronomeMark && (SLOWER.test(text) || FASTER.test(text))
      add(at, text, (tempo.InstantaneousTempo?.TempoInBpm ?? 0) > 0 && !gradual)
    }
    for (const list of measure.StaffLinkedExpressions) {
      for (const expression of list) {
        for (const words of [...expression.UnknownList, ...expression.MoodList]) add(pass.at + expression.Timestamp.RealValue, words.Label ?? '')
      }
    }
  }
  steps.forEach((s, i) => { if (i > 0 && s.bpm !== steps[i - 1].bpm) add(s.at, '', true) })
  return marks.sort((a, b) => a.at - b.at)
}

/** The tempo factor over played positions: rit. and accel. change it gradually until the next
 *  tempo mark (or the end), and a tempo puts it back to 1 (D-29). */
function tempoShape(marks: ReturnType<typeof tempoMarksFor>, lastAt: number) {
  const ramps: { from: number; until: number; start: number; end: number }[] = []
  let factor = 1
  marks.forEach((m, i) => {
    if (m.change === 'resume') { factor = 1; ramps.push({ from: m.at, until: m.at, start: 1, end: 1 }); return }
    const until = marks.slice(i + 1).find((x) => x.at > m.at + EPS)?.at ?? lastAt
    const end = factor * (m.change === 'slower' ? RIT : ACCEL)
    ramps.push({ from: m.at, until, start: factor, end })
    factor = end
  })
  const froms = ramps.map((r) => r.from)
  return {
    factor(p: number) {
      const r = ramps[lastAtOrBefore(froms, p)]
      if (!r) return 1
      return p >= r.until ? r.end : r.start + (r.end - r.start) * (p - r.from) / (r.until - r.from)
    },
    /** fine steps through each gradual change, so the clock follows the curve */
    breakpoints: ramps.flatMap((r) => {
      const pieces = Math.ceil((r.until - r.from) * 64)
      return Array.from({ length: pieces + 1 }, (_, i) => r.from + (r.until - r.from) * i / Math.max(1, pieces))
    }),
  }
}

/** Where each fermata holds, and by how much: the part of its note after the last step before
 *  the note ends lasts twice as long, but at most FERMATA_MAX seconds longer. */
function fermataHolds(fermatas: { at: number; until: number }[], stepAts: number[], rate: (p: number) => number) {
  const holds: { from: number; until: number; stretch: number }[] = []
  for (const f of fermatas) {
    if (f.until <= f.at + EPS) continue
    const from = Math.max(f.at, stepAts[lastAtOrBefore(stepAts, f.until - 2 * EPS)] ?? f.at)
    const seconds = (f.until - from) * rate((from + f.until) / 2)
    const stretch = 1 + Math.min(1, FERMATA_MAX / seconds)
    if (!holds.some((h) => Math.abs(h.from - from) < EPS && Math.abs(h.until - f.until) < EPS)) holds.push({ from, until: f.until, stretch })
  }
  return holds
}

/** Dynamic marks and hairpins in playing order. A hairpin ends where OSMD says, else at the next mark. */
function dynamicsFor(sheet: MusicSheet, passes: RawPass[]): Dynamic[] {
  const events: Dynamic[] = []
  const seen = new Map<MultiExpression, number[]>()
  const hairpins: { event: Dynamic; end: MultiExpression | undefined }[] = []
  for (const pass of passes) {
    sheet.SourceMeasures[pass.measure].StaffLinkedExpressions.forEach((list, staff) => {
      for (const expression of list) {
        const at = pass.at + expression.Timestamp.RealValue
        seen.set(expression, [...seen.get(expression) ?? [], at])
        const mark = expression.InstantaneousDynamic?.DynamicExpression ?? ''
        if (LEVELS[mark]) events.push({ at, staff, level: LEVELS[mark] })
        else if (SUDDEN[mark]) events.push({ at, staff, sudden: SUDDEN[mark] })
        else if (FORTE_PIANO[mark]) events.push({ at, staff, sudden: LEVELS.f, after: LEVELS[FORTE_PIANO[mark]] })
        const wedge = expression.StartingContinuousDynamic
        if (wedge) {
          const event = { at, staff, hairpin: { louder: wedge.DynamicType === CRESCENDO, until: NaN } }
          events.push(event)
          hairpins.push({ event, end: wedge.EndMultiExpression })
        }
      }
    })
  }
  for (const { event, end } of hairpins) {
    const until = (end && seen.get(end)?.find((at) => at > event.at + EPS)) ?? NaN
    event.hairpin!.until = until
  }
  return events.sort((a, b) => a.at - b.at || Number(!!a.hairpin) - Number(!!b.hairpin))
}

/** Each note's velocity from the dynamics of its instrument (D-28). A mark sets every staff of
 *  the instrument, unless a staff has its own mark at the same moment. A hairpin moves
 *  gradually to the mark that follows it (within a bar of its end), or one step if none does. */
function setVelocities(sheet: MusicSheet, raw: RawSound[], sounds: Sound[], events: Dynamic[]) {
  const forStaff = new Map<number, Dynamic[]>()
  const kind = (e: Dynamic) => e.hairpin ? 'hairpin' : 'level'
  for (const staff of sheet.Staves) {
    const own = new Set(staff.ParentInstrument.Staves.map((s) => s.idInMusicSheet))
    const id = staff.idInMusicSheet
    forStaff.set(id, events.filter((e) => own.has(e.staff) && (e.staff === id
      || !events.some((x) => x.staff === id && Math.abs(x.at - e.at) < EPS && kind(x) === kind(e)))))
  }
  raw.forEach((s, i) => {
    const list = forStaff.get(s.staff) ?? []
    let level = LEVELS.mf
    let sudden = 1
    let hairpin: { from: number; until: number; start: number; target: number } | null = null
    const settle = (at: number) => {
      if (!hairpin) return
      const t = Math.min(1, Math.max(0, (at - hairpin.from) / (hairpin.until - hairpin.from || 1)))
      level = hairpin.start + (hairpin.target - hairpin.start) * t
    }
    for (const e of list) {
      if (e.at > s.at + EPS) break
      settle(e.at)
      const now = Math.abs(e.at - s.at) < EPS
      if (e.level !== undefined) { level = e.level; hairpin = null }
      if (e.sudden !== undefined && now) sudden = e.after === undefined ? e.sudden : Math.max(level, e.sudden) / level
      if (e.after !== undefined && !now) { level = e.after; hairpin = null }
      if (e.hairpin) {
        const { louder, until } = e.hairpin
        const limit = (Number.isNaN(until) ? e.at : until) + 1
        const next = list.find((x) => x.at > e.at + EPS && x.at <= limit + EPS && x.level !== undefined)
        const fits = next && next.level !== level && next.level! > level === louder
        hairpin = {
          from: e.at, start: level,
          until: fits ? next.at : Number.isNaN(until) ? e.at + 1 : until,
          target: fits ? next.level! : Math.max(1, Math.min(127, level + (louder ? HAIRPIN_STEP : -HAIRPIN_STEP))),
        }
      }
    }
    settle(s.at)
    sounds[i].velocity = Math.max(1, Math.min(127, Math.round(level * BALANCE[Math.min(s.staff, 1)] * s.accent * sudden)))
  })
}

/** Sustain pedal marks in playing order, as [down, up] positions. A "change" lifts and presses
 *  again at the same moment; a pedal still down at the end lifts there. The pedal is the
 *  instrument's, so a mark on either staff holds every staff's notes. */
function pedalsFor(sheet: MusicSheet, passes: RawPass[], lastAt: number): [number, number][] {
  const events: { at: number; down: boolean }[] = []
  for (const pass of passes) {
    for (const list of sheet.SourceMeasures[pass.measure].StaffLinkedExpressions) {
      for (const expression of list) {
        const at = pass.at + expression.Timestamp.RealValue
        if (expression.PedalEnd) events.push({ at, down: false })
        if (expression.PedalStart) events.push({ at, down: true })
      }
    }
  }
  events.sort((a, b) => a.at - b.at || Number(a.down) - Number(b.down))
  const spans: [number, number][] = []
  let down: number | null = null
  for (const e of events) {
    if (down !== null && (!e.down || e.at > down + EPS)) {
      if (e.at > down + EPS) spans.push([down, e.at])
      down = null
    }
    if (e.down) down = e.at
  }
  if (down !== null && lastAt > down + EPS) spans.push([down, lastAt])
  return spans
}

/** A note whose key comes up while the pedal is down rings until the pedal lifts, or until the
 *  same key is struck again. Notes released as the pedal goes down are not caught (legato pedalling). */
function setReleases(sounds: Sound[], pedals: Pedal[]) {
  const starts = pedals.map((p) => p.time)
  const next = new Map<number, number>()
  for (let i = sounds.length - 1; i >= 0; i--) {
    const s = sounds[i]
    const pedal = pedals[lastAtOrBefore(starts, s.end - 2 * EPS)]
    if (pedal && s.end > pedal.time + EPS && s.end < pedal.end - EPS) s.release = Math.max(s.end, Math.min(pedal.end, next.get(s.midi) ?? Infinity))
    next.set(s.midi, s.time)
  }
}

function clicksFor(sheet: MusicSheet, passes: RawPass[], seconds: (p: number) => number): Click[] {
  const clicks: Click[] = []
  for (const pass of passes) {
    const measure = sheet.SourceMeasures[pass.measure]
    const full = measure.ActiveTimeSignature?.RealValue ?? measure.Duration.RealValue
    const length = (pass.until - pass.at) / pass.beat
    // A pickup bar counts its beats back from the bar line, so they line up with the full bars.
    const short = measure.Duration.RealValue < full - EPS
    const first = short ? length - Math.floor(length + EPS) : 0
    for (let beat = first; beat < length - EPS; beat++) {
      clicks.push({ time: seconds(pass.at + beat * pass.beat), accent: !short && beat === 0 })
    }
  }
  return clicks
}

function staffNames(sheet: MusicSheet): StaffInfo[] {
  const many = sheet.Instruments.length > 1
  return sheet.Staves.map((staff) => {
    const instrument = staff.ParentInstrument
    const own = instrument.Staves.indexOf(staff)
    const hand = instrument.Staves.length === 2 ? (own === 0 ? 'Right hand' : 'Left hand') : instrument.Staves.length > 2 ? `Staff ${own + 1}` : ''
    const name = [many || !hand ? instrument.Name || `Part ${sheet.Instruments.indexOf(instrument) + 1}` : '', hand].filter(Boolean).join(' · ')
    return { index: staff.idInMusicSheet, name }
  })
}

/** the last item whose time is at or before `time` (binary search); -1 before the first */
export function indexAt<T extends { time: number }>(items: T[], time: number) {
  let lo = 0, hi = items.length - 1, found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (items[mid].time <= time + EPS) { found = mid; lo = mid + 1 } else hi = mid - 1
  }
  return found
}

export const passAt = (timeline: Timeline, time: number) => Math.max(0, indexAt(timeline.passes, time))
