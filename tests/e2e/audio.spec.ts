import { expect, test } from '@playwright/test'
import { Transport } from '../../src/engine/audio'

test('audio: transport stays continuous across tempo, rate, wait and resume', () => {
  let time = 10
  const transport = new Transport(() => time)
  transport.setTempo(120)
  transport.seek(-4)
  transport.resume()
  expect(transport.timeAtBeat(0)).toBe(12)
  time = 11
  expect(transport.beatAt()).toBe(-2)
  transport.setRate(0.5)
  expect(transport.beatAt()).toBe(-2)
  time = 13
  expect(transport.beatAt()).toBe(0)
  transport.setTempo(60)
  time = 15
  expect(transport.beatAt()).toBe(1)
  transport.pause(0.5) // pausing at an exact beat
  time = 100
  expect(transport.beatAt()).toBe(0.5)
  expect(transport.timeAtBeat(1)).toBeNull()
  transport.resume()
  expect(transport.timeAtBeat(1)).toBe(101)
  time = 101
  expect(transport.beatAt()).toBe(1)
  expect(() => transport.setTempo(0)).toThrow()
  expect(() => transport.setRate(2.5)).toThrow()
  expect(() => transport.setRate(0.2)).toThrow()
})
