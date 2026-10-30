// Applies db/migrations/*.sql in order, once each, over the direct (unpooled) connection.
// Usage: node --env-file=.env.local scripts/migrate.mjs   (or: pnpm db:migrate)

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL_UNPOOLED (or DATABASE_URL) is not set.')
  process.exit(1)
}

const dir = join(import.meta.dirname, '..', 'db', 'migrations')
// Keep full certificate verification explicit (pg v9 will weaken a bare `sslmode=require`).
const client = new pg.Client({ connectionString: url.replace(/sslmode=(require|prefer|verify-ca)\b/, 'sslmode=verify-full') })
await client.connect()

try {
  await client.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())')
  const applied = new Set((await client.query('select name from schema_migrations')).rows.map((r) => r.name))

  for (const name of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(name)) continue
    await client.query('begin')
    try {
      await client.query(readFileSync(join(dir, name), 'utf8'))
      await client.query('insert into schema_migrations (name) values ($1)', [name])
      await client.query('commit')
      console.log(`applied ${name}`)
    } catch (err) {
      await client.query('rollback')
      throw err
    }
  }
  console.log('migrations up to date')
} finally {
  await client.end()
}
