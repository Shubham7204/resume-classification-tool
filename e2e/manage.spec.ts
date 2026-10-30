import path from 'path'
import type { Page } from '@playwright/test'
import type { Db } from '@/lib/types'
import { applicationsOf, createDrive, expect, readDb, resetDb, SAMPLES, test, waitForSaved, waitForScoring } from './helpers'

// A college that sent only resumes (no sheet), plus editing and deleting drives, roles and people.

const COLLEGE = 'DJ Sanghvi College of Engineering'
const RESUMES = ['ishita-bansal', 'tanya-mishra', 'diya-menon', 'zoya-khan', 'rajat-verma', 'aman-tripathi']

test.describe.configure({ mode: 'serial' })

let page: Page
let driveId: string
const drive = (db: Db) => ({
  roles: db.openings.filter((o) => o.driveId === driveId),
  students: db.candidates.filter((c) => c.driveId === driveId)
})

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await resetDb(page)
})
test.afterAll(async () => page.close())

test('resumes only, no sheet: every student is scored against every role and gets a best fit', async () => {
  driveId = await createDrive(page, COLLEGE, ['AI Engineer, Agentic Systems', 'Business Analyst, Graduate Trainee'])

  await page.locator('input[type=file][accept=".pdf"]').setInputFiles(RESUMES.map((r) => path.join(SAMPLES, 'campus-drive/resumes', `${r}.pdf`)))
  await expect(page.getByText(`${RESUMES.length}/${RESUMES.length} read`)).toBeVisible({ timeout: 90_000 })
  // Without a sheet there is no "roles opted", so matching every role is the only option.
  await expect(page.getByRole('button', { name: /The roles they opted for/ })).toBeDisabled()
  await page.getByRole('button', { name: `Add ${RESUMES.length} students and score them` }).click()

  await waitForSaved(page, (db) => drive(db).students.length === RESUMES.length)
  await waitForScoring(page)
  const db = await readDb(page)
  for (const s of drive(db).students) {
    expect(s.record, `${s.name} has no college record`).toBeUndefined()
    expect(applicationsOf(db, s.name)).toHaveLength(2)
  }

  const bestFit = (name: string) => page.locator('tbody tr', { hasText: name }).locator('td').nth(3)
  await expect(bestFit('Ishita Bansal')).toContainText('Business Analyst')
  await expect(bestFit('Diya Menon')).toContainText('AI Engineer')
  await expect(page.locator('tbody tr', { hasText: 'Diya Menon' })).toContainText('(self)') // CGPA from the resume
})

test('edit the drive: the new name reaches its students', async () => {
  await page.getByRole('button', { name: 'Edit' }).first().click()
  await page.getByLabel('College').fill('D. J. Sanghvi College of Engineering')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'D. J. Sanghvi College of Engineering' })).toBeVisible()
  await waitForSaved(page, (db) => drive(db).students.every((s) => s.college === 'D. J. Sanghvi College of Engineering'))
})

test('edit a role’s rubric: its applicants are re-scored against the new rubric', async () => {
  const ai = drive(await readDb(page)).roles.find((o) => o.title.startsWith('AI Engineer'))!
  await page.getByRole('link', { name: `Edit ${ai.title}` }).click()
  await expect(page.getByRole('heading', { name: `Edit ${ai.title}` })).toBeVisible()
  const before = await page.getByLabel('Check name').count()
  await page.getByRole('button', { name: 'Remove check' }).last().click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.waitForURL(new RegExp(`/hr/campus/${driveId}$`))
  // The edit (and the cleared scores) must reach the database before a full page load.
  await waitForSaved(page, (db) => db.openings.find((o) => o.id === ai.id)?.rubric.length === before - 1)

  // Opening the role scores anything whose score was cleared.
  await page.goto(`/hr/openings/${ai.id}`)
  await waitForSaved(page, (db) => {
    const apps = db.applications.filter((a) => a.openingId === ai.id)
    return apps.length === RESUMES.length && apps.every((a) => a.evaluation?.results.length === before - 1)
  }, 90_000)
})

test('delete a candidate, then a role, then the whole drive', async () => {
  const rajat = (await readDb(page)).candidates.find((c) => c.name === 'Rajat Verma')!
  await page.goto(`/hr/candidates/${rajat.id}`)
  await page.getByRole('button', { name: 'Delete Rajat Verma' }).click()
  await expect(page.getByRole('dialog', { name: 'Delete Rajat Verma?' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete candidate' }).click()
  await page.waitForURL(new RegExp(`/hr/campus/${driveId}$`))
  await waitForSaved(page, (db) => !db.candidates.some((c) => c.id === rajat.id) && !db.applications.some((a) => a.candidateId === rajat.id))

  const ba = drive(await readDb(page)).roles.find((o) => o.title.startsWith('Business Analyst'))!
  await page.getByRole('button', { name: `Delete ${ba.title}` }).click()
  // Cancel first: nothing changes.
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  expect((await readDb(page)).openings.some((o) => o.id === ba.id)).toBe(true)
  await page.getByRole('button', { name: `Delete ${ba.title}` }).click()
  await page.getByRole('button', { name: 'Delete role' }).click()
  await waitForSaved(page, (db) => !db.openings.some((o) => o.id === ba.id) && !db.applications.some((a) => a.openingId === ba.id))

  // Keep one student in the talent pool; deleting the drive must not remove them.
  const diya = (await readDb(page)).candidates.find((c) => c.name === 'Diya Menon')!
  await page.goto(`/hr/candidates/${diya.id}`)
  await page.getByRole('button', { name: 'Add to talent pool' }).click()
  await waitForSaved(page, (db) => db.candidates.some((c) => c.id === diya.id && c.inPool))

  await page.goto(`/hr/campus/${driveId}`)
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('1 student already in the talent pool will be kept')
  await page.getByRole('button', { name: 'Delete drive' }).click()
  await page.waitForURL(/\/hr\/campus$/)
  await waitForSaved(page, (db) => !db.drives.some((d) => d.id === driveId))
  const db = await readDb(page)
  expect(db.openings.filter((o) => o.driveId === driveId)).toHaveLength(0)
  expect(db.candidates.map((c) => c.name)).toEqual(['Diya Menon'])
  expect(db.candidates[0].driveId).toBeUndefined()
  expect(db.applications).toHaveLength(0)
})
