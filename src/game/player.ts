import type { Engine } from '../engine/audio'
import { sectionBounds, type Hand, type Score, type ScoreNote } from '../engine/score'

/** Listen transport only; the mission templates/matcher are the next roadmap item. */
export class PiecePlayer {
  state: 'idle' | 'countIn' | 'playing' | 'paused' | 'ending' | 'done' = 'idle'
  range: [number, number]
  loop = false
  metronome = false
  hands: 'both' | Hand = 'both'
  cycles = 0
  error = ''
  private timer: ReturnType<typeof setInterval> | null = null
  private queue: ScoreNote[] = []
  private cursor = 0
  private revision = -1
  private endingAt = 0
  private request = 0

  constructor(readonly engine: Engine, readonly score: Score) {
    this.range = [1, score.bars.at(-1)!.number]
  }
  get bounds() { return sectionBounds(this.score, this.range) }
  get beat() {
    if (this.state === 'idle') return this.bounds.start
    if (this.state === 'done') return this.bounds.end
    const now = this.engine.context?.currentTime ?? 0
    return this.engine.transport.beatAt(now - (this.engine.transport.paused ? 0 : this.engine.latency))
  }
  get sounding() {
    return this.state === 'playing' ? this.queue.filter((n) => n.start <= this.beat && n.start + n.beats > this.beat) : []
  }

  async listen() {
    this.error = ''
    this.stop()
    const request = this.request
    await this.engine.start()
    if (request !== this.request) return
    if (this.engine.status !== 'ready' || this.engine.context?.state !== 'running') {
      this.error = this.engine.error || 'Enable sound to start listening.'
      return
    }
    this.cycles = 0
    this.engine.transport.setTempo(this.score.tempo)
    this.begin()
    this.timer = setInterval(() => this.update(), 25)
  }
  private begin() {
    const { start, end } = this.bounds
    this.queue = this.score.soundNotes.filter((n) => n.start < end && n.start + n.beats > start && (this.hands === 'both' || n.hand === this.hands))
    this.cursor = 0
    this.engine.transport.seek(start - 4)
    this.engine.transport.resume(this.engine.context!.currentTime + 0.04)
    this.revision = this.engine.transport.revision
    this.state = 'countIn'
    this.engine.setMetronome(true)
    this.update()
  }
  pause() {
    if (!['playing', 'countIn', 'ending'].includes(this.state)) return
    this.engine.transport.pause()
    this.engine.setMetronome(false)
    this.engine.piano?.allNotesOff('bot')
    this.state = 'paused'
  }
  resume() {
    if (this.state !== 'paused' || this.engine.context?.state !== 'running') return
    this.engine.transport.resume()
    this.state = this.engine.transport.beatAt() < this.bounds.start ? 'countIn' : 'playing'
    this.engine.setMetronome(this.state === 'countIn' || this.metronome)
    this.reschedule()
    this.update()
  }
  setRate(rate: number) {
    this.engine.transport.setRate(rate)
    if (this.state !== 'idle' && this.state !== 'done') this.reschedule()
    this.engine.tick()
  }
  setRange(range: [number, number]) {
    sectionBounds(this.score, range)
    this.stop()
    this.range = range
  }
  setMetronome(enabled: boolean) {
    this.metronome = enabled
    if (this.state === 'playing') this.engine.setMetronome(enabled)
  }
  private reschedule() {
    this.engine.piano?.allNotesOff('bot')
    const beat = this.engine.transport.beatAt()
    this.cursor = this.queue.findIndex((n) => n.start + n.beats > beat)
    if (this.cursor < 0) this.cursor = this.queue.length
    this.revision = this.engine.transport.revision
  }
  update() {
    if (!['countIn', 'playing', 'ending'].includes(this.state) || !this.engine.context) return
    if (this.engine.transport.paused || this.engine.context.state !== 'running') { this.pause(); return }
    if (this.revision !== this.engine.transport.revision) this.reschedule()
    const now = this.engine.context.currentTime
    const beat = this.engine.transport.beatAt(now)
    const { start, end } = this.bounds
    if (this.state === 'countIn' && beat >= start) {
      this.state = 'playing'
      this.engine.setMetronome(this.metronome)
    }
    while (this.cursor < this.queue.length) {
      const note = this.queue[this.cursor]
      const startTime = this.engine.transport.timeAtBeat(Math.max(start, note.start))!
      if (startTime > now + 0.1) break
      const endTime = this.engine.transport.timeAtBeat(Math.min(end, note.start + note.beats))!
      if (endTime > now) {
        this.engine.piano!.noteOn(note.pitch.midi, note.hand === 'R' ? 82 : 55, 'bot', Math.max(now, startTime))
        this.engine.piano!.noteOff(note.pitch.midi, 'bot', endTime)
      }
      this.cursor++
    }
    if (this.state !== 'ending' && beat >= end) {
      this.state = 'ending'
      this.endingAt = this.engine.transport.timeAtBeat(end)! + 0.5
      this.engine.setMetronome(false)
    }
    if (this.state === 'ending' && now >= this.endingAt) {
      this.cycles++
      if (this.loop) { this.engine.piano?.allNotesOff('bot'); this.begin() }
      else {
        this.engine.transport.pause(end)
        this.state = 'done'
        if (this.timer) clearInterval(this.timer)
        this.timer = null
      }
    }
  }
  stop() {
    this.request++
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.engine.setMetronome(false)
    this.engine.transport.pause()
    this.engine.piano?.allNotesOff('bot')
    this.state = 'idle'
  }
}
