// How the score's marks shape playback: pedal, dynamics, timing marks, and each hand's volume.
// The fixtures are small two-staff pieces at ♩ = 120, so a bar of 4/4 lasts 2 score seconds.
import { expect, test, type Page } from '@playwright/test'

interface Sent { on: number; off: number; midi: number; velocity: number; level: number }

async function open(page: Page, file: string, title: string) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => !!window.__piano?.timeline && !!document.querySelector('[data-testid=sheet] svg'))
  await page.evaluate(() => { (window as unknown as { previous: unknown }).previous = window.__piano.timeline })
  await page.getByRole('button', { name: 'Scores' }).click()
  await page.getByTestId('import-input').setInputFiles(`tests/fixtures/${file}`)
  await page.waitForFunction(() => window.__piano.timeline && window.__piano.timeline !== (window as unknown as { previous: unknown }).previous)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.getByRole('button', { name: 'Count-in', exact: true }).click() // on by default
  return errors
}

/** Start the sound and log every note the player sends to the piano, in score seconds. */
async function record(page: Page) {
  await page.evaluate(async () => {
    const { engine } = window.__piano
    await engine.start()
    const piano = engine.piano!
    const sent: { on: number; off: number; midi: number; velocity: number; level: number }[] = []
    const open = new Map<number, (typeof sent)[number]>()
    ;(window as unknown as { sent: typeof sent }).sent = sent
    const noteOn = piano.noteOn.bind(piano), noteOff = piano.noteOff.bind(piano)
    const beat = (when?: number) => engine.transport.beatAt(when)
    piano.noteOn = (...args: Parameters<typeof noteOn>) => {
      const [midi, velocity, channel, when] = args
      const level = (args as unknown[])[4] as number | undefined
      if (channel === 'score') {
        const note = { midi, velocity, level: level ?? 1, on: beat(when), off: NaN }
        sent.push(note)
        open.set(midi, note)
      }
      noteOn(...args)
    }
    piano.noteOff = (...args: Parameters<typeof noteOff>) => {
      const [midi, channel, when] = args
      const note = open.get(midi)
      if (channel === 'score' && note) { note.off = beat(when); open.delete(midi) }
      noteOff(...args)
    }
  })
}
const sent = (page: Page) => page.evaluate(() => (window as unknown as { sent: Sent[] }).sent)
const time = (page: Page) => page.evaluate(() => window.__piano.player.time)
const round = (n: number) => Math.round(n * 1000) / 1000

/** Play from the start at 200 % until `until` score seconds, then pause. */
async function playUntil(page: Page, until: number) {
  await page.getByLabel('Speed', { exact: true }).fill('200')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => time(page), { timeout: 10_000 }).toBeGreaterThan(until)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
}

test('playback: the sustain pedal holds notes until it lifts', async ({ page }) => {
  const errors = await open(page, 'pedal.musicxml', 'Pedal (test)')
  const timeline = await page.evaluate(() => {
    const t = window.__piano.timeline!
    return { pedals: t.pedals, sounds: t.sounds.map((s) => [s.midi, s.time, s.end, s.release]) }
  })
  // Down in bar 1, changed at bar 2, up at its third beat; Ped. … * in bar 3 up before beat 4.
  expect(timeline.pedals).toEqual([{ time: 0, end: 2 }, { time: 2, end: 3 }, { time: 4, end: 5.5 }])
  const release = (midi: number, at: number) => timeline.sounds.find(([m, t]) => m === midi && t === at)?.[3]
  expect(release(72, 0)).toBe(2) // C5 rings to the change
  expect(release(77, 1.5)).toBe(2)
  expect(release(48, 0)).toBe(2) // the left hand too
  expect(release(79, 2)).toBe(3) // after the change, to the pedal's lift
  expect(release(76, 3)).toBe(3.5) // the pedal is up: as written
  expect(release(48, 4)).toBe(5) // the same key struck again stops it
  expect(release(84, 5.5)).toBe(6)

  await record(page)
  await playUntil(page, 4.2)
  const notes = await sent(page)
  const off = (midi: number, at: number) => round(notes.find((n) => n.midi === midi && Math.abs(n.on - at) < 0.01)?.off ?? NaN)
  expect(off(72, 0)).toBe(2)
  expect(off(48, 0)).toBe(2)
  expect(off(79, 2)).toBe(3)
  expect(off(76, 3)).toBe(3.5)
  expect(await page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(0) // pausing stops them

  // A loop cuts held notes at its end; muting a hand leaves the other one pedalled.
  await page.getByRole('button', { name: 'Left hand', exact: true }).click()
  await page.keyboard.press('Home')
  await page.keyboard.press('l')
  await expect(page.getByRole('button', { name: 'Loop bar 1' })).toBeVisible()
  await page.evaluate(() => { (window as unknown as { sent: Sent[] }).sent.length = 0 })
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__piano.player.repeats), { timeout: 10_000 }).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const looped = await sent(page)
  expect(looped.some((n) => n.midi < 60)).toBe(false)
  expect(looped.filter((n) => n.on < 1).every((n) => round(n.off) === 2)).toBe(true)
  expect(errors).toEqual([])
})

test('playback: dynamics, hairpins and accents set each note’s loudness', async ({ page }) => {
  const errors = await open(page, 'dynamics.musicxml', 'Dynamics (test)')
  const velocities = (staff: number) => page.evaluate((s) => window.__piano.timeline!.sounds.filter((x) => x.staff === s).map((x) => x.velocity), staff)
  // p; a crescendo across bar 2 to the ff that follows it; ff with an accent; a diminuendo to mp.
  expect(await velocities(0)).toEqual([54, 54, 54, 54, 54, 67, 80, 93, 106, 127, 106, 86, 66, 66, 66, 66])
  // The left hand follows the marks above it, a little softer, except where it has its own f.
  expect(await velocities(1)).toEqual([44, 44, 75, 54])

  await record(page)
  await playUntil(page, 6.2)
  const notes = await sent(page)
  expect(notes.filter((n) => n.midi === 72).map((n) => n.velocity).slice(0, 13)).toEqual([54, 54, 54, 54, 54, 67, 80, 93, 106, 127, 106, 86, 66])

  // Without any marks the loudness is as before: 78 for the upper staff, 64 below.
  await page.getByRole('button', { name: 'Scores' }).click()
  await page.evaluate(() => { (window as unknown as { previous: unknown }).previous = window.__piano.timeline })
  await page.getByTestId('import-input').setInputFiles('tests/fixtures/ode-repeat.musicxml')
  await page.waitForFunction(() => window.__piano.timeline && window.__piano.timeline !== (window as unknown as { previous: unknown }).previous)
  expect([...new Set(await velocities(0))]).toEqual([78])
  expect([...new Set(await velocities(1))]).toEqual([64])
  expect(errors).toEqual([])
})

test('playback: fermatas hold, rit. slows to a tempo, and ornaments play their notes', async ({ page }) => {
  const errors = await open(page, 'timing.musicxml', 'Timing (test)')
  const t = await page.evaluate(() => {
    const tl = window.__piano.timeline!
    return {
      passes: tl.passes.map((p) => p.time), end: tl.end,
      upper: tl.sounds.filter((s) => s.staff === 0).map((s) => [s.midi, s.time, s.end]),
      lower: tl.sounds.filter((s) => s.staff === 1).map((s) => [s.time, s.end]),
      clicks: tl.clicks.map((c) => c.time), steps: tl.steps.map((s) => s.time),
    }
  })
  // ♩ = 120. The fermata doubles bar 1's last beat (0.5 s more), and the left hand holds with it.
  const rit = 2 * Math.log(1 / 0.7) / 0.3 // bar 2 slows from 100 % to 70 % of the tempo
  const expected = [0, 2.5, 2.5 + rit, 4.5 + rit]
  t.passes.forEach((time, i) => expect(time).toBeCloseTo(expected[i], 3))
  expect(t.end).toBeCloseTo(6.5 + rit, 3)
  expect(t.upper[3].slice(1)).toEqual([1.5, 2.5])
  expect(t.lower[0]).toEqual([0, 2.5])
  // In the rit. each beat is longer than the one before; the metronome follows.
  const bar2 = t.steps.filter((s) => s >= 2.5 - 1e-3 && s < expected[2] - 1e-3)
  const gaps = [...bar2.slice(1), t.passes[2]].map((s, i) => s - bar2[i])
  expect(gaps.every((g, i) => i === 0 || g > gaps[i - 1])).toBe(true)
  expect(gaps[0]).toBeGreaterThan(0.5)
  expect(t.clicks.filter((c) => c >= 2.5 - 1e-3 && c < expected[2] - 1e-3)).toEqual(bar2)

  // Bar 3, a tempo: a trill on E (G major, so with F♯), a turn on G, a mordent on A.
  const bar3 = t.upper.filter(([, time]) => time >= expected[2] - 1e-3 && time < expected[3] - 1e-3)
  expect(bar3.map(([midi]) => midi)).toEqual([76, 78, 76, 78, 76, 78, 76, 78, 76, 78, 76, 81, 79, 78, 79, 81, 79, 81])
  expect(bar3[10][2]).toBeCloseTo(t.passes[2] + 1, 6) // the trill fills its half note
  expect(bar3[11][1]).toBeCloseTo(t.passes[2] + 1, 6)
  expect(bar3[12][1] - bar3[11][1]).toBeCloseTo(0.09, 6)
  expect(bar3[14][2]).toBeCloseTo(t.passes[2] + 1.5, 6) // the turn ends on the main note, held

  // The player sends what the timeline says, at those times.
  await record(page)
  await page.getByLabel('Speed', { exact: true }).fill('200')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => time(page), { timeout: 10_000 }).toBeGreaterThan(expected[3] + 0.2)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const notes = (await sent(page)).filter((n) => n.midi > 60)
  const timeline = t.upper.filter(([, time]) => time < expected[3] + 0.1)
  expect(notes.slice(0, timeline.length).map((n) => [n.midi, round(n.on), round(n.off)])).toEqual(timeline.map(([m, on, off]) => [m, round(on), round(off)]))
  expect(errors).toEqual([])
})

test('playback: a MuseScore 4 rit. line slows the last bar', async ({ page }) => {
  const errors = await open(page, 'ode-rit.mscx', 'Ode to Joy (test)')
  const passes = await page.evaluate(() => window.__piano.timeline!.passes.map((p) => [p.number, p.time, p.end]))
  expect(passes.map(([n]) => n)).toEqual([1, 2, 3, 1, 2, 4])
  expect(passes.slice(0, 5).every(([, time, end]) => Math.abs(end - time - 2) < 1e-6)).toBe(true) // the repeat is untouched
  const [, time, end] = passes[5]
  expect(end - time).toBeCloseTo(2 * Math.log(1 / 0.7) / 0.3, 3) // ♩ = 120 slowing to 84
  expect(errors).toEqual([])
})
