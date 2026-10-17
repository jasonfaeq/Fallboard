// Plays a Timeline on the sampled piano. The transport runs in score seconds (tempo 60, so one
// beat = one second at 100 %), and every note and click is scheduled ahead on the audio clock;
// the timer below only wakes the scheduler (D-06).
import type { Engine } from '../engine/audio'
import { indexAt, passAt, type Timeline } from './timeline'

export type PlayState = 'stopped' | 'countIn' | 'playing' | 'paused'
export interface Loop { start: number; end: number }

const LOOKAHEAD = 0.12
const RING = 0.6

export class Player {
  state: PlayState = 'stopped'
  timeline: Timeline | null = null
  speed = 1
  metronome = false
  countIn = false
  loop: Loop | null = null
  /** each staff's volume, 0–1; a staff not listed plays at 1 */
  volumes = new Map<number, number>()
  /** the staves at volume 0 */
  muted: ReadonlySet<number> = new Set()
  error = ''
  onChange: () => void = () => {}
  /** the loop came round again; `repeats` counts the times since the loop was set or play began */
  onLoop: (repeats: number) => void = () => {}
  repeats = 0
  private position = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private soundCursor = 0
  private clickCursor = 0
  private countClicks: { beat: number; accent: boolean }[] = []
  private countCursor = 0
  private from = 0
  private request = 0

  constructor(readonly engine: Engine) {}

  get playing() { return this.state === 'playing' || this.state === 'countIn' }
  get end() { return this.timeline?.end ?? 0 }
  /** the position the listener hears now (output latency compensated), in score seconds */
  get time() {
    if (!this.playing) return this.position
    const context = this.engine.context!
    const heard = this.engine.transport.beatAt(Math.max(0, context.currentTime - this.engine.latency))
    return Math.min(this.end, Math.max(this.from, heard))
  }
  /** count-in beats still to come, for the status line */
  get countRemaining() {
    if (this.state !== 'countIn') return 0
    return Math.max(1, Math.ceil((this.from - this.engine.transport.beatAt()) / this.beatSecondsAt(this.from) - 1e-6))
  }

  load(timeline: Timeline | null, keepPosition = false) {
    const at = keepPosition ? this.time : 0
    this.halt()
    this.timeline = timeline
    this.loop = null
    this.state = 'stopped'
    this.position = Math.min(at, this.end)
    this.onChange()
  }

  async play() {
    const timeline = this.timeline
    if (!timeline || this.playing) return
    this.error = ''
    const request = ++this.request
    await this.engine.start()
    if (request !== this.request) return
    if (!this.engine.running) {
      this.error = this.engine.error || 'The browser did not allow sound. Click Play again.'
      this.onChange()
      return
    }
    const { loop } = this
    if (this.position >= this.end - 1e-3) this.position = loop?.start ?? 0
    if (loop && (this.position < loop.start - 1e-3 || this.position >= loop.end - 1e-3)) this.position = loop.start
    this.from = this.position
    this.repeats = 0
    this.countClicks = []
    if (this.countIn) {
      const pass = timeline.passes[passAt(timeline, this.from)]
      const beats = pass?.beats ?? 4
      const length = this.beatSecondsAt(this.from)
      for (let i = beats; i >= 1; i--) this.countClicks.push({ beat: this.from - i * length, accent: i === beats })
    }
    const transport = this.engine.transport
    transport.setTempo(60)
    transport.setRate(this.speed)
    transport.seek(this.countClicks[0]?.beat ?? this.from)
    transport.resume(this.engine.context!.currentTime + 0.05)
    this.countCursor = 0
    this.cue(this.from)
    this.state = this.countClicks.length ? 'countIn' : 'playing'
    this.timer = setInterval(() => this.update(), 20)
    this.update()
    this.onChange()
  }

  pause() {
    if (!this.playing) return
    this.position = this.state === 'countIn' ? this.from : Math.min(this.end, this.engine.transport.beatAt())
    this.halt()
    this.state = 'paused'
    this.onChange()
  }
  toggle() { if (this.playing) this.pause(); else void this.play() }
  /** stop and go back to the start (of the loop, if there is one) */
  stop() {
    this.halt()
    this.state = 'stopped'
    this.position = this.loop?.start ?? 0
    this.onChange()
  }
  seek(time: number) {
    const to = Math.max(0, Math.min(this.end, time))
    if (this.state === 'countIn') {
      // count in again from the new place
      this.halt()
      this.state = 'paused'
      this.position = to
      void this.play()
      return
    }
    this.position = to
    if (this.playing) {
      this.engine.piano?.allNotesOff('score')
      this.engine.transport.seek(to)
      this.from = to
      this.cue(to)
    } else if (this.state === 'stopped') this.state = 'paused'
    this.onChange()
  }
  setSpeed(speed: number) {
    this.speed = Math.max(0.25, Math.min(2, Math.round(speed * 100) / 100))
    if (this.playing) {
      this.engine.transport.setRate(this.speed)
      this.engine.piano?.allNotesOff('score')
      this.cue(this.engine.transport.beatAt())
    }
    this.onChange()
  }
  setLoop(loop: Loop | null) {
    this.loop = loop && loop.end > loop.start ? loop : null
    this.repeats = 0
    if (this.loop && this.playing) {
      const now = this.engine.transport.beatAt()
      if (now < this.loop.start || now >= this.loop.end) this.seek(this.loop.start)
    }
    this.onChange()
  }
  volumeOf(staff: number) { return this.volumes.get(staff) ?? 1 }
  /** Set the staves' volumes at once, as remembered for a score. */
  setVolumes(volumes: Record<number, number>) {
    this.volumes = new Map(Object.entries(volumes).map(([staff, v]) => [Number(staff), Math.max(0, Math.min(1, v))]))
    this.muted = new Set([...this.volumes].filter(([, v]) => v === 0).map(([staff]) => staff))
    this.onChange()
  }
  setVolume(staff: number, volume: number) {
    const before = this.volumeOf(staff)
    this.setVolumes({ ...Object.fromEntries(this.volumes), [staff]: Math.round(volume * 100) / 100 })
    // Muting or unmuting takes effect at once; a new level applies from the next note.
    if (this.playing && (before === 0) !== (this.volumeOf(staff) === 0)) {
      this.engine.piano?.allNotesOff('score')
      this.cue(this.engine.transport.beatAt())
    }
  }

  /** Sound the notes and clicks due in the next few milliseconds. */
  update() {
    const timeline = this.timeline
    const context = this.engine.context
    if (!this.playing || !timeline || !context) return
    if (context.state !== 'running') { this.pause(); return }
    const transport = this.engine.transport
    const piano = this.engine.piano!
    const now = context.currentTime
    const horizon = now + LOOKAHEAD
    let beat = transport.beatAt(now)
    if (this.state === 'countIn' && beat >= this.from) { this.state = 'playing'; this.onChange() }
    const stopAt = this.loop?.end ?? this.end
    if (this.loop && beat >= this.loop.end) {
      // Jump back to the loop start; anything still ringing past the loop end is cut.
      piano.allNotesOff('score')
      transport.seek(this.loop.start + (beat - this.loop.end))
      beat = transport.beatAt(now)
      this.from = this.loop.start
      this.cue(beat)
      this.onLoop(++this.repeats)
      this.onChange()
    }
    while (this.countCursor < this.countClicks.length) {
      const click = this.countClicks[this.countCursor]
      const at = transport.timeAtBeat(click.beat)!
      if (at > horizon) break
      if (at >= now - 0.02) this.engine.click(Math.max(now, at), click.accent)
      this.countCursor++
    }
    const { sounds, clicks } = timeline
    while (this.soundCursor < sounds.length) {
      const sound = sounds[this.soundCursor]
      if (sound.time >= stopAt) break
      const at = transport.timeAtBeat(sound.time)!
      if (at > horizon) break
      this.soundCursor++
      const volume = this.volumeOf(sound.staff)
      if (volume <= 0) continue
      // The damper falls at the release: later than the end while the pedal is down.
      const off = transport.timeAtBeat(Math.min(sound.release, stopAt))!
      if (off <= now) continue
      piano.noteOn(sound.midi, sound.velocity, 'score', Math.max(now, at), volume)
      piano.noteOff(sound.midi, 'score', off)
    }
    while (this.clickCursor < clicks.length) {
      const click = clicks[this.clickCursor]
      if (click.time >= stopAt - 1e-6) break
      const at = transport.timeAtBeat(click.time)!
      if (at > horizon) break
      this.clickCursor++
      if (this.metronome && at >= now - 0.02) this.engine.click(Math.max(now, at), click.accent)
    }
    if (!this.loop && beat >= this.end + RING) {
      this.halt()
      this.state = 'stopped'
      this.position = 0
      this.onChange()
    }
  }

  dispose() { this.halt() }

  private beatSecondsAt(time: number) {
    const timeline = this.timeline
    const pass = timeline?.passes[passAt(timeline, time)]
    return pass?.beatSeconds ?? 1
  }
  /** Point the schedulers at `beat`: notes still sounding there restart, later ones wait their turn. */
  private cue(beat: number) {
    const timeline = this.timeline!
    this.soundCursor = timeline.sounds.findIndex((s) => s.end > beat + 1e-3)
    if (this.soundCursor < 0) this.soundCursor = timeline.sounds.length
    this.clickCursor = indexAt(timeline.clicks, beat - 1e-3) + 1
  }
  private halt() {
    this.request++
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.engine.transport.pause()
    this.engine.piano?.allNotesOff('score')
  }
}
