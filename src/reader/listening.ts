/** A pause between setlist pieces, measured only with AudioContext.currentTime.
 * The caller wakes tick(); frame/timer frequency never determines its duration. */
export class ListeningBreak {
  pending = false
  paused = false
  remaining = 0
  private at: number | null = null

  start(seconds: number) {
    this.pending = true; this.paused = false
    this.remaining = Math.max(0, seconds); this.at = null
  }
  tick(now: number, running: boolean) {
    if (!this.pending) return false
    if (!running || this.paused) { this.at = null; return false }
    if (this.at !== null) this.remaining = Math.max(0, this.remaining - Math.max(0, now - this.at))
    this.at = now
    return this.remaining <= 0
  }
  hold(now: number) {
    if (!this.pending) return
    this.tick(now, true); this.paused = true; this.at = null
  }
  resume() { this.paused = false; this.at = null }
  change(seconds: number) { const paused = this.paused; this.start(seconds); this.paused = paused }
  cancel() { this.pending = false; this.paused = false; this.remaining = 0; this.at = null }
}
