import { expect, test } from '@playwright/test'
import { Transport } from '../../src/engine/audio'
import type { Piano } from '../../src/engine/piano'

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
  transport.pause(0.5) // Wait mode pins an exact group beat.
  time = 100
  expect(transport.beatAt()).toBe(0.5)
  expect(transport.timeAtBeat(1)).toBeNull()
  transport.resume()
  expect(transport.timeAtBeat(1)).toBe(101)
  time = 101
  expect(transport.beatAt()).toBe(1)
  expect(() => transport.setTempo(0)).toThrow()
  expect(() => transport.setRate(2)).toThrow()
})

test('audio: input sounds key/bot notes, mutes own-sound MIDI, and releases sustain', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('midi-sound-status')).toContainText('MIDI notes are muted')
  await page.getByRole('button', { name: 'Play MIDI through computer' }).click()
  await expect(page.getByTestId('audio-status')).toHaveText('Piano ready')
  await expect(page.getByTestId('midi-sound-status')).toHaveText('MIDI notes play through the computer.')
  // The one-click path starts audio and unmutes MIDI, without another setup action.
  await page.evaluate(() => window.__piano.send({ type: 'on', note: 60, velocity: 90, src: 'midi', t: performance.now() }))
  expect(await page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(1)
  await page.getByLabel('My MIDI keyboard makes its own sound', { exact: false }).check()
  const muted = await page.evaluate(() => {
    const { engine, send } = window.__piano
    send({ type: 'on', note: 60, velocity: 90, src: 'midi', t: performance.now() })
    return engine.piano!.activeVoices
  })
  expect(muted).toBe(0)
  await page.locator('body').click({ position: { x: 2, y: 2 } })
  await page.keyboard.down('a')
  expect(await page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(1)
  await page.keyboard.down(' ')
  await page.keyboard.up('a')
  await page.waitForTimeout(450) // Observe audio-clock release, not musical scheduling.
  expect(await page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(1)
  await page.keyboard.up(' ')
  await expect.poll(() => page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(0)
  await page.getByLabel('My MIDI keyboard makes its own sound', { exact: false }).uncheck()
  await page.evaluate(() => window.__piano.send({ type: 'on', note: 60, velocity: 90, src: 'midi', t: performance.now() }))
  expect(await page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(1)
  await page.getByLabel('My MIDI keyboard makes its own sound', { exact: false }).check()
  expect(await page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(0)
  await page.getByRole('button', { name: 'Play piano chord' }).click()
  expect(await page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(3)
  await expect.poll(() => page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(0)
})

test('audio: rendered samples are audible, velocity-sensitive, and obey pedal/release', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enable sound' }).click()
  await expect(page.getByTestId('audio-status')).toHaveText('Piano ready')
  const result = await page.evaluate(async () => {
    const PianoType = window.__piano.engine.piano!.constructor as typeof Piano
    async function render(velocity: number, pedal: boolean, note = 60) {
      const context = new OfflineAudioContext(1, 44100 * 2, 44100)
      const piano = new PianoType(context, context.destination)
      await piano.load()
      if (pedal) piano.sustain(true, 'key', 0)
      piano.noteOn(note, velocity, 'key', 0)
      piano.noteOff(note, 'key', 0.2)
      if (pedal) piano.sustain(false, 'key', 1.2)
      const data = (await context.startRendering()).getChannelData(0)
      const rms = (start: number, end: number) => {
        const samples = data.slice(start * 44100, end * 44100)
        return Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length)
      }
      return { attack: rms(0.02, 0.15), held: rms(0.8, 1), tail: rms(1.7, 1.9), finite: data.every(Number.isFinite) }
    }
    return { soft: await render(25, false), loud: await render(110, false),
      pedal: await render(110, true), low: await render(90, false, 21), high: await render(90, false, 108),
      transpose: await render(90, false, 61) }
  })
  expect(result.loud.attack).toBeGreaterThan(0.001)
  expect(result.loud.attack).toBeGreaterThan(result.soft.attack * 5)
  expect(result.loud.held).toBe(0)
  expect(result.pedal.held).toBeGreaterThan(0.0001)
  expect(result.pedal.tail).toBe(0)
  for (const sound of [result.low, result.high, result.transpose]) {
    expect(sound.attack).toBeGreaterThan(0.0001)
    expect(sound.finite).toBe(true)
  }
})

test('audio: metronome uses beat times, pauses cleanly, and resumes without a jump', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enable sound' }).click()
  await expect(page.getByTestId('audio-status')).toHaveText('Piano ready')
  await page.evaluate(() => {
    const { engine } = window.__piano
    const context = engine.context!
    const create = context.createOscillator.bind(context)
    const beats: number[] = []
    ;(window as unknown as { clickBeats: number[] }).clickBeats = beats
    context.createOscillator = () => {
      const osc = create()
      const start = osc.start.bind(osc)
      osc.start = (time = 0) => { beats.push(engine.transport.beatAt(time)); start(time) }
      return osc
    }
  })
  await page.getByLabel('Tempo', { exact: true }).fill('180')
  await page.getByRole('button', { name: 'Start metronome' }).click()
  await expect.poll(() => page.evaluate(() => window.__piano.engine.transport.beatAt())).toBeGreaterThan(2)
  const beats = await page.evaluate(() => (window as unknown as { clickBeats: number[] }).clickBeats)
  expect(beats.length).toBeGreaterThanOrEqual(3)
  for (const beat of beats) expect(Math.abs(beat - Math.round(beat))).toBeLessThan(0.06)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const stopped = await page.getByTestId('audio-beat').textContent()
  await page.waitForTimeout(450)
  await expect(page.getByTestId('audio-beat')).toHaveText(stopped!)
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__piano.engine.transport.beatAt())).toBeGreaterThan(Number(stopped) + 0.3)
  const mapping = await page.evaluate(() => {
    const { engine } = window.__piano
    const now = performance.now()
    return { time: engine.audioTime(now), context: engine.context!.currentTime,
      pastDelta: engine.audioTime(now) - engine.audioTime(now - 100),
      heard: engine.heardBeat(now), expected: engine.transport.beatAt(engine.audioTime(now) - engine.latency) }
  })
  expect(Math.abs(mapping.time - mapping.context)).toBeLessThan(0.01)
  expect(mapping.pastDelta).toBeCloseTo(0.1, 2)
  expect(mapping.heard).toBeCloseTo(mapping.expected, 2)
  await page.getByRole('button', { name: 'Stop all sound' }).click()
  expect(await page.evaluate(() => window.__piano.engine.metronomeOn)).toBe(false)
})

test('audio: a failed sample load is visible and can be retried', async ({ page }) => {
  await page.route('**/audio/salamander/A0.mp3', (route) => route.fulfill({ status: 503, body: 'unavailable' }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Enable sound' }).click()
  await expect(page.getByTestId('audio-status')).toContainText('Could not load piano:')
  await expect(page.getByRole('button', { name: 'Play piano chord' })).toBeDisabled()
  await page.unroute('**/audio/salamander/A0.mp3')
  await page.getByRole('button', { name: 'Enable sound' }).click()
  await expect(page.getByTestId('audio-status')).toHaveText('Piano ready')
})
