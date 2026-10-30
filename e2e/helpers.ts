import { readdirSync } from 'fs'
import path from 'path'
import { expect, test as base, type Page } from '@playwright/test'
import type { Db } from '@/lib/types'

export const SAMPLES = path.resolve(__dirname, '..', 'samples')

export function pdfsIn(dir: string) {
  const full = path.join(SAMPLES, dir)
  return readdirSync(full)
    .filter((f) => f.endsWith('.pdf'))
    .map((f) => path.join(full, f))
}

/** Every test fails if the page logs an error or throws. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      await use(errors)
      expect(errors, 'browser console errors').toEqual([])
    },
    { auto: true }
  ]
})
export { expect }

/** What's stored in Postgres right now (not the page's in-memory copy). */
export async function readDb(page: Page): Promise<Db> {
  const res = await page.request.get('/api/db')
  expect(res.ok(), 'GET /api/db').toBe(true)
  return res.json()
}

/** Empties the e2e branch's tables. The server refuses this on the production branch. */
export async function resetDb(page: Page) {
  const res = await page.request.post('/api/db', { data: { reset: true } })
  expect(res.ok(), `reset failed: ${await res.text()}`).toBe(true)
}

/** Waits until the page has pushed every pending change to the database. */
export async function waitForSaved(page: Page, check: (db: Db) => boolean, timeout = 30_000) {
  await expect.poll(async () => check(await readDb(page)), { timeout, intervals: [500] }).toBe(true)
}

/** Fresh database with the sample careers-page role (SDE-2). */
export async function loadSampleCareersRole(page: Page) {
  await resetDb(page)
  await page.goto('/hr')
  await page.getByRole('button', { name: 'Load sample careers role' }).click()
  await expect(page.getByRole('link', { name: /Software Development Engineer 2/ })).toBeVisible()
  await waitForSaved(page, (db) => db.openings.length === 1)
}

/** Creates a campus drive and copies the named templates into it; returns the drive id. */
export async function createDrive(page: Page, college: string, templates: string[]) {
  await page.goto('/hr/campus/new')
  await page.getByLabel('College').fill(college)
  await page.getByRole('button', { name: 'Create drive' }).click()
  await page.waitForURL(/\/hr\/campus\/dr_/)
  const driveId = page.url().split('/').pop()!
  for (const title of templates) {
    await page.getByLabel('Copy a role').selectOption({ label: title })
    await page.getByRole('button', { name: 'Copy' }).click()
  }
  await waitForSaved(page, (db) => db.openings.filter((o) => o.driveId === driveId).length === templates.length)
  return driveId
}

/** Waits until every application has a score or a recorded error. */
export async function waitForScoring(page: Page, timeout = 180_000) {
  await expect
    .poll(async () => (await readDb(page)).applications.filter((a) => !a.evaluation && !a.evaluationError).length, {
      timeout,
      intervals: [1000]
    })
    .toBe(0)
}

export function applicationsOf(db: Db, name: string) {
  const candidate = db.candidates.find((c) => c.name === name)
  if (!candidate) throw new Error(`No candidate named ${name}`)
  return db.applications
    .filter((a) => a.candidateId === candidate.id)
    .map((a) => ({ ...a, opening: db.openings.find((o) => o.id === a.openingId)! }))
}

/** `reqId` may be a template's id; copies into a drive get a drive suffix (KC-CAMP-27-DS-AB12). */
export function applicationFor(db: Db, name: string, reqId: string) {
  const app = applicationsOf(db, name).find((a) => a.opening.reqId === reqId || a.opening.reqId.startsWith(`${reqId}-`))
  if (!app) throw new Error(`${name} has no application for ${reqId}`)
  return app
}
