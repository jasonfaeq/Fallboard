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

test('player: Bach selection draws both bass voices, plays the ending and switches safely', async ({ page }) => {
  await page.goto('/')
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.getByLabel('Piece', { exact: true }).selectOption('bach-bwv846')
  await expect(page.getByRole('heading', { name: 'Prelude No. 1 in C major · BWV 846' })).toBeVisible()
  await expect(page.getByTestId('staff')).toHaveAttribute('data-bar-count', '35')
  await page.getByLabel('View', { exact: true }).selectOption('page')
  await expect(page.getByTestId('staff').locator('.vf-stavenote')).toHaveCount(await page.evaluate(() => window.__piano.player.score.events.length))
  await page.screenshot({ path: '.qa/bach-page.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.getByLabel('View', { exact: true }).selectOption('full')
  await page.screenshot({ path: '.qa/bach-full.png', fullPage: true })
  await page.getByLabel('Section', { exact: true }).selectOption('8')
  await page.getByRole('button', { name: 'Listen', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__piano.player.state)).toBe('playing')
  await expect.poll(() => page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => window.__piano.player.state), { timeout: 20000 }).toBe('done')
  expect(await page.evaluate(() => window.__piano.player.beat)).toBe(140)
  await page.getByRole('button', { name: 'Listen', exact: true }).click()
  await expect(page.getByTestId('player-status')).toContainText('Count-in')
  await page.getByLabel('Piece', { exact: true }).selectOption('chopin-op28-4')
  expect(await page.evaluate(() => window.__piano.player.state)).toBe('idle')
  expect(await page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(0)
  expect(await page.evaluate(() => window.__piano.engine.context!.state)).toBe('running')
  await expect(page.getByLabel('Section', { exact: true })).toHaveValue('all')
  await page.getByRole('button', { name: 'Listen', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__piano.player.state)).toBe('playing')
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  expect(errors).toEqual([])
})

test('player: Practise stops the line at each note until it is played, and stays silent without the guide', async ({ page }) => {
  await page.goto('/')
  const region = page.getByRole('region', { name: 'Piece player', exact: true })
  const press = (...notes: number[]) => page.evaluate((ns) => {
    // src 'midi': the keyboard makes its own sound, so the game must add none
    for (const note of ns) window.__piano.send({ type: 'on', note, velocity: 80, t: performance.now(), src: 'midi' })
    for (const note of ns) window.__piano.send({ type: 'off', note, t: performance.now(), src: 'midi' })
  }, notes)
  const beat = () => page.evaluate(() => window.__piano.player.beat)
  const due = () => page.evaluate(() => window.__piano.player.due)
  await page.getByLabel('Section', { exact: true }).selectOption('0')
  await region.getByRole('button', { name: 'Practise · waits for you', exact: true }).click()
  await expect.poll(due).toEqual([59]) // the pickup B3, with no count-in
  expect(await beat()).toBe(-1)
  await page.waitForTimeout(300)
  expect(await beat()).toBe(-1)
  await expect(page.getByTestId('player-status')).toContainText('Your turn · play B3')
  await press(60) // a wrong note does not move the line
  expect(await due()).toEqual([59])
  await press(59)
  await expect.poll(due).toEqual([71])
  expect(await beat()).toBe(-0.25)
  await press(71)
  await expect.poll(due).toEqual([71, 55, 59, 64]) // bar 1: melody note with the first left-hand chord
  await press(71, 55, 59)
  expect(await due()).toHaveLength(4) // an incomplete chord keeps waiting
  await press(64)
  await expect.poll(due).toEqual([55, 59, 64]) // the repeated chord needs a fresh press
  expect(await beat()).toBe(0.5)
  expect(await page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(0)
  await region.getByRole('button', { name: 'Stop', exact: true }).click()
})

test('player: Play along keeps moving and only sounds the score when the guide is on', async ({ page }) => {
  await page.goto('/')
  const region = page.getByRole('region', { name: 'Piece player', exact: true })
  await page.getByLabel('Section', { exact: true }).selectOption('0')
  await region.getByRole('button', { name: 'Play along', exact: true }).click()
  await expect(page.getByTestId('player-status')).toContainText('Count-in')
  await expect.poll(() => page.evaluate(() => window.__piano.player.beat), { timeout: 15000 }).toBeGreaterThan(1)
  await expect(page.getByTestId('player-status')).toContainText('Playing along')
  expect(await page.evaluate(() => window.__piano.engine.piano!.activeVoices)).toBe(0)
  await page.getByLabel('Hear the piece while I play', { exact: true }).check()
  await region.getByRole('button', { name: 'Play along', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__piano.engine.piano!.activeVoices), { timeout: 15000 }).toBeGreaterThan(0)
  await region.getByRole('button', { name: 'Stop', exact: true }).click()
})
