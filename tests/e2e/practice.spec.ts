// The practice tools: saved sections, remembered position, speed-up and count-in settings,
// go to bar, and the metronome. The Ode fixture plays bars 1 2 3 1 2 4 in 4/4 at ♩ = 120, so
// each bar lasts 2 score seconds.
import { expect, test, type Page } from '@playwright/test'

const ODE = 'tests/fixtures/ode-repeat.musicxml'

async function open(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => !!window.__piano?.timeline && !!document.querySelector('[data-testid=sheet] svg'))
  return errors
}
async function importOde(page: Page) {
  await page.evaluate(() => { (window as unknown as { previous: unknown }).previous = window.__piano.timeline })
  await page.getByRole('button', { name: 'Scores' }).click()
  await page.getByTestId('import-input').setInputFiles(ODE)
  await page.waitForFunction(() => window.__piano.timeline && window.__piano.timeline !== (window as unknown as { previous: unknown }).previous)
  await expect(page.getByRole('heading', { name: 'Ode to Joy (test)' })).toBeVisible()
}
/** Log every metronome click and every note the player sends, in score seconds. */
async function listen(page: Page) {
  await page.evaluate(async () => {
    const { engine } = window.__piano
    await engine.start()
    const log = { clicks: [] as { beat: number; accent: boolean }[], notes: [] as { beat: number; midi: number }[] }
    ;(window as unknown as { heard: typeof log }).heard = log
    const click = engine.click.bind(engine)
    engine.click = (time, accent) => { log.clicks.push({ beat: engine.transport.beatAt(time), accent }); click(time, accent) }
    const piano = engine.piano!
    const noteOn = piano.noteOn.bind(piano)
    piano.noteOn = (...args: Parameters<typeof noteOn>) => {
      if (args[2] === 'score') log.notes.push({ beat: engine.transport.beatAt(args[3]), midi: args[0] })
      noteOn(...args)
    }
  })
}
type Heard = { clicks: { beat: number; accent: boolean }[]; notes: { beat: number; midi: number }[] }
const heard = (page: Page) => page.evaluate(() => {
  const log = (window as unknown as { heard: Heard }).heard
  const round = (n: number) => Math.round(n * 1000) / 1000
  const taken = { clicks: log.clicks.map((c) => ({ ...c, beat: round(c.beat) })), notes: log.notes.map((n) => ({ ...n, beat: round(n.beat) })) }
  log.clicks.length = 0
  log.notes.length = 0
  return taken
})
const time = (page: Page) => page.evaluate(() => window.__piano.player.time)
const loopOf = (page: Page) => page.evaluate(() => window.__piano.player.loop)

test('practice: sections are saved per score, picked, renamed, deleted and kept after a reload', async ({ page }) => {
  const errors = await open(page)
  await importOde(page)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('l')
  await page.locator('[data-testid=sheet] g.vf-stavenote').nth(9).click({ modifiers: ['Shift'] }) // bar 3
  await expect(page.getByRole('button', { name: 'Loop bars 2–3' })).toBeVisible()

  await page.getByRole('button', { name: 'Sections' }).click()
  const name = page.getByLabel('Section name')
  await expect(name).toHaveValue('Bars 2–3')
  await name.fill('Verse')
  await page.getByRole('button', { name: 'Save loop' }).click()
  await expect(page.getByRole('button', { name: 'Verse', exact: true })).toBeVisible() // the loop button shows its name

  // Bar 1 as a second section, with the default name.
  await page.keyboard.press('l') // loop off
  await page.keyboard.press('Home')
  await page.keyboard.press('l')
  await page.getByRole('button', { name: 'Save loop' }).click()
  const list = page.locator('.section-list li')
  await expect(list).toHaveCount(2)
  await expect(list.nth(0)).toContainText('Bar 1')
  await expect(list.nth(1)).toContainText('Verse')
  await expect(list.nth(1)).toContainText('Bars 2–3')

  // Reload: the sections are still there; picking one loops it and goes to its start.
  await page.keyboard.press('l')
  await page.reload()
  await page.waitForFunction(() => !!window.__piano?.timeline && !!document.querySelector('[data-testid=sheet] svg'))
  await expect(page.getByRole('heading', { name: 'Ode to Joy (test)' })).toBeVisible()
  await page.getByRole('button', { name: 'Sections' }).click()
  await page.locator('.section-name', { hasText: 'Verse' }).click()
  await expect.poll(() => loopOf(page)).toEqual({ start: 2, end: 6 })
  expect(await time(page)).toBeCloseTo(2, 3)
  await expect(page.locator('.loop-box')).toHaveCount(2)

  // [ and ] step through the sections.
  await page.keyboard.press('[')
  await expect.poll(() => loopOf(page)).toEqual({ start: 0, end: 2 })
  expect(await time(page)).toBe(0)
  await page.keyboard.press(']')
  await expect.poll(() => loopOf(page)).toEqual({ start: 2, end: 6 })

  await page.getByRole('button', { name: 'Rename Verse' }).click()
  await page.getByLabel('New name').fill('Middle')
  await page.getByLabel('New name').press('Enter')
  await expect(list.nth(1)).toContainText('Middle')
  await page.getByRole('button', { name: 'Delete Bar 1' }).click()
  await expect(list).toHaveCount(1)

  await page.reload()
  await page.waitForFunction(() => !!window.__piano?.timeline && !!document.querySelector('[data-testid=sheet] svg'))
  await page.getByRole('button', { name: 'Sections' }).click()
  await expect(list).toHaveCount(1)
  await expect(list.nth(0)).toContainText('Middle')
  expect(errors).toEqual([])
})

test('practice: reopening a score brings back where you were and the loop', async ({ page }) => {
  const errors = await open(page)
  await importOde(page)
  await page.getByRole('button', { name: 'Count-in', exact: true }).click() // on by default
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('l')
  await expect(page.getByRole('button', { name: 'Loop bar 3' })).toBeVisible()

  const reload = async () => {
    await page.reload()
    await page.waitForFunction(() => !!window.__piano?.timeline && !!document.querySelector('[data-testid=sheet] svg'))
    await expect(page.getByRole('heading', { name: 'Ode to Joy (test)' })).toBeVisible()
  }
  await reload()
  await expect(page.getByRole('button', { name: 'Loop bar 3' })).toBeVisible()
  expect(await loopOf(page)).toEqual({ start: 4, end: 6 })
  expect(await time(page)).toBeCloseTo(4, 3)
  await expect(page.getByTestId('position')).toContainText('Bar 3')

  // Reloading while it plays keeps the place it had reached.
  await page.keyboard.press(' ')
  await expect.poll(() => time(page)).toBeGreaterThan(4.5)
  await reload()
  const reached = await time(page)
  expect(reached).toBeGreaterThan(4.5)
  expect(reached).toBeLessThan(6)

  // Another score and back: the same place.
  await page.keyboard.press('l') // loop off
  await page.keyboard.press('ArrowLeft') // to bar 2 (more than 0.4 s into bar 3, so back to its start first)
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('position')).toContainText('Bar 2')
  await page.getByRole('button', { name: 'Scores' }).click()
  await page.locator('.drawer').getByText('Prelude in E minor').first().click()
  await expect(page.getByRole('heading', { name: /Prelude in E minor/ })).toBeVisible()
  await page.getByRole('button', { name: 'Scores' }).click()
  await page.locator('.drawer').getByText('Ode to Joy (test)').first().click()
  await page.waitForFunction(() => window.__piano.timeline?.passes.length === 6)
  await expect(page.getByTestId('position')).toContainText('Bar 2')
  expect(await time(page)).toBeCloseTo(2, 3)
  expect(await loopOf(page)).toBeNull()
  expect(errors).toEqual([])
})

test('practice: Speed up loops can start at a set speed and step past 100 % to a target', async ({ page }) => {
  await open(page)
  await importOde(page)
  await page.getByRole('button', { name: 'Count-in', exact: true }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('switch', { name: 'Speed up loops' }).click()
  await page.getByRole('group', { name: 'Speed-up step' }).getByRole('button', { name: '10%' }).click()
  await page.getByLabel('Start speed').selectOption('1')
  await page.getByLabel('Target speed').selectOption('1.2')
  await expect(page.getByText('10 % faster each time a loop comes round, up to 120 %')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByLabel('Speed', { exact: true }).fill('50')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('l') // a new loop starts at 100 %
  await expect.poll(() => page.evaluate(() => window.__piano.player.speed)).toBe(1)
  await page.keyboard.press(' ')
  await expect.poll(() => page.evaluate(() => window.__piano.player.speed), { timeout: 6000 }).toBe(1.1)
  await expect.poll(() => page.evaluate(() => window.__piano.player.speed), { timeout: 6000 }).toBe(1.2)
  await page.waitForTimeout(2500) // at least one more time round
  expect(await page.evaluate(() => window.__piano.player.speed)).toBe(1.2)
  await page.keyboard.press(' ')

  // Remembered.
  await page.reload()
  await page.waitForFunction(() => !!window.__piano?.timeline)
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('group', { name: 'Speed-up step' }).getByRole('button', { name: '10%' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Start speed')).toHaveValue('1')
  await expect(page.getByLabel('Target speed')).toHaveValue('1.2')
})

test('practice: the count-in lasts bars or beats, and can count in again each time a loop comes round', async ({ page }) => {
  await open(page)
  await importOde(page)
  await listen(page)
  await page.getByLabel('Speed', { exact: true }).fill('200')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('group', { name: 'Count-in unit' }).getByRole('button', { name: 'Beats' }).click()
  await page.getByRole('button', { name: 'Longer count-in' }).click()
  await expect(page.getByTestId('count-in-length')).toHaveText('2')
  await page.keyboard.press('Escape')

  // Two beats (a beat is half a score second).
  await page.keyboard.press(' ')
  await expect.poll(() => page.evaluate(() => window.__piano.player.state)).toBe('playing')
  await page.keyboard.press(' ')
  expect((await heard(page)).clicks).toEqual([{ beat: -1, accent: false }, { beat: -0.5, accent: false }])

  // Two bars, the first beat of each accented.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('group', { name: 'Count-in unit' }).getByRole('button', { name: 'Bars' }).click()
  await expect(page.getByTestId('count-in-length')).toHaveText('2')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Home')
  await page.keyboard.press(' ')
  await expect.poll(() => page.evaluate(() => window.__piano.player.state), { timeout: 6000 }).toBe('playing')
  await page.keyboard.press(' ')
  const twoBars = (await heard(page)).clicks
  expect(twoBars.map((c) => c.beat)).toEqual([-4, -3.5, -3, -2.5, -2, -1.5, -1, -0.5])
  expect(twoBars.filter((c) => c.accent).map((c) => c.beat)).toEqual([-4, -2])

  // Counting in each loop: one beat before bar 2 every time round, and no notes during it.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('group', { name: 'Count-in unit' }).getByRole('button', { name: 'Beats' }).click()
  await page.getByRole('button', { name: 'Shorter count-in' }).click()
  await page.getByRole('switch', { name: 'Count in each loop' }).click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('l')
  await page.keyboard.press(' ')
  const states = new Set<string>()
  const seen: number[] = []
  while (await page.evaluate(() => window.__piano.player.repeats) < 2) {
    states.add(await page.evaluate(() => window.__piano.player.state + ':' + window.__piano.player.repeats))
    seen.push(await time(page))
    await page.waitForTimeout(40)
  }
  await page.keyboard.press(' ')
  expect(states).toContain('countIn:1') // counting in again after the first time round
  expect(Math.min(...seen)).toBeGreaterThanOrEqual(2 - 1e-6) // the playhead waits at the loop start
  const looped = await heard(page)
  // (after a jump back a click can be a few milliseconds late)
  expect(looped.clicks.filter((c) => c.beat >= 1.5 - 1e-3 && c.beat < 1.6).length, JSON.stringify(looped.clicks)).toBeGreaterThanOrEqual(3)
  expect(looped.notes.length).toBeGreaterThan(0)
  expect(looped.notes.every((n) => n.beat >= 2 - 1e-3 && n.beat < 4)).toBe(true)
})

test('practice: go to a printed bar number, the first time a repeat plays it', async ({ page }) => {
  const errors = await open(page)
  await importOde(page)
  await page.keyboard.press('g')
  await page.getByLabel('Bar number').fill('4')
  await page.getByLabel('Bar number').press('Enter')
  await expect(page.getByRole('dialog', { name: 'Go to bar' })).toHaveCount(0)
  await expect(page.getByTestId('position')).toContainText('Bar 4')
  expect(await time(page)).toBeCloseTo(10, 3) // bars 1 2 3 1 2 come first

  // Bar 2 is played twice; it goes to the first time (2 s), not the nearer second (8 s).
  await page.getByTestId('position').click()
  await page.getByLabel('Bar number').fill('2')
  await page.getByRole('button', { name: 'Go', exact: true }).click()
  expect(await time(page)).toBeCloseTo(2, 3)

  // A bar that is not there says so and stays open; Escape closes it.
  await page.keyboard.press('g')
  await page.getByLabel('Bar number').fill('9')
  await page.getByLabel('Bar number').press('Enter')
  await expect(page.getByRole('alert')).toHaveText('There is no bar 9. Bars go from 1 to 4.')
  await page.getByLabel('Bar number').press('Escape')
  await expect(page.getByRole('dialog', { name: 'Go to bar' })).toHaveCount(0)
  expect(await time(page)).toBeCloseTo(2, 3)

  // Going outside the loop ends it.
  await page.keyboard.press('l')
  await page.keyboard.press('g')
  await page.getByLabel('Bar number').fill('3')
  await page.getByLabel('Bar number').press('Enter')
  expect(await loopOf(page)).toBeNull()
  expect(await time(page)).toBeCloseTo(4, 3)
  expect(errors).toEqual([])
})

test('practice: the metronome accents beat one, and Metronome only mutes the music but not the click', async ({ page }) => {
  const errors = await open(page)
  await importOde(page)
  await page.getByRole('button', { name: 'Count-in', exact: true }).click()
  await listen(page)
  await page.getByLabel('Speed', { exact: true }).fill('200')

  // Metronome only: clicks with beat one accented, the playhead and lit notes, no piano.
  await page.keyboard.press('Shift+M')
  await expect(page.getByRole('button', { name: 'Metronome only' })).toBeVisible()
  await page.keyboard.press(' ')
  await expect.poll(() => time(page)).toBeGreaterThan(0.3)
  expect(await page.locator('[data-testid=sheet] .lit-0').count()).toBeGreaterThan(0)
  expect(await page.getByTestId('keys').getAttribute('data-lit')).toContain('48')
  await expect.poll(() => time(page), { timeout: 5000 }).toBeGreaterThan(2.6)
  await page.keyboard.press(' ')
  const solo = await heard(page)
  expect(solo.notes).toEqual([])
  expect(solo.clicks.slice(0, 6)).toEqual([0, 0.5, 1, 1.5, 2, 2.5].map((beat) => ({ beat, accent: beat === 0 || beat === 2 })))

  // Back to the music (the dock chip), from where it stopped.
  await page.getByRole('button', { name: 'Metronome only' }).click()
  await expect(page.getByRole('button', { name: 'Metronome', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press(' ')
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { heard: Heard }).heard.notes.length))).toBeGreaterThan(0)
  await page.keyboard.press(' ')

  // Turning it on while playing silences the piano at once.
  await heard(page)
  await page.keyboard.press('Home')
  await page.keyboard.press(' ')
  await expect.poll(() => time(page)).toBeGreaterThan(0.6)
  await page.keyboard.press('Shift+M')
  const at = await page.evaluate(() => window.__piano.engine.transport.beatAt() + 0.3) // past what was already scheduled
  await expect.poll(() => time(page), { timeout: 5000 }).toBeGreaterThan(at + 1)
  await page.keyboard.press(' ')
  expect((await heard(page)).notes.filter((n) => n.beat > at)).toEqual([])
  await page.keyboard.press('Shift+M')

  // Without the accent every click is the same.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('switch', { name: 'Accent the first beat' }).click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('m')
  await page.keyboard.press('Home')
  await page.keyboard.press(' ')
  await expect.poll(() => time(page), { timeout: 5000 }).toBeGreaterThan(2.6)
  await page.keyboard.press(' ')
  const plain = (await heard(page)).clicks
  expect(plain.length).toBeGreaterThanOrEqual(5)
  expect(plain.some((c) => c.accent)).toBe(false)
  expect(errors).toEqual([])
})
