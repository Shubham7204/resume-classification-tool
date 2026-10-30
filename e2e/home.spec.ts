import { expect, test } from './helpers'

test('homepage explains Jev with a live walkthrough that reaches a decision', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Screen a resume in under a second')
  await expect(page.getByText('Powered by TypeSafe Jev')).toBeVisible()

  // The demo cycles resume → Jev answers → weighted points → decision.
  await expect(page.getByText('Jev answers every check, in parallel')).toBeVisible()
  await expect(page.getByText(/^(Interview|Screen|Hold)$/).first()).toBeVisible({ timeout: 10_000 })

  await expect(page.getByRole('heading', { name: /in one click/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /like a colleague/ })).toBeVisible()
})

test('homepage navigation reaches the HR workspace and careers page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation').getByRole('link', { name: 'Open HR workspace' }).click()
  await expect(page).toHaveURL(/\/hr$/)
  await expect(page.getByRole('heading', { name: /Hiring/ })).toBeVisible()

  await page.goto('/')
  await page.getByRole('link', { name: 'See the careers page' }).click()
  await expect(page).toHaveURL(/\/careers$/)
})

test('pages fit a phone screen without sideways scrolling @mobile', async ({ page }) => {
  for (const path of ['/', '/careers', '/hr', '/hr/campus', '/hr/pool', '/hr/openings/new']) {
    await page.goto(path)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1)
  }
})
