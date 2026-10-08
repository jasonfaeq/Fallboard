import { expect, test } from '@playwright/test'

const key = (note: number) => `.key[data-note="${note}"]`

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.__piano)
})

test('input: the computer keyboard plays notes and the pedal', async ({ page }) => {
  await page.keyboard.down('a')
  await expect(page.locator(key(60))).toHaveClass(/held/)
  await page.keyboard.up('a')
  await expect(page.locator(key(60))).not.toHaveClass(/held/)

  // a key released after an octave shift still releases the note it started
  await page.keyboard.down('w')
  await page.keyboard.press('x')
  await page.keyboard.up('w')
  await expect(page.locator(key(61))).not.toHaveClass(/held/)
  await page.keyboard.down('a')
  await expect(page.locator(key(72))).toHaveClass(/held/)
  await page.keyboard.up('a')

  await page.keyboard.down(' ')
  await expect(page.getByTestId('pedal')).toHaveText('Sustain pedal down')
  await page.keyboard.up(' ')
  await expect(page.getByTestId('pedal')).toHaveText('Sustain pedal up')
})

test('input: raw MIDI messages become note events and monitor facts', async ({ page }) => {
  const events = await page.evaluate(() => {
    const { input } = window.__piano
    const seen: string[] = []
    input.on((e) => seen.push(e.type === 'pedal' ? `pedal ${e.down}` : `${e.type} ${e.note}`))
    input.handleBytes([0x90, 21, 12], 1) // lowest key, soft, channel 1
    input.handleBytes([0x93, 108, 120], 2) // highest key, hard, channel 4
    input.handleBytes([0x90, 21, 0], 3) // note on with velocity 0 = key up
    input.handleBytes([0x83, 108, 64], 4) // note off
    input.handleBytes([0xb0, 64, 127], 5) // sustain down
    input.handleBytes([0xb0, 64, 0], 6) // sustain up
    input.handleBytes([0xfe], 7) // active sensing: ignored
    return seen
  })
  expect(events).toEqual(['on 21', 'on 108', 'off 21', 'off 108', 'pedal true', 'pedal false'])
  await expect(page.locator('.facts')).toContainText('A0 (21) to C8 (108)')
  await expect(page.locator('.facts')).toContainText('12 to 120')
  await expect(page.locator('.facts')).toContainText('note off')
  await expect(page.locator('.facts')).toContainText('on/off (values 0, 127)')
  await expect(page.locator('.log tr')).toHaveCount(6)
})
