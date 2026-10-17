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
