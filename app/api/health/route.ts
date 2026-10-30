import { NextResponse } from 'next/server'
import { checkDatabase } from '@/lib/server/db'
import { checkStorage, storageConfigured } from '@/lib/server/files'

export const dynamic = 'force-dynamic'

/** Proves each Neon service end to end: a Postgres round trip and an object write/read/delete. */
export async function GET() {
  const [database, storage] = await Promise.all([
    checkDatabase().then(
      (r) => ({ ok: true, ...r }),
      (e: Error) => ({ ok: false, error: e.message })
    ),
    (storageConfigured() ? checkStorage() : Promise.reject(new Error('AWS_* storage variables are not set'))).then(
      (ok) => ({ ok }),
      (e: Error) => ({ ok: false, error: e.message })
    )
  ])
  const ok = database.ok && storage.ok
  return NextResponse.json({ ok, branch: process.env.NEON_BRANCH ?? null, database, storage }, { status: ok ? 200 : 503 })
}
