// Unified input: any MIDI keyboard over Web MIDI, plus a computer-keyboard fallback.
// All MIDI numbers live in this file (KEYBOARD.md); the rest of the game sees NoteEvents.

/** where an input came from; 'bot' = a scripted player (same path as the keyboard) */
export type InputSource = 'midi' | 'key' | 'bot'

/** `t` is on the performance.now() clock, as the device reported it */
export type NoteEvent =
  | { type: 'on'; note: number; velocity: number; t: number; src: InputSource }
  | { type: 'off'; note: number; t: number; src: InputSource }
  | { type: 'pedal'; down: boolean; value: number; t: number; src: InputSource }

const NOTE_OFF = 0x80
const NOTE_ON = 0x90
const CONTROL_CHANGE = 0xb0
const CC_SUSTAIN = 64
const PEDAL_DOWN_FROM = 64
const MAX_VALUE = 127

export const MIDDLE_C = 60
/** an 88-key piano: A0–C8 */
export const PIANO_LOW = 21
export const PIANO_HIGH = 108

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
export const noteName = (note: number) => `${NAMES[note % 12]}${Math.floor(note / 12) - 1}`
export const isBlackKey = (note: number) => NAMES[note % 12].length > 1

export interface MidiLogEntry {
  bytes: number[]
  label: string
  t: number
}

/** what the keyboard has shown so far — the facts Jason checks on the MIDI monitor */
export interface InputStats {
  lowNote: number | null
  highNote: number | null
  minVelocity: number | null
  maxVelocity: number | null
  /** how the keyboard says "key up" */
  keyUp: 'note off' | 'note on, velocity 0' | null
  /** every distinct sustain value seen: two values = an on/off pedal */
  pedalValues: number[]
}

const emptyStats = (): InputStats => ({
  lowNote: null, highNote: null, minVelocity: null, maxVelocity: null, keyUp: null, pedalValues: [],
})

const LOG_LENGTH = 40
const KEY_VELOCITY = 80

// A S D F G H J K = the white keys C4–C5 · W E T Y U = the black keys between them
const KEY_OFFSETS: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12,
}

export class Input {
  listeners = new Set<(e: NoteEvent) => void>()
  log: MidiLogEntry[] = []
  stats = emptyStats()
  midiStatus: 'unsupported' | 'pending' | 'denied' | 'ready' = 'pending'
  devices: string[] = []
  /** keys that are down now, with their velocity */
  held = new Map<number, number>()
  pedalDown = false
  onChange: () => void = () => {}

  private access: MIDIAccess | null = null
  private octaveShift = 0

  on(fn: (e: NoteEvent) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Every input goes through here: MIDI, the computer keyboard and bots. */
  send(e: NoteEvent) {
    if (e.type === 'on') this.held.set(e.note, e.velocity)
    else if (e.type === 'off') this.held.delete(e.note)
    else this.pedalDown = e.down
    for (const l of this.listeners) l(e)
    this.onChange()
  }

  clearMonitor() {
    this.log = []
    this.stats = emptyStats()
    this.onChange()
  }

  // ---------------- MIDI ----------------
  async initMidi() {
    if (!('requestMIDIAccess' in navigator)) {
      this.midiStatus = 'unsupported'
      this.onChange()
      return
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false })
      this.midiStatus = 'ready'
      this.access.onstatechange = () => this.attachInputs()
      this.attachInputs()
    } catch {
      this.midiStatus = 'denied'
    }
    this.onChange()
  }

  private attachInputs() {
    if (!this.access) return
    this.devices = []
    this.access.inputs.forEach((inp) => {
      if (inp.state !== 'connected') return
      this.devices.push(inp.name ?? 'MIDI device')
      inp.onmidimessage = (ev) => {
        if (ev.data) this.handleBytes(Array.from(ev.data), ev.timeStamp || performance.now())
      }
    })
    this.onChange()
  }

  /** One raw MIDI message. Every channel is accepted; clock and active sensing are dropped. */
  handleBytes(bytes: number[], t: number) {
    if (bytes.length < 3) return
    const [status, d1, d2] = bytes
    const type = status & 0xf0
    const s = this.stats
    if (type === NOTE_ON && d2 > 0) {
      s.lowNote = Math.min(s.lowNote ?? d1, d1)
      s.highNote = Math.max(s.highNote ?? d1, d1)
      s.minVelocity = Math.min(s.minVelocity ?? d2, d2)
      s.maxVelocity = Math.max(s.maxVelocity ?? d2, d2)
      this.addLog(bytes, `${noteName(d1)} down, velocity ${d2}`, t)
      this.send({ type: 'on', note: d1, velocity: d2, t, src: 'midi' })
    } else if (type === NOTE_OFF || type === NOTE_ON) {
      s.keyUp = type === NOTE_OFF ? 'note off' : 'note on, velocity 0'
      this.addLog(bytes, `${noteName(d1)} up`, t)
      this.send({ type: 'off', note: d1, t, src: 'midi' })
    } else if (type === CONTROL_CHANGE && d1 === CC_SUSTAIN) {
      if (!s.pedalValues.includes(d2)) s.pedalValues = [...s.pedalValues, d2].sort((a, b) => a - b)
      const down = d2 >= PEDAL_DOWN_FROM
      this.addLog(bytes, `Sustain pedal ${down ? 'down' : 'up'} (${d2})`, t)
      this.send({ type: 'pedal', down, value: d2 / MAX_VALUE, t, src: 'midi' })
    } else if (type === CONTROL_CHANGE) {
      this.addLog(bytes, `Controller ${d1} = ${d2} (not used)`, t)
      this.onChange()
    }
  }

  private addLog(bytes: number[], label: string, t: number) {
    this.log.unshift({ bytes, label, t })
    if (this.log.length > LOG_LENGTH) this.log.length = LOG_LENGTH
  }

  // ---------------- Computer-keyboard fallback ----------------
  /** Z / X = octave down / up · Space = sustain pedal. Fixed velocity. */
  attachKeyboard(target: Window) {
    const sounding = new Map<string, number>() // key → the note it started, so an octave shift can't strand it
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'BUTTON' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      const t = e.timeStamp || performance.now()
      if (key in KEY_OFFSETS) {
        const note = MIDDLE_C + this.octaveShift * 12 + KEY_OFFSETS[key]
        sounding.set(key, note)
        this.send({ type: 'on', note, velocity: KEY_VELOCITY, t, src: 'key' })
      } else if (key === 'z') this.octaveShift = Math.max(-3, this.octaveShift - 1)
      else if (key === 'x') this.octaveShift = Math.min(3, this.octaveShift + 1)
      else if (key === ' ') {
        e.preventDefault()
        this.send({ type: 'pedal', down: true, value: 1, t, src: 'key' })
      }
    }
    const up = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const t = e.timeStamp || performance.now()
      const note = sounding.get(key)
      if (note !== undefined) {
        sounding.delete(key)
        this.send({ type: 'off', note, t, src: 'key' })
      } else if (key === ' ' && this.pedalDown) this.send({ type: 'pedal', down: false, value: 0, t, src: 'key' })
    }
    target.addEventListener('keydown', down)
    target.addEventListener('keyup', up)
    return () => {
      target.removeEventListener('keydown', down)
      target.removeEventListener('keyup', up)
    }
  }
}
