import path from 'path'
import type { Page } from '@playwright/test'
import { checkEligibility, verificationFlags } from '@/lib/eligibility'
import type { Db } from '@/lib/types'
import { applicationFor, applicationsOf, createDrive, expect, pdfsIn, readDb, resetDb, SAMPLES, test, waitForSaved, waitForScoring } from './helpers'

const DS = 'KC-CAMP-27-DS'
const AI = 'KC-CAMP-27-AI'
const BA = 'KC-CAMP-27-BA'
const COLLEGE = "King's College"

test.describe.configure({ mode: 'serial' })

let page: Page
let db: Db

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await resetDb(page)
})

test.afterAll(async () => page.close())

test('create a drive, add its roles, import the college sheet and 40 resumes', async () => {
  const driveId = await createDrive(page, COLLEGE, [
    'Data Scientist, Graduate Trainee',
    'AI Engineer, Agentic Systems',
    'Business Analyst, Graduate Trainee'
  ])
  // Roles copied into the drive belong to it and take its batch.
  const roles = (await readDb(page)).openings.filter((o) => o.driveId === driveId)
  expect(roles.every((o) => o.rules.batch === 2027 && o.source === 'campus')).toBe(true)

  await page.locator('input[type=file][accept=".xlsx,.csv"]').setInputFiles(path.join(SAMPLES, 'campus-drive/kings-2027-registrations.xlsx'))
  await expect(page.locator('strong', { hasText: '41 students' })).toBeVisible()

  // Every "roles opted" label maps to one of the three campus roles.
  for (const [label, role] of [
    ['Data Scientist', 'Data Scientist, Graduate Trainee'],
    ['AI Engineer', 'AI Engineer, Agentic Systems'],
    ['Business Analyst', 'Business Analyst, Graduate Trainee']
  ]) {
    const row = page.locator('div.rounded-xl').filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) })
    const select = row.locator('select')
    await expect(select.locator('option:checked')).toHaveText(role)
  }

  await page.locator('input[type=file][accept=".pdf"]').setInputFiles(pdfsIn('campus-drive/resumes'))
  await expect(page.getByText('40/40 read')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('40 resumes matched to the sheet')).toBeVisible()
  await expect(page.getByText('1 on the sheet without a resume')).toBeVisible()

  const started = Date.now()
  await page.getByRole('button', { name: /Add 41 students/ }).click()
  await expect(page.getByRole('heading', { name: COLLEGE })).toBeVisible()
  await waitForSaved(page, (d) => d.candidates.length === 41 && d.applications.length > 0)
  await waitForScoring(page)
  db = await readDb(page)
  test.info().annotations.push({ type: 'timing', description: `${db.applications.length} applications scored in ${((Date.now() - started) / 1000).toFixed(1)}s` })
  console.log(test.info().annotations.at(-1)!.description)

  expect(db.candidates).toHaveLength(41)
  expect(db.candidates.filter((c) => c.profile?.fileKey?.startsWith('resumes/'))).toHaveLength(40) // originals kept in object storage
  expect(db.candidates.filter((c) => c.inPool)).toHaveLength(0) // campus students stay out of the talent pool
  const errors = db.applications.filter((a) => a.evaluationError)
  expect(errors.map((a) => db.candidates.find((c) => c.id === a.candidateId)!.name)).toEqual(['Karthik Rao'])
})

test('eligibility comes from the college record, not the resume', async () => {
  const failed = (name: string, reqId: string) => {
    const a = applicationFor(db, name, reqId)
    const candidate = db.candidates.find((c) => c.id === a.candidateId)!
    return checkEligibility(candidate, a.opening.rules).checks.filter((c) => c.status === 'fail').map((c) => c.rule)
  }
  expect(failed('Neha Gupta', AI)).toContain('Active backlogs')
  expect(failed('Mohit Yadav', AI)).toContain('Active backlogs')
  expect(failed('Nikita Agarwal', DS)).toContain('Class XII') // 68.4% < 70%
  expect(failed('Nikita Agarwal', AI)).toEqual([]) // AI has no school cutoff
  for (const name of ['Vikram Singh', 'Omkar Patil', 'Sara Thomas', 'Tejas Kulkarni']) expect(failed(name, DS)).toContain('Branch')
  expect(failed('Sara Thomas', BA)).toEqual([]) // BA is open to all branches
  expect(failed('Harshit Goyal', BA)).toContain('CGPA') // 6.31 < 6.5
  expect(failed('Siddharth Joshi', AI)).toContain('CGPA') // 6.78 < 7.0
  expect(failed('Farah Ali', AI)).toContain('Batch') // 2026 batch
  expect(failed('Ananya Iyer', AI)).toEqual([])
})

test('resumes that disagree with the college record are flagged for verification', async () => {
  const flagged = db.candidates.filter((c) => verificationFlags(c).some((f) => f.kind === 'cgpa_mismatch')).map((c) => c.name)
  expect(flagged.sort()).toEqual(['Arjun Reddy', 'Devika Nair', 'Ritu Sharma'])
  const neha = db.candidates.find((c) => c.name === 'Neha Gupta')!
  expect(verificationFlags(neha).map((f) => f.kind)).toContain('undisclosed_backlog')
})

test('Jev scores match a human read of the resumes', async () => {
  const rec = (name: string, reqId: string) => applicationFor(db, name, reqId).evaluation!.recommendation

  for (const [name, reqId] of [['Ananya Iyer', AI], ['Diya Menon', AI], ['Sneha Kulkarni', DS], ['Arnav Joshi', DS], ['Ishita Bansal', BA], ['Tanya Mishra', BA]]) {
    expect(rec(name, reqId), `${name} for ${reqId}`).toBe('INTERVIEW')
  }
  for (const [name, reqId] of [['Rohan Das', DS], ['Rajat Verma', AI], ['Rajat Verma', DS], ['Pranav Shetty', DS], ['Yuvraj Chauhan', AI]]) {
    expect(rec(name, reqId), `${name} for ${reqId}`).not.toBe('INTERVIEW')
  }
  // One person, different verdicts per role.
  expect(applicationFor(db, 'Sneha Kulkarni', DS).evaluation!.fitScore).toBeGreaterThan(applicationFor(db, 'Sneha Kulkarni', AI).evaluation!.fitScore + 30)
  // Every evaluation shows its working: points add up to the fit score.
  for (const a of db.applications.filter((x) => x.evaluation)) {
    const sum = a.evaluation!.results.reduce((s, r) => s + r.contribution, 0)
    expect(Math.abs(Math.round(sum) - a.evaluation!.fitScore)).toBeLessThanOrEqual(1)
  }
})

test('drive page shows each student against each role, strongest first', async () => {
  const drive = db.drives[0]
  await page.goto(`/hr/campus/${drive.id}`)
  await expect(page.getByText('41', { exact: true }).first()).toBeVisible()
  const firstRow = page.locator('tbody tr').first()
  await expect(firstRow).not.toContainText('Karthik Rao')
  await expect(page.locator('tbody tr', { hasText: 'Karthik Rao' })).toContainText('No resume')
  await expect(page.locator('tbody tr', { hasText: 'Harshit Goyal' })).toContainText('Not eligible: CGPA')
  await expect(page.locator('tbody tr', { hasText: 'Arjun Reddy' })).toContainText('Verify')
})

test('candidate page shows the score breakdown and one-click decisions persist', async () => {
  const ishita = db.candidates.find((c) => c.name === 'Ishita Bansal')!
  await page.goto(`/hr/candidates/${ishita.id}`)
  await expect(page.getByText('How the score was computed')).toBeVisible()
  const fit = applicationFor(db, 'Ishita Bansal', BA).evaluation!.fitScore
  await expect(page.locator('td', { hasText: /^Fit score$/ }).locator('xpath=following-sibling::td')).toHaveText(String(fit))

  await page.getByRole('button', { name: 'Shortlist' }).click()
  await waitForSaved(page, (d) => applicationFor(d, 'Ishita Bansal', BA).stage === 'shortlisted')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Shortlist' })).toHaveAttribute('aria-pressed', 'true')
})

test('applicant list filters and a campus student can be added to the talent pool', async () => {
  const ds = db.openings.find((o) => o.reqId.startsWith(`${DS}-`))!
  await page.goto(`/hr/openings/${ds.id}`)
  await page.getByRole('button', { name: /^Not eligible/ }).click()
  await expect(page.locator('tbody tr', { hasText: 'Vikram Singh' })).toBeVisible()
  await expect(page.locator('tbody tr', { hasText: 'Kavya Menon' })).toHaveCount(0)

  const diya = db.candidates.find((c) => c.name === 'Diya Menon')!
  await page.goto(`/hr/candidates/${diya.id}`)
  await page.getByRole('button', { name: 'Add to talent pool' }).click()
  await expect(page.getByText('In talent pool')).toBeVisible()
  await waitForSaved(page, (d) => d.candidates.some((c) => c.name === 'Diya Menon' && c.inPool))
  await page.goto('/hr/pool')
  await expect(page.getByRole('link', { name: 'Diya Menon' })).toBeVisible()
  expect((await readDb(page)).candidates.filter((c) => c.inPool).map((c) => c.name)).toEqual(['Diya Menon'])
  expect(applicationsOf(db, 'Diya Menon')).toHaveLength(1)
})
