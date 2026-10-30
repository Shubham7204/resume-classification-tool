import { NextResponse } from 'next/server'
import { readPdf } from '@/lib/server/files'
import { pdfToText } from '@/lib/server/pdf'
import { readResume } from '@/lib/server/read-resume'

export const maxDuration = 60

/** Body: { fileKey, fileName }. Re-reads a stored resume PDF with the current parser. */
export async function POST(request: Request) {
  try {
    const { fileKey, fileName } = (await request.json()) as { fileKey?: unknown; fileName?: unknown }
    if (typeof fileKey !== 'string') return NextResponse.json({ error: 'fileKey is required.' }, { status: 400 })
    const text = await pdfToText(await readPdf(fileKey))
    const profile = await readResume(text, typeof fileName === 'string' ? fileName : fileKey.split('/').pop()!)
    return NextResponse.json({ ...profile, fileKey })
  } catch (err) {
    console.error('reread-resume failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not re-read resume' }, { status: 500 })
  }
}
