import path from 'path'
import type { Page } from '@playwright/test'
import type { Db } from '@/lib/types'
import { applicationFor, expect, loadSampleCareersRole, readDb, SAMPLES, test, waitForSaved } from './helpers'

const SDE2 = 'KC-CAR-26-SDE2'

// Name, email typed into the form, resume file.
const APPLICANTS: Array<[string, string, string]> = [
  ['Karan Mehta', 'karan.mehta.dev@gmail.com', 'karan-mehta'],
  ['Revathi Iyer', 'revathi.iyer.eng@gmail.com', 'revathi-iyer'],
  ['Siddhant Arora', 'siddhant.arora.go@gmail.com', 'siddhant-arora'],
  ['Faisal Ahmed', 'faisal.ahmed.cpp@gmail.com', 'faisal-ahmed'],
  ['Varsha Nair', 'varsha.nair.platform@gmail.com', 'varsha-nair'],
  ['Bhavna Chawla', 'bhavna.chawla.py@gmail.com', 'bhavna-chawla'],
  ['Nikhil Bose', 'nikhilbose.eng@gmail.com', 'nikhil-bose'],
  ['Akash Deshmukh', 'akash.deshmukh.node@gmail.com', 'akash-deshmukh'],
  ['Hemant Joshi', 'hemant.joshi.em@gmail.com', 'hemant-joshi'],
  ['Manoj Kumar', 'manoj.kumar.java@gmail.com', 'manoj-kumar'],
  ['Pooja Raghavan', 'pooja.raghavan@outlook.com', 'pooja-raghavan'],
  ['Sumit Bhardwaj', 'sumit.bhardwaj.tech@gmail.com', 'sumit-bhardwaj'],
  ['Gautam Sinha', 'gautam.sinha.dev@gmail.com', 'gautam-sinha'],
  ['Ishaan Malhotra', 'ishaan.malhotra@outlook.com', 'ishaan-malhotra'],
  ['Devansh Agarwal', 'devansh.agarwal.ml@gmail.com', 'devansh-agarwal'],
  ['Ruchi Pandey', 'ruchi.pandey.qa@gmail.com', 'ruchi-pandey'],
  ['Deepika Rao', 'deepika.rao.android@gmail.com', 'deepika-rao'],
  ['Meera Pillai', 'meera.pillai.ai@gmail.com', 'meera-pillai'],
  ['Tanvi Deshpande', 'tanvi.deshpande26@gmail.com', 'tanvi-deshpande'],
  ['Farhan Qureshi', 'farhan.q.analytics@gmail.com', 'farhan-qureshi']
]

test.describe.configure({ mode: 'serial' })

let page: Page
let db: Db

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await loadSampleCareersRole(page)
})

test.afterAll(async () => page.close())

test('20 people apply for SDE-2 through the public careers page', async () => {
  for (const [name, email, file] of APPLICANTS) {
    await page.goto('/careers')
    await page.getByRole('link', { name: /Software Development Engineer 2/ }).click()
    await page.getByLabel('Full name').fill(name)
    await page.getByLabel('Email').fill(email)
    await page.locator('input[type=file]').setInputFiles(path.join(SAMPLES, 'careers/resumes', `${file}.pdf`))
    await page.getByRole('button', { name: 'Submit application' }).click()
    await expect(page.getByText('Application received'), name).toBeVisible({ timeout: 60_000 })
  }

  db = await readDb(page)
  expect(db.candidates).toHaveLength(20)
  expect(db.candidates.every((c) => c.inPool && c.source === 'careers')).toBe(true)
  // Scoring finished before "Application received", so nothing is lost if the applicant leaves.
  expect(db.applications.filter((a) => !a.evaluation).length).toBe(0)
})

test('the ranking puts experienced backend engineers on top and weak fits at the bottom', async () => {
  const score = (name: string) => applicationFor(db, name, SDE2).evaluation!
  for (const name of ['Karan Mehta', 'Revathi Iyer', 'Siddhant Arora']) expect(score(name).recommendation, name).toBe('INTERVIEW')
  for (const name of ['Farhan Qureshi', 'Deepika Rao', 'Ruchi Pandey', 'Meera Pillai', 'Tanvi Deshpande']) {
    expect(score(name).recommendation, name).not.toBe('INTERVIEW')
  }

  // Strong but too junior: the 3+ years must-have caps them below Interview.
  for (const name of ['Nikhil Bose', 'Gautam Sinha']) {
    const ev = score(name)
    expect(ev.recommendation, name).not.toBe('INTERVIEW')
    expect(ev.results.some((r) => r.mustHave && r.value < 0.5), `${name} misses a must-have`).toBe(true)
  }

  const ranked = [...db.applications].sort((a, b) => b.evaluation!.fitScore - a.evaluation!.fitScore)
  const name = (id: string) => db.candidates.find((c) => c.id === id)!.name
  const top5 = ranked.slice(0, 5).map((a) => name(a.candidateId))
  expect(top5).toContain('Karan Mehta')
  const bottom5 = ranked.slice(-5).map((a) => name(a.candidateId))
  expect(bottom5.some((n) => ['Farhan Qureshi', 'Deepika Rao', 'Ruchi Pandey'].includes(n))).toBe(true)
})

test('HR reviews the applicant list, decides in one click and exports CSV', async () => {
  const sde2 = db.openings.find((o) => o.reqId === SDE2)!
  await page.goto(`/hr/openings/${sde2.id}`)
  await expect(page.locator('tbody tr')).toHaveCount(20)

  const top = page.locator('tbody tr').first()
  await top.getByRole('button', { name: 'Shortlist' }).click()
  await page.locator('tbody tr').last().getByRole('button', { name: 'Reject' }).click()
  await waitForSaved(page, (d) => {
    const stages = d.applications.map((a) => a.stage)
    return stages.filter((s) => s === 'shortlisted').length === 1 && stages.filter((s) => s === 'rejected').length === 1
  })

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV' }).click()
  expect((await download).suggestedFilename()).toBe(`${SDE2}-applicants.csv`)
})
