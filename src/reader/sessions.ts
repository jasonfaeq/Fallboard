export interface SessionVisit { first: number; label: string; visits: number }
export type SessionEnd = 'completed' | 'finished' | 'switched' | 'closed'
export interface SessionRecap {
  id: string; score: string; title: string; composer: string; started: number; ended: number; reason: SessionEnd
  seconds: number; startSpeed: number; endSpeed: number; minSpeed: number; maxSpeed: number; changes: number
  passages: SessionVisit[]
}
export interface SessionSample {
  score: string; title: string; composer: string; date: number; audioTime: number; active: boolean
  position: number; end: number; speed: number; repeats: number; passage: { first: number; label: string }
}

/** Reader activity measured on the audio clock, independent of seek distance and preview playback. */
export class SessionTracker {
  private draft: Omit<SessionRecap, 'id' | 'ended' | 'reason'> | null = null
  private previous: SessionSample | null = null
  sample(sample: SessionSample) {
    if (!this.draft && sample.active && sample.position < sample.end) {
      this.draft = { score: sample.score, title: sample.title, composer: sample.composer, started: sample.date, seconds: 0,
        startSpeed: sample.speed, endSpeed: sample.speed, minSpeed: sample.speed, maxSpeed: sample.speed, changes: 0, passages: [] }
    }
    const draft = this.draft, previous = this.previous
    if (!draft || draft.score !== sample.score) { this.previous = sample; return }
    if (previous?.active && previous.score === sample.score) {
      // At the score end the player's ringing tail is not additional reading time.
      const available = Math.max(0, (previous.end - previous.position) / previous.speed)
      draft.seconds += Math.max(0, Math.min(sample.audioTime - previous.audioTime, available))
    }
    if (sample.speed !== draft.endSpeed) {
      draft.changes++; draft.endSpeed = sample.speed
      draft.minSpeed = Math.min(draft.minSpeed, sample.speed); draft.maxSpeed = Math.max(draft.maxSpeed, sample.speed)
    }
    if (sample.active && sample.position < sample.end && (!previous?.active || previous.passage.first !== sample.passage.first || sample.repeats > previous.repeats)) {
      const visit = draft.passages.find((p) => p.first === sample.passage.first)
      if (visit) visit.visits++
      else draft.passages.push({ ...sample.passage, visits: 1 })
    }
    this.previous = sample
  }
  get current() { return this.draft }
  finish(id: string, ended: number, reason: SessionEnd): SessionRecap | null {
    const draft = this.draft
    this.draft = null; this.previous = null
    return draft && draft.seconds >= .25 ? { ...draft, id, ended, reason, seconds: Math.round(draft.seconds * 100) / 100,
      passages: draft.passages.map((p) => ({ ...p })).sort((a, b) => a.first - b.first) } : null
  }
}

export function validRecap(value: SessionRecap) {
  return value && typeof value.id === 'string' && typeof value.score === 'string' && typeof value.title === 'string' &&
    typeof value.composer === 'string' && ['completed', 'finished', 'switched', 'closed'].includes(value.reason) &&
    [value.started, value.ended, value.seconds, value.startSpeed, value.endSpeed, value.minSpeed, value.maxSpeed, value.changes].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0) &&
    Array.isArray(value.passages) && value.passages.every((p) => p && Number.isInteger(p.first) && p.first >= 0 && typeof p.label === 'string' && Number.isInteger(p.visits) && p.visits > 0)
}
