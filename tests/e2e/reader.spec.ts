import { expect, test, type Page } from '@playwright/test'

const ODE = 'tests/fixtures/ode-repeat.musicxml'
const ODE_MXL = 'tests/fixtures/ode-repeat.mxl'
// Saved by MuseScore Studio 4 from our own MusicXML (ode-repeat, and the built-in Chopin).
const ODE_MSCZ = 'tests/fixtures/ode-repeat.mscz'
const CHOPIN_MSCZ = 'tests/fixtures/chopin-op28-4.mscz'

async function open(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => !!window.__piano?.timeline && !!document.querySelector('[data-testid=sheet] svg'))
  return errors
}
/** Import a file and wait until its timeline (not the previous score's) is ready. */
async function importScore(page: Page, file: string, title = 'Ode to Joy (test)') {
  await page.evaluate(() => { (window as unknown as { previous: unknown }).previous = window.__piano.timeline })
  await page.getByRole('button', { name: 'Scores' }).click()
  await page.getByTestId('import-input').setInputFiles(file)
  await page.waitForFunction(() => window.__piano.timeline && window.__piano.timeline !== (window as unknown as { previous: unknown }).previous)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}
const time = (page: Page) => page.evaluate(() => window.__piano.player.time)
const summary = (page: Page) => page.evaluate(() => {
  const t = window.__piano.timeline!
  return { bars: t.passes.map((p) => p.number), sounds: t.sounds.length, end: t.end, bpm: t.bpm, clicks: t.clicks.length }
})

test('reader: built-in pieces sound every transcribed note at the written tempo', async ({ page }) => {
  const errors = await open(page)
  await expect(page.getByRole('heading', { name: 'Prelude in E minor, Op. 28 No. 4' })).toBeVisible()
  // Same counts and length as the parked text transcription (pickup + 24 bars + a 3-beat bar at ♩ = 48).
  expect(await summary(page)).toMatchObject({ sounds: 604, end: 125, bpm: 48 })
  expect(await page.evaluate(() => window.__piano.timeline!.sounds.slice(0, 2).map((s) => [s.midi, s.time, s.end]))).toEqual([[59, 0, 0.9375], [71, 0.9375, 1.25]])
  await page.getByRole('button', { name: 'Scores' }).click()
  await page.getByRole('button', { name: /Prelude in C major/ }).click()
  await expect(page.getByRole('heading', { name: 'Prelude in C major, BWV 846' })).toBeVisible()
  await page.waitForFunction(() => window.__piano.timeline?.sounds.length === 549)
  expect(await summary(page)).toMatchObject({ end: 140, bpm: 60 })
  expect(errors).toEqual([])
})

test('reader: MusicXML and .mxl imports follow repeats and endings, and stay in the library', async ({ page }) => {
  const errors = await open(page)
  await importScore(page, ODE)
  expect(await summary(page)).toEqual({ bars: [1, 2, 3, 1, 2, 4], sounds: 30, end: 12, bpm: 120, clicks: 24 })
  await importScore(page, ODE_MXL)
  expect(await summary(page)).toEqual({ bars: [1, 2, 3, 1, 2, 4], sounds: 30, end: 12, bpm: 120, clicks: 24 })
  await expect(page.getByText('Ludwig van Beethoven', { exact: true })).toBeVisible()

  await page.reload()
  await page.waitForFunction(() => window.__piano?.timeline?.sounds.length === 30) // the last score reopens
  await page.getByRole('button', { name: 'Scores' }).click()
  const drawer = page.getByRole('dialog', { name: 'Scores' })
  await expect(drawer.getByText('Ludwig van Beethoven · ode-repeat.mxl')).toBeVisible()
  await expect(drawer.getByText('Ludwig van Beethoven · ode-repeat.musicxml')).toBeVisible()
  await drawer.getByRole('button', { name: 'Delete Ode to Joy (test)' }).first().click()
  await drawer.getByRole('button', { name: 'Delete for good' }).click()
  await expect(drawer.getByRole('button', { name: 'Delete Ode to Joy (test)' })).toHaveCount(1)
  expect(errors).toEqual([])
})

test('reader: MuseScore files (.mscz) open as the same music as their MusicXML', async ({ page }) => {
  const errors = await open(page)
  const sounds = () => page.evaluate(() => window.__piano.timeline!.sounds.map((s) => [s.midi, s.time, s.end, s.staff]))
  const chopin = await sounds() // the built-in Chopin opens first
  await importScore(page, CHOPIN_MSCZ, 'Prelude in E minor · Op. 28 No. 4')
  expect(await summary(page)).toMatchObject({ sounds: 604, end: 125, bpm: 48 })
  expect(await sounds()).toEqual(chopin)
  expect(await page.locator('[data-testid=sheet] svg path').count()).toBeGreaterThan(100)
  await importScore(page, ODE_MSCZ)
  expect(await summary(page)).toEqual({ bars: [1, 2, 3, 1, 2, 4], sounds: 30, end: 12, bpm: 120, clicks: 24 })
  await page.getByRole('button', { name: 'Scores' }).click()
  await expect(page.getByRole('dialog', { name: 'Scores' }).getByText('Ludwig van Beethoven · ode-repeat.mscz')).toBeVisible()
  expect(errors).toEqual([])
})

test('reader: dropped files that are not MusicXML explain what to download instead', async ({ page }) => {
  await open(page)
  /** drop a file on the window, as from Explorer */
  const drop = (name: string, text: string) => page.evaluate(([n, t]) => {
    const data = new DataTransfer()
    data.items.add(new File([t], n))
    document.querySelector('.app')!.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }))
  }, [name, text])
  const message = page.getByTestId('message')
  await drop('song.mscz', 'PK\x03\x04 not a score')
  await expect(message).toContainText('This MuseScore file could not be read')
  await expect(message).toContainText('File → Export → MusicXML')
  await drop('song.pdf', '%PDF-1.4')
  await expect(message).toContainText('picture of the music')
  await drop('song.mid', 'MThd')
  await expect(message).toContainText('MIDI files have no sheet music')
  await drop('broken.musicxml', '<?xml version="1.0"?><score-partwise><part-list/></score-partwise>')
  await expect(message).toContainText('Could not read this score')
})

test('reader: playback sounds the score, lights the notes and follows repeats', async ({ page }) => {
  const errors = await open(page)
  await importScore(page, ODE)
  await page.getByRole('button', { name: 'Count-in', exact: true }).click() // on by default
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => time(page)).toBeGreaterThan(0.3)
  expect(await page.locator('[data-testid=sheet] .lit-0').count()).toBeGreaterThan(0)
  expect(await page.getByTestId('keys').getAttribute('data-lit')).toContain('48') // the left hand's C3
  expect(await page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const paused = await time(page)
  await page.waitForTimeout(300)
  expect(await time(page)).toBe(paused)
  expect(await page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(0)

  // From bar 3 (first ending) the repeat goes back to bar 1.
  await page.keyboard.press('Home')
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('position')).toContainText('Bar 3')
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowUp') // speed 200 %
  await expect(page.getByLabel('Speed', { exact: true })).toHaveValue('200')
  await page.keyboard.press(' ')
  await expect.poll(() => time(page), { timeout: 5000 }).toBeGreaterThan(6.2)
  await expect(page.getByTestId('position')).toContainText('Bar 1')
  await page.keyboard.press(' ')
  expect(errors).toEqual([])
})

test('reader: count-in, then the music starts where it was', async ({ page }) => {
  await open(page)
  await importScore(page, ODE)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByTestId('message')).toContainText('Count-in')
  expect(await time(page)).toBe(0)
  await expect.poll(() => time(page), { timeout: 6000 }).toBeGreaterThan(0.2)
  await expect(page.getByTestId('message')).toHaveCount(0)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
})

test('reader: clicking the music jumps there, Shift+click and L make loops that repeat', async ({ page }) => {
  await open(page)
  await importScore(page, ODE)
  const notes = page.locator('[data-testid=sheet] g.vf-stavenote')
  await notes.nth(5).click() // bar 2
  await expect(page.getByTestId('position')).toContainText('Bar 2')
  expect(await time(page)).toBeGreaterThan(1.9)
  await notes.nth(9).click({ modifiers: ['Shift'] }) // bar 3 (the whole treble line is drawn before the bass line)
  await expect(page.getByRole('button', { name: 'Loop bars 2–3' })).toBeVisible()
  await expect(page.locator('.loop-box')).toHaveCount(2)
  await page.getByRole('button', { name: 'Loop bars 2–3' }).click()
  await expect(page.locator('.loop-box')).toHaveCount(0)

  // L loops the bar we are in; at 200 % it wraps every second.
  await page.getByRole('button', { name: 'Count-in', exact: true }).click()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('l')
  await expect(page.getByRole('button', { name: 'Loop bar 2' })).toBeVisible()
  await page.getByLabel('Speed', { exact: true }).fill('200')
  await page.keyboard.press(' ') // Space plays even while the speed slider has focus
  const seen: number[] = []
  for (let i = 0; i < 25; i++) { seen.push(await time(page)); await page.waitForTimeout(100) }
  await page.keyboard.press(' ')
  expect(Math.min(...seen)).toBeGreaterThanOrEqual(2 - 1e-6)
  expect(Math.max(...seen)).toBeLessThanOrEqual(4 + 1e-6)
  expect(seen.some((t, i) => i > 0 && t < seen[i - 1] - 0.5)).toBe(true) // it wrapped
})

test('reader: transposing re-renders the music and moves every pitch', async ({ page }) => {
  await open(page)
  await importScore(page, ODE)
  const pitches = () => page.evaluate(() => window.__piano.timeline!.sounds.slice(0, 3).map((s) => s.midi))
  expect(await pitches()).toEqual([48, 64, 64])
  await page.getByRole('button', { name: 'Transpose up' }).click()
  await page.getByRole('button', { name: 'Transpose up' }).click()
  await expect(page.getByTestId('transpose')).toHaveText('+2')
  await expect.poll(pitches).toEqual([50, 66, 66])
  expect(await page.evaluate(() => window.__piano.osmd!.Sheet.Transpose)).toBe(2)
})

test('reader: muting a hand silences it and takes it off the keys', async ({ page }) => {
  await open(page)
  await importScore(page, ODE)
  await page.getByRole('button', { name: 'Left hand', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Left hand', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Count-in', exact: true }).click()
  await page.keyboard.press(' ')
  await expect.poll(() => time(page)).toBeGreaterThan(0.2)
  const lit = await page.getByTestId('keys').getAttribute('data-lit')
  expect(lit).toBe('64')
  await page.keyboard.press(' ')
})

test('reader: views, rows of music and the on-screen keys', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Scores' }).click()
  await page.getByRole('button', { name: /Prelude in C major/ }).click()
  await page.waitForFunction(() => window.__piano.timeline?.sounds.length === 549)
  const sheet = page.getByTestId('sheet')
  /** lines of music whose staves are fully inside the sheet panel */
  const visibleRows = () => page.evaluate(() => {
    const o = window.__piano.osmd!
    const view = document.querySelector<HTMLElement>('[data-testid=sheet]')!
    const svg = view.querySelector('svg')!.getBoundingClientRect(), box = view.getBoundingClientRect()
    return o.GraphicSheet.MusicPages.flatMap((p) => p.MusicSystems).filter((s) => {
      const top = svg.top + s.StaffLines[0].PositionAndShape.AbsolutePosition.y * o.zoom * 10
      const bottom = svg.top + (s.StaffLines.at(-1)!.PositionAndShape.AbsolutePosition.y + 4) * o.zoom * 10
      return top >= box.top && bottom <= box.bottom
    }).length
  })
  const zooms: number[] = []
  for (const rows of [2, 3, 4]) {
    await page.getByRole('button', { name: `${rows} rows` }).click()
    await expect.poll(visibleRows).toBe(rows)
    zooms.push(Number(await sheet.getAttribute('data-zoom')))
  }
  expect(zooms[0]).toBeGreaterThan(zooms[1])
  expect(zooms[1]).toBeGreaterThan(zooms[2])
  await page.getByRole('button', { name: '1 row', exact: true }).click()
  await expect.poll(() => sheet.evaluate((e) => e.scrollWidth > e.clientWidth * 3)).toBe(true)
  expect(await sheet.getAttribute('data-systems')).toBe('1')

  await page.getByRole('button', { name: 'Keys', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Sheet music' })).toBeHidden()
  await expect(page.getByRole('img', { name: 'Piano keyboard' })).toBeVisible()
  await page.getByRole('button', { name: 'Sheet', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Piano keyboard' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Both', exact: true }).click()

  // Clicking a key sounds it for as long as it is held.
  const key = page.locator('rect[data-note="60"]')
  const box = (await key.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 10)
  await page.mouse.down()
  await expect.poll(() => page.evaluate(() => window.__piano.engine.piano?.activeVoices ?? 0), { timeout: 15000 }).toBe(1)
  await expect(key).toHaveClass(/pressed/)
  await page.mouse.up()
  await expect.poll(() => page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(0)

  // Layout choices are remembered.
  await page.reload()
  await page.waitForFunction(() => !!window.__piano?.timeline)
  await expect(page.getByRole('button', { name: '1 row', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
