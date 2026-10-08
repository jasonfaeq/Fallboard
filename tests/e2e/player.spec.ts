import { expect, test } from '@playwright/test'

test('player: all assist views keep the staff and Page stays still', async ({ page }) => {
  await page.goto('/')
  const player = page.getByRole('region', { name: 'Piece player', exact: true })
  await expect(player.getByRole('img', { name: 'Falling notes' })).toBeVisible()
  await expect(player.locator('.key')).toHaveCount(88)
  await page.getByLabel('View', { exact: true }).selectOption('staff')
  await expect(player.getByRole('img', { name: 'Falling notes' })).toHaveCount(0)
  await expect(player.locator('.key')).toHaveCount(0)
  await expect(player.locator('.staff-playhead')).toBeVisible()
  await page.getByLabel('View', { exact: true }).selectOption('page')
  await expect(page.getByTestId('staff-info')).toContainText('drawn from the score')
  await expect(player.locator('.staff-playhead')).toHaveCount(0)
  await expect(player.locator('.staff-svg')).toHaveCSS('transform', 'none')
  await expect(player.locator('.staff-svg svg .vf-stavenote')).toHaveCount(await page.evaluate(() => {
    const { score } = window.__piano.player
    return score.events.length + score.events.reduce((sum, e) => sum + e.grace.length, 0)
  }))
  await page.screenshot({ path: '.qa/page-view.png', fullPage: true })
  const geometry = await page.evaluate(() => {
    const svg = document.querySelector('.page .staff-svg svg')!
    const host = svg.parentElement!
    return { viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
      viewBox: svg.getAttribute('viewBox'), svgWidth: svg.getBoundingClientRect().width,
      hostWidth: host.getBoundingClientRect().width, inline: svg.getAttribute('style') }
  })
  expect(geometry.scroll, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewport)
  await page.getByLabel('View', { exact: true }).selectOption('full')
  await expect(player.getByRole('img', { name: 'Falling notes' })).toBeVisible()
})

test('player: Listen counts in, sounds the score, pauses and preserves position on speed changes', async ({ page }) => {
  await page.goto('/')
  const player = page.getByRole('region', { name: 'Piece player', exact: true })
  await page.getByLabel('Section', { exact: true }).selectOption('0')
  await player.getByRole('button', { name: 'Listen', exact: true }).click()
  await expect(page.getByTestId('player-status')).toContainText('Count-in')
  await expect.poll(() => page.evaluate(() => window.__piano.player.state)).toBe('playing')
  await expect.poll(() => page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBeGreaterThan(0)
  await expect(page.getByTestId('player-status')).toContainText('Listening')
  await player.getByRole('button', { name: 'Pause listening', exact: true }).click()
  const beat = Number(await page.getByTestId('player-beat').textContent())
  await page.waitForTimeout(400)
  expect(Number(await page.getByTestId('player-beat').textContent())).toBeCloseTo(beat, 2)
  await page.getByLabel('Playback speed', { exact: true }).selectOption('0.5')
  expect(Number(await page.getByTestId('player-beat').textContent())).toBeCloseTo(beat, 2)
  await player.getByRole('button', { name: 'Resume listening', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__piano.player.beat)).toBeGreaterThan(beat + 0.2)
  await player.getByRole('button', { name: 'Stop', exact: true }).click()
  expect(await page.evaluate(() => window.__piano.player.state)).toBe('idle')
  expect(await page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(0)
})

test('player: final section plays to its bar ending and loops with a fresh count-in', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Section', { exact: true }).selectOption('5')
  await page.getByRole('region', { name: 'Piece player', exact: true }).getByRole('button', { name: 'Listen', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__piano.player.state), { timeout: 40000 }).toBe('done')
  expect(await page.evaluate(() => window.__piano.player.beat)).toBe(99)
  expect(await page.evaluate(() => window.__piano.player.cycles)).toBe(1)
  await expect(page.getByTestId('player-status')).toContainText('Finished listening')
  await page.getByLabel('Loop section', { exact: true }).check()
  await page.getByRole('region', { name: 'Piece player', exact: true }).getByRole('button', { name: 'Listen', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__piano.player.cycles), { timeout: 40000 }).toBe(1)
  expect(await page.evaluate(() => window.__piano.player.state)).toBe('countIn')
  await page.getByRole('region', { name: 'Piece player', exact: true }).getByRole('button', { name: 'Stop', exact: true }).click()
})
