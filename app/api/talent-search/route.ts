import { NextResponse } from 'next/server'
import { searchTalentPool, type SearchCandidate } from '@/lib/server/talent-search'

export const maxDuration = 60

const MAX_POOL = 200

/** Body: { question: string, candidates: [{ id, name, text }] } — the client sends its pool. */
export async function POST(request: Request) {
  const jevKey = process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY
  if (!jevKey) return NextResponse.json({ error: 'TYPESAFE_API_KEY is not configured on the server.' }, { status: 500 })

  let body: { question?: unknown; candidates?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : ''
  const candidates = (Array.isArray(body.candidates) ? body.candidates : [])
    .filter((c): c is SearchCandidate => typeof c?.id === 'string' && typeof c?.text === 'string' && c.text.length > 50)
    .slice(0, MAX_POOL)
    .map((c) => ({ id: c.id, name: String(c.name ?? ''), text: c.text }))

  if (question.length < 5) return NextResponse.json({ error: 'Ask a question about who you need.' }, { status: 400 })
  if (!candidates.length) return NextResponse.json({ error: 'The talent pool has no resumes to search.' }, { status: 400 })

  try {
    return NextResponse.json(await searchTalentPool(question, candidates, jevKey))
  } catch (err) {
    console.error('talent-search failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Search failed' }, { status: 502 })
  }
}
