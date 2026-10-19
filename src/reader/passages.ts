import type { Timeline } from './timeline'

export interface Passage { first: number; last: number }

/** Small passages in playing order. Repeats and jumps start a fresh passage. */
export function buildPassages(timeline: Timeline): Passage[] {
  const result: Passage[] = []
  for (let i = 0; i < timeline.passes.length; i++) {
    const previous = result.at(-1)
    if (!previous || i - previous.first >= 4 || timeline.passes[i].number !== timeline.passes[i - 1].number + 1) {
      result.push({ first: i, last: i })
    } else previous.last = i
  }
  return result
}

export function passageLabel(timeline: Timeline, { first, last }: Passage) {
  const parts: string[] = []
  let start = first
  for (let i = first + 1; i <= last + 1; i++) {
    if (i <= last && timeline.passes[i].number === timeline.passes[i - 1].number + 1) continue
    const a = timeline.passes[start].number, b = timeline.passes[i - 1].number
    parts.push(start === i - 1 ? a === 0 ? 'Pickup' : `Bar ${a}` : a === 0 ? `Pickup–${b}` : `Bars ${a}–${b}`)
    start = i
  }
  return parts.join(' · ')
}

/** Number of note attacks per played bar, for the map's density drawing. */
export function passageDensity(timeline: Timeline) {
  let note = 0
  return timeline.passes.map((pass) => {
    while (note < timeline.sounds.length && timeline.sounds[note].time < pass.time) note++
    const first = note
    while (note < timeline.sounds.length && timeline.sounds[note].time < pass.end) note++
    return note - first
  })
}
