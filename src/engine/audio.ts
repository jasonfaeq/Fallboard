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
    if (!Number.isFinite(rate) || rate < 0.25 || rate > 2) throw new Error('Playback rate must be 0.25–2')
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

/** AudioContext, master volume, limiter and the sampled piano. Scheduling lives in the reader's Player. */
export class Engine {
  context: AudioContext | null = null
  piano: Piano | null = null
  output: GainNode | null = null
  transport = new Transport(() => this.context?.currentTime ?? 0)
  status: 'off' | 'loading' | 'ready' | 'error' = 'off'
  error = ''
  private level = 0.7
  private starting: Promise<void> | null = null
  onChange: () => void = () => {}

  get latency() { return (this.context?.baseLatency ?? 0) + (this.context?.outputLatency ?? 0) }
  get running() { return this.status === 'ready' && this.context?.state === 'running' }
  get volume() { return this.level }
  set volume(value: number) {
    this.level = Math.max(0, Math.min(1, value))
    if (this.output && this.context) this.output.gain.setTargetAtTime(this.level, this.context.currentTime, 0.02)
  }

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
        this.output.gain.value = this.level
        const limiter = this.context.createDynamicsCompressor()
        limiter.threshold.value = -6
        limiter.knee.value = 0
        limiter.ratio.value = 20
        limiter.attack.value = 0.003
        limiter.release.value = 0.1
        this.output.connect(limiter).connect(this.context.destination)
        this.piano = new Piano(this.context, this.output)
        this.context.onstatechange = () => this.onChange()
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

  /** One metronome click at an audio-clock time. */
  click(time: number, accent: boolean) {
    const context = this.context
    if (!context || !this.output) return
    const osc = context.createOscillator()
    const gain = context.createGain()
    osc.frequency.value = accent ? 1400 : 900
    gain.gain.setValueAtTime(accent ? 0.16 : 0.1, time)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035)
    osc.connect(gain).connect(this.output)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
    osc.start(time)
    osc.stop(time + 0.04)
  }
  dispose() {
    this.transport.pause()
    this.piano?.allNotesOff()
    if (this.context) {
      this.context.onstatechange = null
      void this.context.close()
    }
  }
}
