import { NextResponse } from 'next/server'
import { applyChanges, loadAll, resetAll, TABLES, type Changes } from '@/lib/server/db'

// The client keeps a copy of the data and syncs every change here.
// There is no login yet, so anyone who can reach the app can write; see README.

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await loadAll())
  } catch (err) {
    console.error('db load failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Database unavailable' }, { status: 503 })
  }
}

/** Body: { reset: true } or { upsert: {table: rows[]}, remove: {table: ids[]} }. */
export async function POST(request: Request) {
  let body: { reset?: unknown; upsert?: Record<string, unknown>; remove?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  try {
    if (body.reset === true) {
      // Wiping everything is for test branches only.
      if ((process.env.NEON_BRANCH ?? 'production') === 'production') {
        return NextResponse.json({ error: 'Reset is disabled on the production branch.' }, { status: 403 })
      }
      await resetAll()
      return NextResponse.json({ ok: true })
    }
    await applyChanges(parseChanges(body))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('db write failed:', err)
    const status = err instanceof BadRequest ? 400 : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Write failed' }, { status })
  }
}

class BadRequest extends Error {}

function parseChanges(body: { upsert?: Record<string, unknown>; remove?: Record<string, unknown> }): Changes {
  const changes = {
    upsert: { openings: [], drives: [], candidates: [], applications: [] },
    remove: { openings: [], drives: [], candidates: [], applications: [] }
  } as Changes
  for (const table of TABLES) {
    const rows = body.upsert?.[table] ?? []
    const ids = body.remove?.[table] ?? []
    if (!Array.isArray(rows) || !Array.isArray(ids)) throw new BadRequest(`${table}: expected arrays`)
    if (!rows.every((r) => typeof r?.id === 'string' && typeof r?.createdAt === 'string')) {
      throw new BadRequest(`${table}: every row needs a string id and createdAt`)
    }
    if (!ids.every((id) => typeof id === 'string')) throw new BadRequest(`${table}: ids must be strings`)
    ;(changes.upsert[table] as unknown[]) = rows
    changes.remove[table] = ids
  }
  return changes
}
