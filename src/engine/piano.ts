/// <reference types="vite/client" />
import { MAX_VELOCITY, PIANO_HIGH, PIANO_LOW, noteNumber } from './notes'

/** who is playing: the score's playback, or a click on the on-screen keyboard */
export type Channel = 'score' | 'touch'

export const SAMPLE_NAMES = ['A0', ...Array.from({ length: 7 }, (_, i) =>
  ['C', 'Ds', 'Fs', 'A'].map((pitch) => `${pitch}${i + 1}`)).flat(), 'C8']

interface Voice {
  source: AudioBufferSourceNode
  gain: GainNode
  channel: Channel
  note: number
  released: boolean
}

/** One sampled layer, transposed at most two semitones; velocity controls loudness. */
export class Piano {
  private samples = new Map<number, AudioBuffer>()
  private held = new Map<string, Voice>()
  private voices = new Set<Voice>()
  private pedal = new Set<Channel>()
  private loading: Promise<void> | null = null
  ready = false

  constructor(private context: BaseAudioContext, private output: AudioNode) {}

  get activeVoices() { return this.voices.size }

  load() {
    if (this.ready) return Promise.resolve()
    if (this.loading) return this.loading
    this.loading = Promise.all(SAMPLE_NAMES.map(async (name) => {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/salamander/${name}.mp3`)
      if (!response.ok) throw new Error(`Piano sample ${name}: HTTP ${response.status}`)
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer())
      return [noteNumber(name), buffer] as const
    })).then((samples) => {
      this.samples = new Map(samples)
      this.ready = true
    }).finally(() => { this.loading = null })
    return this.loading
  }

  noteOn(note: number, velocity: number, channel: Channel, when = this.context.currentTime) {
    if (!this.ready || !Number.isInteger(note) || note < PIANO_LOW || note > PIANO_HIGH || velocity <= 0) return
    const key = `${channel}:${note}`
    const previous = this.held.get(key)
    if (previous) this.release(previous, when)
    // Bound work even when the pedal is held through many repeats.
    if (this.voices.size >= 96) this.stop(this.voices.values().next().value!)
    const pitch = [...this.samples.keys()].reduce((a, b) => Math.abs(b - note) < Math.abs(a - note) ? b : a)
    const source = this.context.createBufferSource()
    source.buffer = this.samples.get(pitch)!
    source.playbackRate.value = 2 ** ((note - pitch) / 12)
    const gain = this.context.createGain()
    gain.gain.value = 0.65 * (Math.min(velocity, MAX_VELOCITY) / MAX_VELOCITY) ** 1.5
    source.connect(gain).connect(this.output)
    const voice = { source, gain, channel, note, released: false }
    this.voices.add(voice)
    this.held.set(key, voice)
    source.onended = () => {
      this.voices.delete(voice)
      if (this.held.get(key) === voice) this.held.delete(key)
      source.disconnect()
      gain.disconnect()
    }
    source.start(Math.max(when, this.context.currentTime))
  }

  noteOff(note: number, channel: Channel, when = this.context.currentTime) {
    const key = `${channel}:${note}`
    const voice = this.held.get(key)
    this.held.delete(key)
    if (voice && !this.pedal.has(channel)) this.release(voice, when)
  }

  sustain(down: boolean, channel: Channel, when = this.context.currentTime) {
    if (down) this.pedal.add(channel)
    else {
      this.pedal.delete(channel)
      for (const voice of this.voices) {
        if (voice.channel === channel && this.held.get(`${channel}:${voice.note}`) !== voice) this.release(voice, when)
      }
    }
  }

  allNotesOff(channel?: Channel) {
    for (const voice of this.voices) if (!channel || voice.channel === channel) this.stop(voice)
    if (channel) {
      this.pedal.delete(channel)
      for (const key of this.held.keys()) if (key.startsWith(`${channel}:`)) this.held.delete(key)
    } else {
      this.pedal.clear()
      this.held.clear()
    }
  }

  private release(voice: Voice, when: number) {
    if (voice.released) return
    voice.released = true
    const t = Math.max(when, this.context.currentTime)
    voice.gain.gain.cancelAndHoldAtTime(t)
    voice.gain.gain.linearRampToValueAtTime(0, t + 0.35)
    voice.source.stop(t + 0.36)
  }

  private stop(voice: Voice) {
    voice.source.stop()
    this.voices.delete(voice)
    const key = `${voice.channel}:${voice.note}`
    if (this.held.get(key) === voice) this.held.delete(key)
  }
}
