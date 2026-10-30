// Re-reads stored resume PDFs with the current parser and saves the corrected profiles
// (name, academics, sections). Use after improving the parser.
//
// Usage: start the app, then  node scripts/reread-resumes.mjs [baseUrl] [driveId]
// Without a driveId, every candidate with a stored resume is re-read.

const BASE = process.argv[2] ?? 'http://localhost:3001'
const DRIVE = process.argv[3]

const db = await (await fetch(`${BASE}/api/db`)).json()
const targets = db.candidates.filter((c) => c.profile?.fileKey && (!DRIVE || c.driveId === DRIVE))
console.log(`Re-reading ${targets.length} resumes${DRIVE ? ` in drive ${DRIVE}` : ''}…`)

const updated = []
for (const c of targets) {
  const res = await fetch(`${BASE}/api/reread-resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileKey: c.profile.fileKey, fileName: c.resumeFileName })
  })
  const profile = await res.json()
  if (!res.ok) {
    console.log(`  ✗ ${c.name}: ${profile.error}`)
    continue
  }
  const before = c.profile.declared ?? {}
  const after = profile.declared
  const changes = ['batch', 'cgpa', 'classXII', 'diplomaPct', 'branch']
    .filter((k) => before[k] !== after[k])
    .map((k) => `${k} ${before[k] ?? '–'} → ${after[k] ?? '–'}`)
  if (c.name !== profile.name) changes.unshift(`name “${c.name}” → “${profile.name}”`)
  console.log(`  ${changes.length ? '✎' : '='} ${profile.name}${changes.length ? `: ${changes.join(', ')}` : ''}`)
  updated.push({ ...c, name: profile.name, profile, updatedAt: new Date().toISOString() })
}

const save = await fetch(`${BASE}/api/db`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ upsert: { candidates: updated } })
})
console.log(save.ok ? `Saved ${updated.length} profiles.` : `Save failed: ${await save.text()}`)
