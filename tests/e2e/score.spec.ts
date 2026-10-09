import { expect, test } from '@playwright/test'
import { definePiece, sectionBounds, type PieceSpec } from '../../src/engine/score'
import chopin from '../../src/content/pieces/chopin-op28-4'
import bach from '../../src/content/pieces/bach-bwv846'

const phrase: PieceSpec = { id: 'test', title: 'Test', composer: 'Original', source: 'Original test phrase',
  licence: 'original', verified: false, tempo: 60, key: 'C', time: [4, 4], sections: [{ name: 'A', bars: [1, 2] }],
  practice: ['Listen'], right: 'C4:2 G##4:4 [C4,E4,G4]:4~ | [C4,E4,G4]:2 r:2', left: 'r:1 | r:1' }

test('score: spelling, chords, ties and rests have exact audible lengths', () => {
  const score = definePiece(phrase)
  expect(score.events.find((e) => e.pitches[0]?.name === 'G##4')!.pitches[0].midi).toBe(69)
  expect(score.soundNotes.filter((n) => n.start === 3)).toHaveLength(3)
  for (const n of score.soundNotes.filter((n) => n.start === 3)) {
    expect(n.beats).toBe(3)
    expect(n.eventIds).toHaveLength(2)
  }
  expect(score.soundNotes).toHaveLength(5)
  expect(score.end).toBe(8)
})

test('score: malformed rhythm, pitch, ties and sections fail validation', () => {
  expect(() => definePiece({ ...phrase, right: 'C4:2 | r:1' })).toThrow(/expected 4/)
  expect(() => definePiece({ ...phrase, right: 'C4:1~ | D4:1' })).toThrow(/tie/)
  expect(() => definePiece({ ...phrase, right: 'C9:1 | r:1' })).toThrow(/invalid token/)
  expect(() => definePiece({ ...phrase, left: 'r:1' })).toThrow(/bar counts/)
  expect(() => definePiece({ ...phrase, sections: [{ name: 'bad', bars: [1, 3] }] })).toThrow(/section/)
  expect(() => definePiece({ ...phrase, right: 'C4:8t r:2 r:4 | r:1' })).toThrow(/Triplet/)
})

test('score: complete Chopin preserves pickup, 25 bars, closing chords and ornaments', () => {
  expect(chopin.verified).toBe(false)
  expect(chopin.bars).toHaveLength(26)
  expect(chopin.start).toBe(-1)
  expect(chopin.end).toBe(99)
  expect(chopin.soundNotes[0].pitch.name).toBe('B3')
  expect(chopin.soundNotes[1].pitch.name).toBe('B4')
  expect(chopin.events.filter((e) => e.triplet)).toHaveLength(6)
  expect(chopin.events.filter((e) => e.grace.length)).toHaveLength(2)
  expect(chopin.soundNotes.find((n) => n.pitch.name === 'G#4' && n.hand === 'R' && n.start === 31)?.beats).toBe(2)
  expect(chopin.soundNotes.filter((n) => n.start === 96).map((n) => n.pitch.name).sort()).toEqual(['E1', 'E2', 'E3', 'E4', 'G3', 'B3'].sort())
  expect(sectionBounds(chopin, [1, 4])).toEqual({ start: -1, end: 16 })
  expect(sectionBounds(chopin, [21, 25])).toEqual({ start: 80, end: 99 })
})

test('score: independent voices validate rhythm and keep their ties separate', () => {
  const score = definePiece({ ...phrase, left: ['C3:1~ | C3:1', 'r:2 C3:2~ | C3:1'] })
  expect(score.soundNotes.filter((n) => n.hand === 'L').map((n) => [n.start, n.beats])).toEqual([[0, 8], [2, 6]])
  expect(() => definePiece({ ...phrase, left: ['r:1 | r:1', 'r:1'] })).toThrow(/bar counts/)
  expect(() => definePiece({ ...phrase, left: ['r:1 | r:1', 'C3:2 | r:1'] })).toThrow(/expected 4/)
})

test('score: complete Bach has 35 bars, held bass voices and original closing patterns', () => {
  expect(bach.verified).toBe(false)
  expect(bach.bars).toHaveLength(35)
  expect(bach.end).toBe(140)
  expect(bach.soundNotes).toHaveLength(549)
  expect(bach.soundNotes.filter((n) => n.start < 2).map((n) => [n.pitch.name, n.start, n.beats])).toEqual([
    ['C4', 0, 2], ['E4', 0.25, 1.75], ['G4', 0.5, 0.25], ['C5', 0.75, 0.25],
    ['E5', 1, 0.25], ['G4', 1.25, 0.25], ['C5', 1.5, 0.25], ['E5', 1.75, 0.25],
  ])
  expect(bach.soundNotes.filter((n) => n.hand === 'L' && n.start >= 128 && n.start < 132).map((n) => [n.pitch.name, n.start, n.beats])).toEqual([
    ['C2', 128, 4], ['C3', 128.25, 3.75],
  ])
  expect(bach.soundNotes.filter((n) => n.start === 136).map((n) => n.pitch.name).sort()).toEqual(['C2', 'C3', 'E4', 'G4', 'C5'].sort())
  expect(sectionBounds(bach, [33, 35])).toEqual({ start: 128, end: 140 })
})
