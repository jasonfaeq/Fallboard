import { expect, test } from '@playwright/test'

test('staff: the renderer draws the bars and reports where the notes are', async ({ page }) => {
  await page.goto('/')
  const staff = page.getByTestId('staff')
  await expect(page.getByTestId('staff-info')).toContainText('25 bars and pickup drawn from the score')
  const xs = ((await staff.getAttribute('data-note-xs')) ?? '').split(',').map(Number)
  expect(xs.length).toBeGreaterThan(200)
  expect(xs.every((x, i) => i === 0 || x >= xs[i - 1])).toBe(true)
  expect(await staff.getAttribute('data-bar-count')).toBe('26')
  expect(await staff.locator('svg .vf-stavenote').count()).toBeGreaterThan(200)
  await page.screenshot({ path: '.qa/play-screen.png', fullPage: true })
})
