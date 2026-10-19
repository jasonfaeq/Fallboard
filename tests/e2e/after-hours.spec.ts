import { expect, test, type Page } from '@playwright/test'
import { noteNumber } from '../../src/engine/notes'

async function open(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.waitForFunction(() => !!window.__piano?.timeline && !!document.querySelector('[data-testid=sheet] svg'))
  return errors
}
async function pedal(page: Page) {
  await page.getByTestId('quick-import-input').setInputFiles('tests/fixtures/pedal.musicxml')
  await expect(page.getByRole('heading', { name: 'Pedal (test)', exact: true })).toBeVisible()
  await page.waitForFunction(() => window.__piano.timeline?.pedals.length === 3)
  await page.keyboard.press('p')
}
const state = (page: Page) => page.evaluate(() => {
  const { player, engine, timeline } = window.__piano
  return { speed: player.speed, loop: player.loop, volume: engine.volume, room: engine.room,
    sounds: timeline!.sounds.length, end: timeline!.end }
})
const notes = (page: Page, attribute: string) => page.getByTestId('keys').evaluateAll((elements, name) => (elements[0]?.getAttribute(name) ?? '').split(',').filter(Boolean).map(Number), attribute)

test('after hours: scenes persist and change materials without changing the player or audio room', async ({ page }) => {
  const errors = await open(page)
  await page.getByRole('button', { name: 'Next bar', exact: true }).click()
  await page.keyboard.press('l')
  await page.getByLabel('Speed', { exact: true }).fill('75')
  const before = await state(page), position = await page.evaluate(() => window.__piano.player.time)
  await page.keyboard.press('p')
  const ivory = page.locator('#kb-white stop').first()
  const walnut = await ivory.evaluate(el => getComputedStyle(el).stopColor)
  await expect(page.getByRole('button', { name: 'Walnut studio', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Moonlit hall', exact: true }).click()
  await expect(page.locator('.app')).toHaveAttribute('data-stage-scene', 'hall')
  expect(await ivory.evaluate(el => getComputedStyle(el).stopColor)).not.toBe(walnut)
  expect(await state(page)).toEqual(before)
  expect(await page.evaluate(() => window.__piano.player.time)).toBe(position)
  await page.getByRole('button', { name: 'Count-in', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__piano.player.state)).toBe('playing')
  const playingAt = await page.evaluate(() => window.__piano.player.time)
  await page.getByRole('button', { name: 'Velvet room', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__piano.player.time)).toBeGreaterThan(playingAt + .15)
  expect(await page.evaluate(() => window.__piano.engine.transport.paused)).toBe(false)
  expect(await state(page)).toEqual(before)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.reload()
  await page.waitForFunction(() => !!window.__piano?.timeline)
  await expect(page.locator('.app')).not.toHaveClass(/is-performance/)
  await page.keyboard.press('p')
  await expect(page.getByRole('button', { name: 'Velvet room', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('p')
  await expect(page.locator('.stage-room')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Sheet music', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('after hours: a sustain ribbon outlives the physical key and follows seeks, pedal changes, muting and transposition', async ({ page }) => {
  const errors = await open(page)
  await pedal(page)
  const c = noteNumber('C5')
  await page.getByRole('button', { name: 'Count-in', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => notes(page, 'data-sustained')).toContain(c)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.locator(`rect.key[data-note="${c}"]`).locator('..')).not.toHaveClass(/down/)
  expect(await notes(page, 'data-lit')).not.toContain(c)
  await page.evaluate(() => window.__piano.player.seek(2.1))
  expect(await notes(page, 'data-sustained')).not.toContain(c)
  await page.evaluate(() => window.__piano.player.seek(.75))
  await expect.poll(() => notes(page, 'data-sustained')).toContain(c)
  await page.getByRole('button', { name: 'Right hand', exact: true }).click()
  await expect.poll(() => notes(page, 'data-sustained')).not.toContain(c)
  await page.getByRole('button', { name: 'Right hand', exact: true }).click()
  await expect.poll(() => notes(page, 'data-sustained')).toContain(c)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Transpose up', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.app')).toHaveClass(/is-performance/)
  await expect.poll(() => notes(page, 'data-sustained')).toContain(noteNumber('Cs5'))
  expect(await notes(page, 'data-sustained')).not.toContain(c)
  await page.evaluate(() => window.__piano.player.seek(0))
  await expect(page.getByTestId('keys')).toHaveAttribute('data-sustained', '')
  await page.keyboard.press('p')
  await expect(page.getByRole('region', { name: 'Sheet music', exact: true })).toBeVisible()
  await expect(page.getByTestId('sheet')).toHaveAttribute('data-systems', /[1-9]/)
  expect(errors).toEqual([])
})

test('after hours: lighting off and reduced motion remove sustain effects while musical keys remain', async ({ page }) => {
  const errors = await open(page)
  await pedal(page)
  await page.evaluate(() => window.__piano.player.seek(.75))
  await expect.poll(() => notes(page, 'data-sustained')).toContain(noteNumber('C5'))
  const canvas = page.getByRole('img', { name: 'Falling notes', exact: true })
  const glowing = await canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL())
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Lighting', { exact: true }).fill('0')
  await expect(page.getByTestId('keys')).toHaveAttribute('data-lighting', '0')
  await expect(page.getByTestId('keys')).toHaveAttribute('data-sustained', '')
  expect(await canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL())).not.toBe(glowing)
  expect(await notes(page, 'data-lit')).toContain(noteNumber('D5'))
  await page.getByLabel('Lighting', { exact: true }).fill('80')
  await page.keyboard.press('Escape')
  await expect.poll(() => notes(page, 'data-sustained')).toContain(noteNumber('C5'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.getByTestId('keys')).toHaveAttribute('data-lighting', '0')
  await expect(page.getByTestId('keys')).toHaveAttribute('data-sustained', '')
  expect(await notes(page, 'data-lit')).toContain(noteNumber('D5'))
  expect(errors).toEqual([])
})

test('after hours: all room scenes fit desktop and compact stages with reachable controls', async ({ page }) => {
  const errors = await open(page)
  await pedal(page)
  await page.evaluate(() => window.__piano.player.seek(.75))
  const scenes = [['studio', 'Walnut studio'], ['hall', 'Moonlit hall'], ['velvet', 'Velvet room']]
  for (const [width, height] of [[1440, 1000], [1024, 768], [768, 900], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height })
    for (const [scene, name] of scenes) {
      const button = page.getByRole('button', { name, exact: true })
      await button.click()
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: `${name} fits ${width}px` }).toBe(true)
      expect(await button.evaluate(el => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === el })).toBe(true)
      const keys = (await page.getByRole('region', { name: 'Keys', exact: true }).boundingBox())!
      expect(keys.height).toBeGreaterThan(170)
      expect(keys.x + keys.width).toBeLessThanOrEqual(width)
      expect(keys.y + keys.height).toBeLessThan(height)
      if (width === 1440 || width === 390) await page.screenshot({ path: `.qa/after-hours-${scene}-${width}.png`, animations: 'disabled' })
    }
  }
  expect(errors).toEqual([])
})
