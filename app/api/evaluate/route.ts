import { NextResponse } from 'next/server'
import { askJev, decide, sanitiseRubric } from '@/lib/jev'
import { buildJevState } from '@/lib/resume'

// Scores one resume against one opening's rubric. The client fans out and limits
// concurrency, so a single failure never sinks a whole batch.
export const maxDuration = 60

const MAX_RESUME_CHARS = 12_000 // well inside Jev's 32k-token per-question context

export async function POST(request: Request) {
  const apiKey = process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'TYPESAFE_API_KEY is not configured on the server.' }, { status: 500 })
  }

  let body: { profile?: { text?: unknown }; opening?: { title?: unknown; company?: unknown; experience?: unknown; rubric?: unknown } }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const text = typeof body.profile?.text === 'string' ? body.profile.text.slice(0, MAX_RESUME_CHARS) : ''
  const rubric = sanitiseRubric(body.opening?.rubric)
  if (text.length < 50 || rubric.length === 0) {
    return NextResponse.json({ error: 'A resume and a rubric with at least one criterion are required.' }, { status: 400 })
  }

  const opening = {
    title: String(body.opening?.title ?? 'the role'),
    company: String(body.opening?.company ?? ''),
    experience: String(body.opening?.experience ?? '')
  }

  try {
    const response = await askJev(apiKey, buildJevState(text, opening), rubric)
    return NextResponse.json(decide(rubric, response))
  } catch (err) {
    console.error('evaluate failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Evaluation failed' }, { status: 502 })
  }
}
