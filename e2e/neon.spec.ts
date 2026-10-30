import path from 'path'
import { expect, readDb, resetDb, SAMPLES, test, waitForSaved } from './helpers'

// Proves each Neon service end to end through the running app.

test('health check: Postgres round trip and an object storage write/read/delete', async ({ request }) => {
  const res = await request.get('/api/health')
  const body = await res.json()
  expect(res.status(), JSON.stringify(body)).toBe(200)
  expect(body.branch).toBe('e2e')
  expect(body.database.ok).toBe(true)
  expect(body.database.version).toMatch(/^\d+/)
  expect(body.storage.ok).toBe(true)
})

test('data lives in Postgres: a second browser sees what the first one saved', async ({ page, browser }) => {
  await resetDb(page)
  await page.goto('/hr')
  await page.getByRole('button', { name: 'Load sample careers role' }).click()
  await waitForSaved(page, (db) => db.openings.length === 1)

  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await otherPage.goto('/hr/openings')
  await expect(otherPage.getByRole('link', { name: 'Software Development Engineer 2, Backend', exact: true })).toBeVisible()
  await other.close()
})

test('object storage: an uploaded resume is stored and its original PDF can be opened', async ({ page }) => {
  await resetDb(page)
  await page.goto('/hr')
  await page.getByRole('button', { name: 'Load sample careers role' }).click()
  await waitForSaved(page, (db) => db.openings.length === 1)

  await page.goto('/careers')
  await page.getByRole('link', { name: /Software Development Engineer 2/ }).click()
  await page.getByLabel('Full name').fill('Karan Mehta')
  await page.getByLabel('Email').fill('karan.mehta.dev@gmail.com')
  await page.locator('input[type=file]').setInputFiles(path.join(SAMPLES, 'careers/resumes/karan-mehta.pdf'))
  await page.getByRole('button', { name: 'Submit application' }).click()
  await expect(page.getByText('Application received')).toBeVisible({ timeout: 60_000 })

  const karan = (await readDb(page)).candidates.find((c) => c.name === 'Karan Mehta')!
  expect(karan.profile?.fileKey).toMatch(/^resumes\/.+karan-mehta\.pdf$/)

  // The app hands out a short-lived signed link into the bucket...
  const redirect = await page.request.get(`/api/files?key=${encodeURIComponent(karan.profile!.fileKey!)}`, { maxRedirects: 0 })
  expect(redirect.status()).toBe(302)
  const signed = redirect.headers()['location']
  expect(signed).toContain(`/assets/${karan.profile!.fileKey}`)
  expect(signed).toContain('X-Amz-Signature=')

  // ...and following it returns the original PDF. (Retried: DNS lookups on this network fail intermittently.)
  let pdf: Awaited<ReturnType<typeof page.request.get>> | undefined
  await expect(async () => {
    pdf = await page.request.get(signed)
  }).toPass({ timeout: 30_000, intervals: [1000, 2000, 4000] })
  expect(pdf!.status()).toBe(200)
  expect(pdf!.headers()['content-type']).toContain('application/pdf')
  expect((await pdf!.body()).subarray(0, 5).toString()).toBe('%PDF-')

  // Keys outside the app's folders are refused.
  expect((await page.request.get('/api/files?key=../secrets.txt', { maxRedirects: 0 })).status()).toBe(404)

  await page.goto(`/hr/candidates/${karan.id}`)
  await expect(page.getByRole('link', { name: 'Original resume (PDF)' })).toBeVisible()
})
