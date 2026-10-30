import { expect, pdfsIn, readDb, resetDb, test, waitForSaved } from './helpers'

test('HR bulk-uploads resumes and asks the talent pool in plain English', async ({ page }) => {
  await resetDb(page)
  await page.goto('/hr/pool')
  await expect(page.getByText('The pool is empty')).toBeVisible()

  await page.locator('input[type=file][accept=".pdf"]').setInputFiles(pdfsIn('talent-pool/resumes'))
  await expect(page.getByRole('heading', { name: /^41 people/ })).toBeVisible({ timeout: 90_000 })
  await waitForSaved(page, (d) => d.candidates.length === 41)
  expect((await readDb(page)).candidates.every((c) => c.inPool && c.source === 'hr_upload')).toBe(true)

  await page.getByLabel('Ask the talent pool').fill('I work with data a lot. I need someone with deep SQL knowledge who can join immediately.')
  await page.getByRole('button', { name: 'Ask' }).click()
  await expect(page.getByText(/41 resumes · .*s · planned by/)).toBeVisible({ timeout: 90_000 })

  const results = page.locator('table').first()
  const firstTwo = (await results.locator('tbody tr a').allTextContents()).slice(0, 2)
  expect(firstTwo).toContain('Harsh Vardhan')
  await expect(page.getByText('Close, but missing a must-have')).toBeVisible()
  // The written answer names the best match and is grounded in the results.
  await expect(page.locator('p.text-\\[15px\\]')).toContainText('Harsh Vardhan')

  // Keyword filter narrows the list below.
  await page.getByPlaceholder('Filter by keyword: skills, companies, colleges…').fill('kafka')
  const names = await page.locator('table').last().locator('tbody a.font-medium').allTextContents()
  expect(names).toContain('Rakesh Nambiar')
  expect(names).not.toContain('Yash Patel')
})
