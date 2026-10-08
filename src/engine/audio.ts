import { MIDDLE_C, type NoteEvent } from './input'
import { Piano } from './piano'

/** All positions are derived from this clock, never accumulated by frames or timers. */
export class Transport {
  private anchorBeat = 0
  private anchorTime = 0
  private bpm = 60
  private speed = 1
  private stopped = true
  revision = 0

  constructor(private now: () => number) {}
  get tempo() { return this.bpm }
  get rate() { return this.speed }
  get paused() { return this.stopped }
  beatAt(t = this.now()) {
    return this.anchorBeat + (this.stopped ? 0 : (t - this.anchorTime) * this.bpm * this.speed / 60)
  }
  timeAtBeat(beat: number): number | null {
    return this.stopped ? null : this.anchorTime + (beat - this.anchorBeat) * 60 / (this.bpm * this.speed)
  }
  setTempo(bpm: number) {
    if (!Number.isFinite(bpm) || bpm <= 0) throw new Error('Tempo must be positive')
    this.anchor()
    this.bpm = bpm
  }
  setRate(rate: number) {
    if (!Number.isFinite(rate) || rate < 0.5 || rate > 1) throw new Error('Practice rate must be 0.5–1')
    this.anchor()
    this.speed = rate
  }
  seek(beat: number) {
    if (!Number.isFinite(beat)) throw new Error('Beat must be finite')
    this.anchor()
    this.anchorBeat = beat
  }
  pause(beat?: number) {
    if (beat !== undefined) this.seek(beat)
    else this.anchor()
    this.stopped = true
  }
  resume(at?: number) {
    if (!this.stopped) return
    this.anchor()
    if (at !== undefined) {
      if (!Number.isFinite(at) || at < this.anchorTime) throw new Error('Resume time must be on or after the audio clock')
      this.anchorTime = at
    }
    this.stopped = false
  }
  private anchor() {
    const t = this.now()
    this.anchorBeat = this.beatAt(t)
    this.anchorTime = t
    this.revision++
  }
}

export class Engine {
  context: AudioContext | null = null
  piano: Piano | null = null
  output: GainNode | null = null
  transport = new Transport(() => this.context?.currentTime ?? 0)
  status: 'off' | 'loading' | 'ready' | 'error' = 'off'
  error = ''
  private ownSound = true
  private metronome = false
  private timer: ReturnType<typeof setInterval> | null = null
  private nextClick = 0
  private clickRevision = -1
  private clicks = new Map<OscillatorNode, number>()
  private starting: Promise<void> | null = null
  onChange: () => void = () => {}

  get keyboardOwnSound() { return this.ownSound }
  set keyboardOwnSound(value: boolean) {
    this.ownSound = value
    if (value) this.piano?.allNotesOff('midi')
    this.onChange()
  }
  get metronomeOn() { return this.metronome }
  get latency() { return (this.context?.baseLatency ?? 0) + (this.context?.outputLatency ?? 0) }

  /** Called by a user gesture, so normal browser autoplay protection is respected. */
  start() {
    if (this.starting) return this.starting
    this.starting = this.enable().finally(() => { this.starting = null })
    return this.starting
  }
  private async enable() {
    this.status = 'loading'
    this.error = ''
    this.onChange()
    try {
      if (!this.context) {
        this.context = new AudioContext({ latencyHint: 'interactive' })
        this.output = this.context.createGain()
        this.output.gain.value = 0.7
        const limiter = this.context.createDynamicsCompressor()
        limiter.threshold.value = -6
        limiter.knee.value = 0
        limiter.ratio.value = 20
        limiter.attack.value = 0.003
        limiter.release.value = 0.1
        this.output.connect(limiter).connect(this.context.destination)
        this.piano = new Piano(this.context, this.output)
        this.context.onstatechange = () => {
          if (this.context?.state !== 'running') this.panic()
          this.onChange()
        }
      }
      await this.context.resume()
      await this.piano!.load()
      this.status = 'ready'
    } catch (e) {
      this.status = 'error'
      this.error = e instanceof Error ? e.message : String(e)
    }
    this.onChange()
  }

  /** Convert the device's performance timestamp using a fresh paired clock reading. */
  audioTime(t: number) {
    return (this.context?.currentTime ?? 0) + (t - performance.now()) / 1000
  }
  heardBeat(t: number) { return this.transport.beatAt(this.audioTime(t) - this.latency) }

  onEvent(event: NoteEvent) {
    if (this.status !== 'ready' || this.context?.state !== 'running') return
    if (event.src === 'midi' && this.ownSound) return
    // Dispatch happens now: an old timestamp remains useful to scoring, but cannot play in the past.
    const when = Math.max(this.context.currentTime, this.audioTime(event.t))
    if (event.type === 'on') this.piano!.noteOn(event.note, event.velocity, event.src, when)
    else if (event.type === 'off') this.piano!.noteOff(event.note, event.src, when)
    else this.piano!.sustain(event.down, event.src, when)
  }

  setMetronome(enabled: boolean) {
    this.metronome = enabled && this.status === 'ready' && this.context?.state === 'running'
    this.cancelClicks()
    this.clickRevision = -1
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.metronome) {
      this.tick()
      // This timer only wakes the scheduler. The audio clock chooses every click time.
      this.timer = setInterval(() => this.tick(), 25)
    }
    this.onChange()
  }

  tick() {
    if (!this.metronome || !this.context) return
    const now = this.context.currentTime
    if (this.clickRevision !== this.transport.revision) {
      this.cancelClicks()
      this.nextClick = Math.ceil(this.transport.beatAt(now) - 1e-7)
      this.clickRevision = this.transport.revision
    }
    if (this.transport.paused) return
    this.nextClick = Math.max(this.nextClick, Math.ceil(this.transport.beatAt(now) - 1e-7))
    for (let count = 0; count < 32; count++) {
      const time = this.transport.timeAtBeat(this.nextClick)!
      if (time > now + 0.1) break
      this.click(Math.max(now, time), ((this.nextClick % 4) + 4) % 4 === 0)
      this.nextClick++
    }
  }
  private click(time: number, accent: boolean) {
    const context = this.context!
    const osc = context.createOscillator()
    const gain = context.createGain()
    osc.frequency.value = accent ? 1400 : 900
    gain.gain.setValueAtTime(0.12, time)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035)
    osc.connect(gain).connect(this.output!)
    this.clicks.set(osc, time)
    osc.onended = () => { this.clicks.delete(osc); osc.disconnect(); gain.disconnect() }
    osc.start(time)
    osc.stop(time + 0.04)
  }
  private cancelClicks() {
    for (const osc of this.clicks.keys()) osc.stop()
    this.clicks.clear()
  }
  /** A short audio-clock chord for checking the voice before a score exists. */
  demo() {
    if (this.status !== 'ready' || this.context?.state !== 'running') return
    const time = this.context.currentTime + 0.03
    for (const offset of [0, 4, 7]) {
      this.piano!.noteOn(MIDDLE_C + offset, 85, 'bot', time)
      this.piano!.noteOff(MIDDLE_C + offset, 'bot', time + 0.8)
    }
  }
  panic() {
    this.transport.pause()
    this.setMetronome(false)
    this.piano?.allNotesOff()
  }
  dispose() {
    this.panic()
    if (this.context) {
      this.context.onstatechange = null
      void this.context.close()
    }
  }
}
