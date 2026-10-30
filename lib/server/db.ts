// Lakebase Postgres on Neon, via node-postgres. On Vercel Fluid compute the pool is attached
// with attachDatabasePool so idle connections are released before the function suspends.
// Uses the pooled DATABASE_URL; migrations use DATABASE_URL_UNPOOLED (scripts/migrate.mjs).

import { attachDatabasePool } from '@vercel/functions'
import { Pool, type PoolClient } from 'pg'
import type { Application, Candidate, Db, Drive, Opening } from '@/lib/types'

const globalForPool = globalThis as typeof globalThis & { __recruiterosPool?: Pool }

function getPool() {
  if (!globalForPool.__recruiterosPool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set. Run `neon env pull`.')
    const pool = new Pool({ connectionString: strictSsl(process.env.DATABASE_URL), max: 5 })
    attachDatabasePool(pool)
    globalForPool.__recruiterosPool = pool
  }
  return globalForPool.__recruiterosPool
}

/** Keep full certificate verification explicit (pg v9 will weaken a bare `sslmode=require`). */
function strictSsl(url: string) {
  return url.replace(/sslmode=(require|prefer|verify-ca)\b/, 'sslmode=verify-full')
}

// Write order: parents before children (a campus role references its drive).
export const TABLES = ['drives', 'openings', 'candidates', 'applications'] as const
export type Table = (typeof TABLES)[number]

/** Rows to write and ids to remove, per table. */
export interface Changes {
  upsert: { openings: Opening[]; drives: Drive[]; candidates: Candidate[]; applications: Application[] }
  remove: Record<Table, string[]>
}

export async function loadAll(): Promise<Db> {
  return withRetry(() => loadAllOnce())
}

async function loadAllOnce(): Promise<Db> {
  const pool = getPool()
  const read = async <T>(table: Table) =>
    (await pool.query<{ data: T }>(`select data from ${table} order by created_at desc, id`)).rows.map((r) => r.data)
  const [openings, drives, candidates, applications] = await Promise.all([
    read<Opening>('openings'),
    read<Drive>('drives'),
    read<Candidate>('candidates'),
    read<Application>('applications')
  ])
  return { openings, drives, candidates, applications }
}

export async function applyChanges(changes: Changes) {
  // Upserts and deletes are idempotent, so a transaction that failed to connect can be retried whole.
  await withRetry(() => applyChangesOnce(changes))
}

// One statement per table: rows arrive as a JSON array and Postgres expands them, so a
// 100-row import is four round trips, not a hundred.
const UPSERT: Record<Table, string> = {
  openings: `insert into openings (id, req_id, source, status, drive_id, data, created_at)
    select r->>'id', r->>'reqId', r->>'source', r->>'status', r->>'driveId', r, (r->>'createdAt')::timestamptz
    from jsonb_array_elements($1::jsonb) r
    on conflict (id) do update set req_id = excluded.req_id, source = excluded.source, status = excluded.status,
      drive_id = excluded.drive_id, data = excluded.data, updated_at = now()`,
  drives: `insert into drives (id, data, created_at)
    select r->>'id', r, (r->>'createdAt')::timestamptz
    from jsonb_array_elements($1::jsonb) r
    on conflict (id) do update set data = excluded.data, updated_at = now()`,
  candidates: `insert into candidates (id, drive_id, email, usn, phone, in_pool, data, created_at)
    select r->>'id', r->>'driveId', coalesce(r->>'email', r->'profile'->>'email'), r->>'usn', r->>'phone',
      coalesce((r->>'inPool')::boolean, false), r, (r->>'createdAt')::timestamptz
    from jsonb_array_elements($1::jsonb) r
    on conflict (id) do update set drive_id = excluded.drive_id, email = excluded.email, usn = excluded.usn,
      phone = excluded.phone, in_pool = excluded.in_pool, data = excluded.data, updated_at = now()`,
  applications: `insert into applications (id, candidate_id, opening_id, stage, data, created_at)
    select r->>'id', r->>'candidateId', r->>'openingId', r->>'stage', r, (r->>'createdAt')::timestamptz
    from jsonb_array_elements($1::jsonb) r
    on conflict (id) do update set stage = excluded.stage, data = excluded.data, updated_at = now()`
}

async function applyChangesOnce(changes: Changes) {
  await inTransaction(async (client) => {
    // Parents before children on insert; children before parents on delete.
    for (const table of TABLES) {
      if (changes.upsert[table].length) await client.query(UPSERT[table], [JSON.stringify(changes.upsert[table])])
    }
    for (const table of [...TABLES].reverse()) {
      if (changes.remove[table].length) await client.query(`delete from ${table} where id = any($1)`, [changes.remove[table]])
    }
  })
}

/** Round trip for the health check: server version and row counts. */
export async function checkDatabase() {
  const { rows } = await withRetry(() => getPool().query<{ version: string; openings: number; candidates: number; applications: number }>(
    `select current_setting('server_version') as version,
            (select count(*)::int from openings) as openings,
            (select count(*)::int from candidates) as candidates,
            (select count(*)::int from applications) as applications`
  ))
  return rows[0]
}

export async function resetAll() {
  await withRetry(() => getPool().query('truncate applications, candidates, drives, openings'))
}

// Connection-level failures worth retrying: DNS blips, resets, timeouts, the server closing the connection.
const TRANSIENT = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', '57P01', '08001', '08006'])

async function withRetry<T>(work: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work()
    } catch (err) {
      const code = (err as { code?: string }).code
      if (attempt >= attempts || !code || !TRANSIENT.has(code)) throw err
      console.warn(`Postgres ${code}; retrying (${attempt}/${attempts - 1})`)
      await new Promise((r) => setTimeout(r, 300 * 3 ** (attempt - 1)))
    }
  }
}

async function inTransaction(work: (client: PoolClient) => Promise<void>) {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    await work(client)
    await client.query('commit')
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}
