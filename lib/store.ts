'use client'

// Client copy of the data, synced with Postgres (app/api/db). The page loads everything once,
// every change applies here immediately, and only the changed rows are sent to the server,
// in order. Everything goes through `update`.

import { useSyncExternalStore } from 'react'
import { CAREERS_SAMPLES } from '@/lib/demo'
import type { ResumeProfile, Application, Candidate, Db, Drive, Evaluation, Opening, Stage } from '@/lib/types'
import { mapLimit, uid } from '@/lib/utils'

const TABLES = ['drives', 'openings', 'candidates', 'applications'] as const
type Table = (typeof TABLES)[number]
const EMPTY: Db = { openings: [], drives: [], candidates: [], applications: [] }

type Status = { state: 'loading' | 'ready' } | { state: 'error'; message: string }

let db: Db = EMPTY
let status: Status = { state: 'loading' }
let started = false
let saving: Promise<void> = Promise.resolve()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

function load() {
  if (started || typeof window === 'undefined') return
  started = true
  retry(async () => {
    const res = await fetch('/api/db', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? `Could not load data (${res.status})`)
    return data as Db
  })
    .then((data) => {
      // Re-apply anything changed locally while the load was in flight; the server's snapshot
      // may predate those writes.
      db = applyEarlyChanges(data)
      status = { state: 'ready' }
    })
    .catch((err: Error) => {
      status = { state: 'error', message: `Couldn’t reach the database: ${err.message}` }
    })
    .finally(notify)
}

// Rows changed before the initial load arrived, latest version per id (null = removed).
const earlyChanges = new Map<Table, Map<string, unknown | null>>()

function rememberEarlyChange(table: Table, id: string, row: unknown | null) {
  if (status.state === 'ready') return
  const rows = earlyChanges.get(table) ?? new Map<string, unknown | null>()
  rows.set(id, row)
  earlyChanges.set(table, rows)
}

function applyEarlyChanges(loaded: Db): Db {
  const next = { ...loaded }
  for (const [table, rows] of earlyChanges) {
    const list = (next[table] as Array<{ id: string }>).filter((r) => !rows.has(r.id))
    const added = [...rows.values()].filter((r): r is { id: string } => r !== null)
    ;(next[table] as Array<{ id: string }>) = [...added, ...list]
  }
  earlyChanges.clear()
  return next
}

function subscribe(listener: () => void) {
  load()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDb(): Db {
  return useSyncExternalStore(subscribe, () => db, () => EMPTY)
}

/** True once data has arrived from the server, so pages can avoid flashing an empty state. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => status.state === 'ready', () => false)
}

export function useSyncStatus(): Status {
  return useSyncExternalStore(subscribe, () => status, () => status)
}

type Batch = { upsert: Record<Table, unknown[]>; remove: Record<Table, string[]> }

// Changes waiting to be sent. Bursts (a 40-student import is ~100 updates) merge into one
// request; the latest version of each row wins, and a removal cancels a pending upsert.
const queued = { upsert: new Map<Table, Map<string, unknown>>(), remove: new Map<Table, Set<string>>() }
let flushScheduled = false

function update(change: (current: Db) => Db) {
  const before = db
  db = change(db)
  notify()
  enqueue(before, db)
}

function enqueue(before: Db, after: Db) {
  for (const table of TABLES) {
    const old = new Map<string, unknown>(before[table].map((r) => [r.id, r]))
    const ids = new Set(after[table].map((r) => r.id))
    const upserts = queued.upsert.get(table) ?? new Map<string, unknown>()
    const removes = queued.remove.get(table) ?? new Set<string>()
    // Rows are never mutated in place, so a new object means a changed row.
    for (const row of after[table]) {
      if (old.get(row.id) !== row) {
        upserts.set(row.id, row)
        removes.delete(row.id)
        rememberEarlyChange(table, row.id, row)
      }
    }
    for (const row of before[table]) {
      if (!ids.has(row.id)) {
        removes.add(row.id)
        upserts.delete(row.id)
        rememberEarlyChange(table, row.id, null)
      }
    }
    queued.upsert.set(table, upserts)
    queued.remove.set(table, removes)
  }
  if (!flushScheduled) {
    flushScheduled = true
    // Let the rest of a burst land, then send after any request already in flight. The batch is
    // taken when it's this request's turn, so everything queued during a slow save goes in one.
    setTimeout(() => {
      flushScheduled = false
      saving = saving.then(() => save(takeBatch()))
    }, 50)
  }
}

function takeBatch(): Batch | null {
  const batch = { upsert: {}, remove: {} } as Batch
  let any = false
  for (const table of TABLES) {
    batch.upsert[table] = [...(queued.upsert.get(table)?.values() ?? [])]
    batch.remove[table] = [...(queued.remove.get(table) ?? [])]
    any ||= batch.upsert[table].length > 0 || batch.remove[table].length > 0
  }
  queued.upsert.clear()
  queued.remove.clear()
  return any ? batch : null
}

/** Resolves once every change made so far has reached the database. */
export async function whenSaved() {
  while (flushScheduled) await new Promise((r) => setTimeout(r, 25))
  await saving
}

async function save(changes: Batch | null) {
  if (!changes) return
  try {
    await retry(async () => {
      const res = await fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) })
      if (!res.ok) throw new Error((await res.json()).error ?? `Save failed (${res.status})`)
    })
    if (status.state === 'error') status = { state: 'ready' }
  } catch (err) {
    status = { state: 'error', message: `A change wasn’t saved: ${err instanceof Error ? err.message : 'network error'}. Reload to see what's stored.` }
    notify()
  }
}

/** Retries a request a couple of times with backoff before giving up. */
async function retry<T>(request: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request()
    } catch (err) {
      if (attempt >= attempts) throw err
      await new Promise((r) => setTimeout(r, 500 * attempt))
    }
  }
}

export function getDb() {
  return db
}

const now = () => new Date().toISOString()

export const NO_RESUME = 'No resume to evaluate.'

// ---------- Openings & drives ----------

export function saveOpening(opening: Opening) {
  update((d) => ({
    ...d,
    openings: d.openings.some((o) => o.id === opening.id)
      ? d.openings.map((o) => (o.id === opening.id ? opening : o))
      : [opening, ...d.openings]
  }))
}

export function setOpeningStatus(id: string, status: Opening['status']) {
  update((d) => ({ ...d, openings: d.openings.map((o) => (o.id === id ? { ...o, status } : o)) }))
}

/** Adds the sample careers-page role. Campus roles are added per drive, from CAMPUS_TEMPLATES. */
export function loadDemoOpenings() {
  const existing = new Set(getDb().openings.filter((o) => !o.driveId).map((o) => o.reqId))
  const fresh = CAREERS_SAMPLES.filter((o) => !existing.has(o.reqId)).map((o) => ({ ...o, id: uid('op'), createdAt: now() }))
  update((d) => ({ ...d, openings: [...fresh, ...d.openings] }))
}

/** Edits a role. A changed rubric clears that role's scores so applicants are re-scored against it. */
export function updateOpening(opening: Opening) {
  const previous = getDb().openings.find((o) => o.id === opening.id)
  const rubricChanged = JSON.stringify(previous?.rubric) !== JSON.stringify(opening.rubric)
  update((d) => ({
    ...d,
    openings: d.openings.map((o) => (o.id === opening.id ? opening : o)),
    applications: rubricChanged
      ? d.applications.map((a) => (a.openingId === opening.id ? { ...a, evaluation: undefined, evaluationError: undefined } : a))
      : d.applications
  }))
}

/** Deletes a role and every application to it. */
export function deleteOpening(id: string) {
  update((d) => ({
    ...d,
    openings: d.openings.filter((o) => o.id !== id),
    applications: d.applications.filter((a) => a.openingId !== id)
  }))
}

/**
 * Copies a role into a drive as an independent role: same JD and rubric, its own id, so editing
 * it for one college never changes another.
 */
export function copyRoleToDrive(source: Omit<Opening, 'id' | 'createdAt'>, driveId: string): Opening {
  const drive = getDb().drives.find((d) => d.id === driveId)
  const opening: Opening = {
    ...source,
    id: uid('op'),
    source: 'campus',
    driveId,
    reqId: drive ? `${source.reqId.replace(/-[A-Z0-9]{4}$/, '')}-${drive.id.slice(-4).toUpperCase()}` : source.reqId,
    rules: { ...source.rules, batch: drive?.batch ?? source.rules.batch },
    status: 'open',
    createdAt: now()
  }
  update((d) => ({ ...d, openings: [opening, ...d.openings] }))
  return opening
}

export function createDrive(college: string, batch: number): Drive {
  const drive: Drive = { id: uid('dr'), college: college.trim(), batch, createdAt: now() }
  update((d) => ({ ...d, drives: [drive, ...d.drives] }))
  return drive
}

export function updateDrive(id: string, patch: Pick<Drive, 'college' | 'batch'>) {
  update((d) => ({
    ...d,
    drives: d.drives.map((dr) => (dr.id === id ? { ...dr, ...patch, college: patch.college.trim() } : dr)),
    candidates: d.candidates.map((c) => (c.driveId === id ? { ...c, college: patch.college.trim() } : c))
  }))
}

/**
 * Deletes a drive with its roles, applications and students. Students already added to the
 * talent pool stay there, detached from the drive.
 */
export function deleteDrive(id: string) {
  update((d) => {
    const roleIds = new Set(d.openings.filter((o) => o.driveId === id).map((o) => o.id))
    const removed = new Set(d.candidates.filter((c) => c.driveId === id && !c.inPool).map((c) => c.id))
    return {
      drives: d.drives.filter((dr) => dr.id !== id),
      openings: d.openings.filter((o) => !roleIds.has(o.id)),
      candidates: d.candidates
        .filter((c) => !removed.has(c.id))
        .map((c) => (c.driveId === id ? { ...c, driveId: undefined } : c)),
      applications: d.applications.filter((a) => !roleIds.has(a.openingId) && !removed.has(a.candidateId))
    }
  })
}

/** Removes a person and all of their applications. */
export function deleteCandidate(id: string) {
  update((d) => ({
    ...d,
    candidates: d.candidates.filter((c) => c.id !== id),
    applications: d.applications.filter((a) => a.candidateId !== id)
  }))
}

// ---------- Candidates ----------

export type CandidateInput = Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Adds a person, or merges into an existing record with the same USN, email or phone. Only records
 * in the same place are merged: a drive's students with that drive, careers applicants and HR
 * uploads with the talent pool. So a campus import never takes over a pool record (or drags it into
 * the drive), and a student applying on the careers page doesn't pull their campus record into the pool.
 */
export function upsertCandidate(input: CandidateInput): Candidate {
  const sameSpace = (c: Candidate) => (input.driveId ? c.driveId === input.driveId : !c.driveId || c.inPool)
  const existing = findExisting(getDb().candidates.filter(sameSpace), input)
  const stamp = now()
  const candidate: Candidate = existing
    ? {
        ...existing,
        ...definedOnly(input),
        record: input.record ?? existing.record,
        profile: input.profile ?? existing.profile,
        inPool: existing.inPool || input.inPool,
        updatedAt: stamp
      }
    : { ...input, id: uid('cd'), createdAt: stamp, updatedAt: stamp }

  update((d) => ({
    ...d,
    candidates: existing
      ? d.candidates.map((c) => (c.id === existing.id ? candidate : c))
      : [candidate, ...d.candidates]
  }))
  return candidate
}

function findExisting(pool: Candidate[], input: CandidateInput) {
  const emails = [input.email, input.altEmail, input.profile?.email].filter(Boolean).map((e) => e!.toLowerCase())
  return pool.find(
    (c) =>
      (input.usn && c.usn === input.usn) ||
      [c.email, c.altEmail, c.profile?.email].some((e) => e && emails.includes(e.toLowerCase())) ||
      (input.phone && c.phone === input.phone)
  )
}

function definedOnly<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}

/** Campus students stay out of the talent pool until HR adds them. */
export function setInPool(candidateIds: string[], inPool: boolean) {
  const ids = new Set(candidateIds)
  update((d) => ({
    ...d,
    candidates: d.candidates.map((c) => (ids.has(c.id) ? { ...c, inPool, updatedAt: now() } : c))
  }))
}

// ---------- Applications ----------

export function applyTo(candidateId: string, openingId: string): Application {
  const existing = getDb().applications.find((a) => a.candidateId === candidateId && a.openingId === openingId)
  if (existing) return existing
  const stamp = now()
  const application: Application = {
    id: uid('ap'),
    candidateId,
    openingId,
    stage: 'new',
    history: [{ stage: 'new', at: stamp }],
    createdAt: stamp
  }
  update((d) => ({ ...d, applications: [application, ...d.applications] }))
  return application
}

export function setStage(applicationId: string, stage: Stage) {
  update((d) => ({
    ...d,
    applications: d.applications.map((a) =>
      a.id === applicationId && a.stage !== stage
        ? { ...a, stage, history: [...a.history, { stage, at: now() }] }
        : a
    )
  }))
}

function setEvaluation(applicationId: string, result: { evaluation: Evaluation } | { error: string }) {
  update((d) => ({
    ...d,
    applications: d.applications.map((a) =>
      a.id !== applicationId
        ? a
        : 'evaluation' in result
          ? { ...a, evaluation: result.evaluation, evaluationError: undefined }
          : { ...a, evaluationError: result.error }
    )
  }))
}

const inFlight = new Set<string>()

/** Applications that were never scored, e.g. because the tab closed mid-request. */
export function pendingApplicationIds(openingId?: string) {
  return getDb()
    .applications.filter((a) => !a.evaluation && !a.evaluationError && !inFlight.has(a.id) && (!openingId || a.openingId === openingId))
    .map((a) => a.id)
}

/** Scores applications against their openings, three at a time, saving each result as it lands. */
export async function evaluateApplications(applicationIds: string[], onProgress?: (done: number) => void) {
  let done = 0
  const ids = applicationIds.filter((id) => !inFlight.has(id))
  ids.forEach((id) => inFlight.add(id))
  await mapLimit(ids, 3, async (id) => {
    const { applications, candidates, openings } = getDb()
    const application = applications.find((a) => a.id === id)
    const candidate = candidates.find((c) => c.id === application?.candidateId)
    const opening = openings.find((o) => o.id === application?.openingId)

    if (!application || !opening) {
      // Deleted while queued; nothing to score.
    } else if (!candidate?.profile) {
      setEvaluation(id, { error: NO_RESUME })
    } else {
      try {
        const res = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: { text: candidate.profile.text },
            opening: {
              title: opening.title,
              company: opening.company,
              experience: opening.experience,
              rubric: opening.rubric
            }
          })
        })
        const data = await res.json()
        setEvaluation(id, res.ok ? { evaluation: data } : { error: data.error ?? `Failed (${res.status})` })
      } catch (err) {
        setEvaluation(id, { error: err instanceof Error ? err.message : 'Network error' })
      }
    }
    inFlight.delete(id)
    onProgress?.(++done)
  })
}

// ---------- Housekeeping ----------

export function clearPool() {
  update(() => EMPTY)
}
