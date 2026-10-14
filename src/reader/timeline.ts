// The score as a timeline: what sounds when, where every measure pass starts, and where the cursor
// stops. Built from OpenSheetMusicDisplay's parsed model (no DOM). Its iterator follows repeats
// and voltas, so a repeated measure appears once per pass. Times are "score seconds": seconds at
// 100 % speed, with the score's tempo changes applied.
import type { Fraction, MusicSheet, MusicPartManagerIterator, Note, SourceStaffEntry, VoiceEntry } from 'opensheetmusicdisplay'
import { PIANO_HIGH, PIANO_LOW, midiFromHalfTone } from '../engine/notes'

/** a note to sound: tied notes are merged into one */
export interface Sound { midi: number; time: number; end: number; staff: number; velocity: number }
/** a printed note, lit on the sheet while it sounds */
export interface Mark { note: Note; entry: SourceStaffEntry; measure: number; staff: number; time: number; end: number }
/** one played pass through a measure */
export interface Pass { measure: number; number: number; time: number; end: number; bpm: number; beats: number; beatSeconds: number }
/** a cursor stop: the score position (whole notes from the start, as printed) at a time */
export interface Step { time: number; measure: number; pass: number; at: Fraction }
export interface Click { time: number; accent: boolean }
export interface StaffInfo { index: number; name: string }
export interface Timeline {
  sounds: Sound[]; marks: Mark[]; passes: Pass[]; steps: Step[]; clicks: Click[]; staves: StaffInfo[]
  end: number; bpm: number; low: number; high: number
}

const EPS = 1e-6
/** on-beat grace notes, in score seconds each */
const GRACE = 0.07
const VELOCITY = [78, 64]

const tempoAt = (it: MusicPartManagerIterator, fallback: number) => {
  const bpm = it.CurrentBpm || it.CurrentMeasure?.TempoInBPM
  return bpm && Number.isFinite(bpm) && bpm > 0 ? bpm : fallback
}
const wholeSeconds = (bpm: number) => 240 / bpm

/** the counted beat: dotted quarters in 6/8, 9/8, 12/8; otherwise the time signature's denominator */
function beatOf(numerator: number, denominator: number) {
  return denominator === 8 && numerator > 3 && numerator % 3 === 0 ? 3 / 8 : 1 / denominator
}

export function buildTimeline(sheet: MusicSheet, transpose = 0): Timeline {
  const sounds: Sound[] = []
  const marks: Mark[] = []
  const passes: Pass[] = []
  const steps: Step[] = []
  const start = sheet.HasBPMInfo ? sheet.DefaultStartTempoInBpm || 100 : 100
  const it = sheet.MusicPartManager.getIterator()
  let time = 0
  let bpm = tempoAt(it, start)
  let previous: { at: number; measureEnd: number } | null = null

  for (let guard = 0; !it.EndReached && guard < 1_000_000; guard++, it.moveToNext()) {
    const measure = it.CurrentMeasure
    if (!measure) continue
    const at = it.CurrentSourceTimestamp.RealValue
    const rel = it.CurrentRelativeInMeasureTimestamp.RealValue
    const index = it.CurrentMeasureIndex
    const last = passes.at(-1)
    // A new pass starts at a new measure, or when a repeat jumps back into the same one.
    const newPass = !last || last.measure !== index || (previous !== null && at <= previous.at + EPS)
    if (previous) time += (newPass ? previous.measureEnd - previous.at + rel : at - previous.at) * wholeSeconds(bpm)
    bpm = tempoAt(it, bpm)
    if (newPass) {
      const passStart = time - rel * wholeSeconds(bpm)
      if (last) last.end = passStart
      const sig = measure.ActiveTimeSignature
      const beat = sig ? beatOf(sig.Numerator, sig.Denominator) : 1 / 4
      passes.push({ measure: index, number: measure.MeasureNumber, time: passStart, bpm,
        end: passStart + measure.Duration.RealValue * wholeSeconds(bpm),
        beats: sig ? Math.max(1, Math.round(sig.RealValue / beat)) : 4, beatSeconds: beat * wholeSeconds(bpm) })
    }
    previous = { at, measureEnd: measure.AbsoluteTimestamp.RealValue + measure.Duration.RealValue }
    steps.push({ time, measure: index, pass: passes.length - 1, at: it.CurrentSourceTimestamp.clone() })
    addNotes(it.CurrentVoiceEntries, time, bpm, index, transpose, sounds, marks)
  }
  const end = sounds.reduce((max, s) => Math.max(max, s.end), passes.at(-1)?.end ?? 0)
  sounds.sort((a, b) => a.time - b.time || a.midi - b.midi)
  marks.sort((a, b) => a.time - b.time)
  const midis = sounds.map((s) => s.midi)
  return {
    sounds, marks, passes, steps, clicks: clicksFor(sheet, passes), staves: staffNames(sheet), end, bpm: passes[0]?.bpm ?? start,
    low: midis.length ? Math.min(...midis) : 60, high: midis.length ? Math.max(...midis) : 72,
  }
}

function addNotes(entries: VoiceEntry[], time: number, bpm: number, measure: number, transpose: number, sounds: Sound[], marks: Mark[]) {
  const seconds = wholeSeconds(bpm)
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
      const length = note.Length.RealValue * seconds
      const tie = note.NoteTie
      const continuation = !!tie && tie.StartNote !== note
      const graceEnd = entry.IsGrace ? time + offset + GRACE : 0
      const markEnd = entry.IsGrace ? graceEnd : time + length
      marks.push({ note, entry: entry.ParentSourceStaffEntry, measure, staff, time: entry.IsGrace ? time + offset : time, end: markEnd })
      if (continuation) continue
      // note.halfTone already follows the sheet's transposition while it is drawn; use the written pitch.
      const midi = midiFromHalfTone(note.Pitch.getHalfTone()) + transpose
      if (midi < PIANO_LOW || midi > PIANO_HIGH) continue
      const total = tie ? tie.Notes.reduce((sum, n) => sum + n.Length.RealValue, 0) * seconds : length
      const velocity = VELOCITY[Math.min(staff, 1)]
      if (entry.IsGrace) sounds.push({ midi, time: time + offset, end: graceEnd, staff, velocity })
      else {
        const shift = Math.min(offset, total / 2)
        sounds.push({ midi, time: time + shift, end: time + total, staff, velocity })
      }
    }
  }
}

function clicksFor(sheet: MusicSheet, passes: Pass[]): Click[] {
  const clicks: Click[] = []
  for (const pass of passes) {
    const measure = sheet.SourceMeasures[pass.measure]
    const full = measure.ActiveTimeSignature?.RealValue ?? measure.Duration.RealValue
    const length = (pass.end - pass.time) / pass.beatSeconds
    // A pickup bar counts its beats back from the bar line, so they line up with the full bars.
    const short = measure.Duration.RealValue < full - EPS
    const first = short ? length - Math.floor(length + EPS) : 0
    for (let beat = first; beat < length - EPS; beat++) {
      clicks.push({ time: pass.time + beat * pass.beatSeconds, accent: !short && beat === 0 })
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
