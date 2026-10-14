// Note numbers and names. All MIDI note numbers live in this file (the Web MIDI input that
// used to share it is parked in parked/midi-trainer).

export const MIDDLE_C = 60
/** an 88-key piano: A0–C8 */
export const PIANO_LOW = 21
export const PIANO_HIGH = 108
export const MAX_VELOCITY = 127

/** OpenSheetMusicDisplay counts half tones from C0; MIDI counts from C-1. */
export const midiFromHalfTone = (halfTone: number) => halfTone + 12

/** Sample filenames use scientific pitch names; keep their MIDI conversion here. */
export function noteNumber(name: string) {
  const match = /^([A-G])(s|#{1,2}|b{1,2})?([0-8])$/.exec(name)
  if (!match) throw new Error(`Invalid pitch: ${name}`)
  const offsets: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  const acc = match[2] ?? ''
  return (Number(match[3]) + 1) * 12 + offsets[match[1]] + (acc.startsWith('b') ? -acc.length : acc === 's' ? 1 : acc.length)
}

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
export const noteName = (note: number) => `${NAMES[note % 12]}${Math.floor(note / 12) - 1}`
/** the letter name only, for labels on keys and falling notes */
export const pitchClass = (note: number) => NAMES[note % 12]
export const isBlackKey = (note: number) => NAMES[note % 12].length > 1
