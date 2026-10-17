// The score as a timeline: what sounds when, where every measure pass starts, and where the cursor
// stops. Built from OpenSheetMusicDisplay's parsed model (no DOM). Its iterator follows repeats
// and voltas, so a repeated measure appears once per pass. Times are "score seconds": seconds at
// 100 % speed, with the score's tempo changes applied.
//
// It is built in two steps. First everything is placed by its played position: whole notes from
// the start in playing order (a repeated bar adds its length again). Then a clock turns positions
// into score seconds, so every note, step, pass and click follows the same tempo.
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
const VELOCITY = [78, 64]

/** Positions are played whole notes. `delay` is in score seconds after the position (grace notes). */
interface RawSound { midi: number; staff: number; at: number; until: number; delay: number; grace: boolean }
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
  /** `rateAt(p)` = seconds per whole note just after `p`; it must be constant between breakpoints */
  constructor(breakpoints: number[], rateAt: (p: number) => number) {
    const points = [...new Set(breakpoints)].sort((a, b) => a - b)
    let t = 0
    points.forEach((p, i) => {
      if (i > 0) t += (p - points[i - 1]) * this.rate[i - 1]
      this.at.push(p)
      this.time.push(t)
      this.rate.push(rateAt(p))
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
  const rawPasses: RawPass[] = []
  const rawSteps: RawStep[] = []
  const start = sheet.HasBPMInfo ? sheet.DefaultStartTempoInBpm || 100 : 100
  const it = sheet.MusicPartManager.getIterator()
  let at = 0
  let bpm = tempoAt(it, start)
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
    bpm = tempoAt(it, bpm)
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
    addNotes(it.CurrentVoiceEntries, at, index, transpose, raw, rawMarks)
  }

  // The tempo: each step's tempo holds until the next step.
  const stepAts = rawSteps.map((s) => s.at)
  const lastAt = raw.reduce((max, s) => Math.max(max, s.until), rawPasses.at(-1)?.until ?? 0)
  const clock = new Clock([0, ...stepAts, lastAt], (p) => {
    const i = lastAtOrBefore(stepAts, p)
    return wholeSeconds(rawSteps[Math.max(0, i)]?.bpm ?? start)
  })
  const seconds = (p: number) => clock.seconds(p)

  const sounds: Sound[] = raw.map((s) => {
    const from = seconds(s.at)
    const end = s.grace ? from + s.delay + GRACE : seconds(s.until)
    const time = s.grace ? from + s.delay : from + Math.min(s.delay, (end - from) / 2)
    return { midi: s.midi, time, end, release: end, staff: s.staff, velocity: VELOCITY[Math.min(s.staff, 1)] }
  })
  const marks: Mark[] = rawMarks.map((m) => {
    const time = seconds(m.at) + m.delay
    return { note: m.note, entry: m.entry, measure: m.measure, staff: m.staff, time, end: m.grace ? time + GRACE : seconds(m.until) }
  })
  const passes: Pass[] = rawPasses.map((p) => ({ measure: p.measure, number: p.number, time: seconds(p.at), end: seconds(p.until),
    bpm: p.bpm, beats: p.beats, beatSeconds: p.beat * wholeSeconds(p.bpm) }))
  const steps: Step[] = rawSteps.map((s) => ({ time: seconds(s.at), measure: s.measure, pass: s.pass, at: s.printed }))
  const end = sounds.reduce((max, s) => Math.max(max, s.end), passes.at(-1)?.end ?? 0)
  const pedals = pedalsFor(sheet, rawPasses, lastAt).map(([from, to]) => ({ time: seconds(from), end: Math.min(end, seconds(to)) }))
  sounds.sort((a, b) => a.time - b.time || a.midi - b.midi)
  marks.sort((a, b) => a.time - b.time)
  setReleases(sounds, pedals)
  const midis = sounds.map((s) => s.midi)
  return {
    sounds, marks, passes, steps, pedals, clicks: clicksFor(sheet, rawPasses, seconds), staves: staffNames(sheet), end, bpm: passes[0]?.bpm ?? start,
    low: midis.length ? Math.min(...midis) : 60, high: midis.length ? Math.max(...midis) : 72,
  }
}

function addNotes(entries: VoiceEntry[], at: number, measure: number, transpose: number, sounds: RawSound[], marks: RawMark[]) {
  // Grace notes are played on the beat, quickly; their main note starts after them.
  const graces = new Map<unknown, number>()
  for (const entry of entries) {
    const staff = entry.ParentSourceStaffEntry.ParentStaff.idInMusicSheet
    const voice = entry.ParentVoice
    let offset = 0
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
      if (grace) sounds.push({ midi, staff, at, until: at, delay: offset, grace })
      else sounds.push({ midi, staff, at, until: at + total, delay: offset, grace })
    }
  }
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
