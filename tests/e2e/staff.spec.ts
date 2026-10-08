import { expect, test } from '@playwright/test'

test('staff: the renderer draws the bars and reports where the notes are', async ({ page }, testInfo) => {
  await page.goto('/')
  const staff = page.getByTestId('staff')
  await expect(page.getByTestId('staff-info')).toContainText('bars drawn')
  const ms = Number((await page.getByTestId('staff-info').innerText()).match(/in (\d+) ms/)?.[1])
  expect(ms).toBeLessThan(250)
  const xs = ((await staff.getAttribute('data-note-xs')) ?? '').split(',').map(Number)
  expect(xs).toHaveLength(32) // 4 bars × 8 left-hand chords
  expect(xs.every((x, i) => i === 0 || x > xs[i - 1])).toBe(true) // left to right
  expect(await staff.locator('svg .vf-stavenote').count()).toBe(40)
  await staff.screenshot({ path: testInfo.outputPath('staff.png') })
})
