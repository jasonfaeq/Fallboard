import type { Engine } from '../engine/audio'
import type { NoteEvent } from '../engine/input'
import { sectionBounds, type Hand, type Score, type ScoreNote } from '../engine/score'

/** listen = the game plays · play = the line keeps moving · wait = the line stops at each note until it is played */
export type PlayMode = 'listen' | 'play' | 'wait'
/** all score notes that start on the same beat */
interface Group { start: number; notes: ScoreNote[] }

/** The piece player's transport. Nothing is scored yet; the matcher is the next roadmap item. */
export class PiecePlayer {
  mode: PlayMode = 'listen'
  /** play and wait modes: the game sounds the score too. Off = only the player's own notes are heard. */
  guide = false
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
  private groups: Group[] = []
  private groupIndex = 0
  private soundedGroup = -1
  private pressed = new Set<number>()
  private holding = false

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

  /** wait mode: the line is stopped until the due notes are played */
  get waiting() { return this.holding }
  /** wait mode: the MIDI notes of the group the line is stopped at */
  get due() { return this.holding ? this.groups[this.groupIndex].notes.map((n) => n.pitch.midi) : [] }

  listen() { return this.start('listen') }
  async start(mode: PlayMode) {
    this.error = ''
    this.stop()
    const request = this.request
    await this.engine.start()
    if (request !== this.request) return
    if (this.engine.status !== 'ready' || this.engine.context?.state !== 'running') {
      this.error = this.engine.error || 'Enable sound to start.'
      return
    }
    this.mode = mode
    this.cycles = 0
    this.engine.transport.setTempo(this.score.tempo)
    this.begin()
    this.timer = setInterval(() => this.update(), 25)
  }
  private begin() {
    const { start, end } = this.bounds
    this.queue = this.score.soundNotes.filter((n) => n.start < end && n.start + n.beats > start && (this.hands === 'both' || n.hand === this.hands))
    this.cursor = 0
    this.groups = []
    for (const note of this.queue) {
      if (note.start < start) continue // tied over from before the section: nothing to press
      const last = this.groups.at(-1)
      if (last && last.start === note.start) last.notes.push(note)
      else this.groups.push({ start: note.start, notes: [note] })
    }
    this.groupIndex = 0
    this.soundedGroup = -1
    this.pressed.clear()
    this.holding = false
    // Nothing is timed in wait mode, so it has no count-in (MISSIONS.md › Level flow).
    const countIn = this.mode !== 'wait'
    this.engine.transport.seek(countIn ? start - 4 : start)
    this.engine.transport.resume(this.engine.context!.currentTime + 0.04)
    this.revision = this.engine.transport.revision
    this.state = countIn ? 'countIn' : 'playing'
    this.engine.setMetronome(countIn || this.metronome)
    this.update()
  }
  /** Every input event; wait mode advances on the player's note-ons. */
  onEvent(event: NoteEvent) {
    if (event.type !== 'on' || this.mode !== 'wait' || this.state !== 'playing') return
    this.pressed.add(event.note)
    this.update()
  }
  pause() {
    if (!['playing', 'countIn', 'ending'].includes(this.state)) return
    this.engine.transport.pause()
    this.engine.setMetronome(false)
    this.engine.piano?.allNotesOff('bot')
    this.holding = false
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
    this.revision = this.engine.transport.revision
    if (this.mode === 'wait') return // stopping at a note must not cut the guide notes short
    this.engine.piano?.allNotesOff('bot')
    const beat = this.engine.transport.beatAt()
    this.cursor = this.queue.findIndex((n) => n.start + n.beats > beat)
    if (this.cursor < 0) this.cursor = this.queue.length
  }
  /** Wait mode: the line runs at tempo between groups and stops on a group until its notes were played. */
  private updateWait(now: number) {
    const transport = this.engine.transport
    const done = (g: Group) => g.notes.every((n) => this.pressed.has(n.pitch.midi))
    const advance = () => { this.pressed.clear(); this.groupIndex++ }
    if (this.holding) {
      if (!done(this.groups[this.groupIndex])) return
      advance()
      this.holding = false
      transport.resume()
    }
    while (this.groupIndex < this.groups.length) {
      const group = this.groups[this.groupIndex]
      const time = transport.timeAtBeat(group.start)!
      if (this.guide && this.soundedGroup < this.groupIndex && time <= now + 0.1) {
        this.soundedGroup = this.groupIndex
        for (const note of group.notes) {
          this.engine.piano!.noteOn(note.pitch.midi, note.hand === 'R' ? 82 : 55, 'bot', Math.max(now, time))
          this.engine.piano!.noteOff(note.pitch.midi, 'bot', Math.max(now, time) + note.beats * 60 / (transport.tempo * transport.rate))
        }
      }
      if (time > now) break
      if (done(group)) { advance(); continue } // played just before the line arrived: keep moving
      transport.pause(group.start)
      this.holding = true
      break
    }
    this.revision = transport.revision
  }
  update() {
    if (!['countIn', 'playing', 'ending'].includes(this.state) || !this.engine.context) return
    if ((this.engine.transport.paused && !this.holding) || this.engine.context.state !== 'running') { this.pause(); return }
    if (this.revision !== this.engine.transport.revision) this.reschedule()
    const now = this.engine.context.currentTime
    if (this.mode === 'wait' && this.state === 'playing') {
      this.updateWait(now)
      if (this.holding) return
    }
    const beat = this.engine.transport.beatAt(now)
    const { start, end } = this.bounds
    if (this.state === 'countIn' && beat >= start) {
      this.state = 'playing'
      this.engine.setMetronome(this.metronome)
    }
    const sounds = this.mode === 'listen' || (this.mode === 'play' && this.guide)
    while (sounds && this.cursor < this.queue.length) {
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
    this.holding = false
    this.state = 'idle'
  }
}
