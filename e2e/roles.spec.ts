import path from 'path'
import { createDrive, expect, loadSampleCareersRole, readDb, resetDb, SAMPLES, test, waitForSaved } from './helpers'

test('sample careers role is published; campus roles never appear on the careers page', async ({ page }) => {
  await loadSampleCareersRole(page)
  const db = await readDb(page)
  expect(db.openings.map((o) => o.reqId)).toEqual(['KC-CAR-26-SDE2'])

  await createDrive(page, 'Test College of Engineering', ['Data Scientist, Graduate Trainee'])
  await page.goto('/careers')
  await expect(page.getByRole('link', { name: /Software Development Engineer 2/ })).toBeVisible()
  await expect(page.getByText('Data Scientist, Graduate Trainee')).toHaveCount(0)
})

test('HR creates a careers role from a JD PDF; the agent drafts a rubric HR can edit', async ({ page }) => {
  await resetDb(page)
  await page.goto('/hr/openings/new')

  const draft = page.getByRole('button', { name: 'Draft screening rubric' })
  await expect(draft).toBeDisabled() // no title or JD yet

  await page.getByPlaceholder('e.g. Associate Software Engineer').fill('Business Analyst, Graduate Trainee')
  await page.getByPlaceholder('e.g. Bengaluru').fill('Mumbai')
  await page.locator('input[type=file]').setInputFiles(path.join(SAMPLES, 'campus-drive/job-descriptions/kc-campus-business-analyst.pdf'))
  await draft.click()

  await expect(page.getByText('3. Screening rubric')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Drafted by/)).toBeVisible()
  const checks = page.getByLabel('Check name')
  expect(await checks.count()).toBeGreaterThanOrEqual(3)

  // College cutoffs don't apply to careers-page hiring, so the panel is hidden.
  await expect(page.getByText('Eligibility rules')).toHaveCount(0)

  // HR edits the draft: remove one check and rename another.
  const before = await checks.count()
  await page.getByRole('button', { name: 'Remove check' }).last().click()
  await expect(checks).toHaveCount(before - 1)
  await checks.first().fill('Case-solving ability')

  await page.getByRole('button', { name: 'Publish to careers page' }).click()
  await expect(page).toHaveURL(/\/hr\/openings\/op_/)
  await page.getByRole('button', { name: /Screening rubric/ }).click()
  await expect(page.getByText('Case-solving ability')).toBeVisible()

  await waitForSaved(page, (db) => db.openings.length === 1)
  const opening = (await readDb(page)).openings[0]
  expect(opening.source).toBe('careers')
  expect(opening.rules).toEqual({})
  expect(opening.rubric).toHaveLength(before - 1)
  expect(opening.jdFileKey).toMatch(/^job-descriptions\/.+\.pdf$/) // the uploaded JD is kept in object storage

  await page.goto('/careers')
  await page.getByRole('link', { name: /Business Analyst, Graduate Trainee/ }).click()
  await expect(page.getByText('Structured problem solving', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit application' })).toBeDisabled()
})
