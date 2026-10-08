import { expect, test } from '@playwright/test'

test('the app opens', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Piano Trainer' })).toBeVisible()
})
