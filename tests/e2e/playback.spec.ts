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
