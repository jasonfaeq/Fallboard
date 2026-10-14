import { expect, test } from '@playwright/test'

test('the app opens on a built-in piece, drawn as sheet music', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Prelude in E minor, Op. 28 No. 4' })).toBeVisible()
  await expect(page.getByTestId('sheet').locator('svg')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Piano keyboard' })).toBeVisible()
  expect(errors).toEqual([])
})
