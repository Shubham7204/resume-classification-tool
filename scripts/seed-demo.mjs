// Fills an empty database with the Kestrel Capital demo by driving the real app in Chrome:
// the SDE-2 careers role with 20 applicants, and one campus drive (King's College,
// 2027 batch) with 3 roles and 41 registered students (40 resumes). Every resume is
// parsed, stored in object storage and scored by Jev, exactly as an HR user would do it.
//
// Usage: start the app (pnpm dev), then  node scripts/seed-demo.mjs [baseUrl]
// Refuses to run if the database already has data, so it never creates duplicates.

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const COLLEGE = "King's College"
const SAMPLES = join(import.meta.dirname, '..', 'samples')
const pdfs = (dir) => readdirSync(join(SAMPLES, dir)).filter((f) => f.endsWith('.pdf')).map((f) => join(SAMPLES, dir, f))

const CAREERS = [
  ['Karan Mehta', 'karan.mehta.dev@gmail.com', 'karan-mehta'], ['Revathi Iyer', 'revathi.iyer.eng@gmail.com', 'revathi-iyer'],
  ['Siddhant Arora', 'siddhant.arora.go@gmail.com', 'siddhant-arora'], ['Faisal Ahmed', 'faisal.ahmed.cpp@gmail.com', 'faisal-ahmed'],
  ['Varsha Nair', 'varsha.nair.platform@gmail.com', 'varsha-nair'], ['Bhavna Chawla', 'bhavna.chawla.py@gmail.com', 'bhavna-chawla'],
  ['Nikhil Bose', 'nikhilbose.eng@gmail.com', 'nikhil-bose'], ['Akash Deshmukh', 'akash.deshmukh.node@gmail.com', 'akash-deshmukh'],
  ['Hemant Joshi', 'hemant.joshi.em@gmail.com', 'hemant-joshi'], ['Manoj Kumar', 'manoj.kumar.java@gmail.com', 'manoj-kumar'],
  ['Pooja Raghavan', 'pooja.raghavan@outlook.com', 'pooja-raghavan'], ['Sumit Bhardwaj', 'sumit.bhardwaj.tech@gmail.com', 'sumit-bhardwaj'],
  ['Gautam Sinha', 'gautam.sinha.dev@gmail.com', 'gautam-sinha'], ['Ishaan Malhotra', 'ishaan.malhotra@outlook.com', 'ishaan-malhotra'],
  ['Devansh Agarwal', 'devansh.agarwal.ml@gmail.com', 'devansh-agarwal'], ['Ruchi Pandey', 'ruchi.pandey.qa@gmail.com', 'ruchi-pandey'],
  ['Deepika Rao', 'deepika.rao.android@gmail.com', 'deepika-rao'], ['Meera Pillai', 'meera.pillai.ai@gmail.com', 'meera-pillai'],
  ['Tanvi Deshpande', 'tanvi.deshpande26@gmail.com', 'tanvi-deshpande'], ['Farhan Qureshi', 'farhan.q.analytics@gmail.com', 'farhan-qureshi']
]

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
const readDb = async () => (await page.request.get(`${BASE}/api/db`)).json()
const until = async (label, check, timeoutMs = 300_000) => {
  const start = Date.now()
  while (!check(await readDb())) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for: ${label}`)
    await page.waitForTimeout(1000)
  }
  console.log(`  ✓ ${label} (${((Date.now() - start) / 1000).toFixed(0)}s)`)
}

try {
  const existing = await readDb()
  const rows = existing.openings.length + existing.candidates.length
  if (rows > 0) throw new Error(`The database already has ${existing.openings.length} roles and ${existing.candidates.length} people. Not seeding.`)

  console.log('1/3 Careers role: SDE-2 Backend')
  await page.goto(`${BASE}/hr`)
  await page.getByRole('button', { name: 'Load sample careers role' }).click()
  await until('careers role saved', (d) => d.openings.length === 1)

  console.log(`2/3 Campus drive: ${COLLEGE}, 3 roles, 41 students, 40 resumes`)
  await page.goto(`${BASE}/hr/campus/new`)
  await page.getByLabel('College').fill(COLLEGE)
  await page.getByLabel('Batch').fill('2027')
  await page.getByRole('button', { name: 'Create drive' }).click()
  await page.waitForURL(/\/hr\/campus\/dr_/)
  const copy = page.getByLabel('Copy a role')
  for (const title of ['AI Engineer, Agentic Systems', 'Data Scientist, Graduate Trainee', 'Business Analyst, Graduate Trainee']) {
    await copy.selectOption({ label: title })
    await page.getByRole('button', { name: 'Copy', exact: true }).click()
  }
  await until('3 campus roles saved', (d) => d.openings.filter((o) => o.source === 'campus').length === 3)
  await page.locator('input[type=file][accept=".pdf"]').setInputFiles(pdfs('campus-drive/resumes'))
  await page.locator('input[type=file][accept=".xlsx,.csv"]').setInputFiles(join(SAMPLES, 'campus-drive/kings-2027-registrations.xlsx'))
  // Parsing is done when the "n/40 read" line stops spinning; LLM rate limits can make this slow.
  const readLine = page.locator('p', { hasText: /\/40 read/ })
  await readLine.waitFor({ timeout: 60_000 })
  await readLine.locator('.animate-spin').waitFor({ state: 'detached', timeout: 1_200_000 })
  const readText = (await readLine.innerText()).trim()
  console.log(`  ✓ ${readText}`)
  if (!readText.startsWith('40/40')) throw new Error(`Some resumes could not be read: ${readText}`)
  await page.getByRole('button', { name: /Add 41 students/ }).click()
  await until('41 students saved', (d) => d.candidates.length === 41 && d.applications.length > 0)
  await until('every campus application scored', (d) => d.applications.every((a) => a.evaluation || a.evaluationError), 900_000)

  console.log('3/3 Careers page: 20 applicants for SDE-2')
  for (const [name, email, file] of CAREERS) {
    await page.goto(`${BASE}/careers`)
    await page.getByRole('link', { name: /Software Development Engineer 2/ }).click()
    await page.getByLabel('Full name').fill(name)
    await page.getByLabel('Email').fill(email)
    await page.locator('input[type=file]').setInputFiles(join(SAMPLES, 'careers/resumes', `${file}.pdf`))
    await page.getByRole('button', { name: 'Submit application' }).click()
    await page.getByText('Application received').waitFor({ timeout: 120_000 })
    process.stdout.write('.')
  }
  console.log()
  await until('20 applicants saved and scored', (d) => d.candidates.filter((c) => c.source === 'careers').length === 20)

  const d = await readDb()
  console.log(`\nDone: ${d.openings.length} roles, ${d.drives.length} drive, ${d.candidates.length} people, ${d.applications.length} applications.`)
} catch (err) {
  console.error(`\nSeeding stopped: ${err.message}`)
  process.exitCode = 1
} finally {
  await browser.close()
}
