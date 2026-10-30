import { NextResponse } from 'next/server'
import { storePdf } from '@/lib/server/files'
import { pdfToText } from '@/lib/server/pdf'
import { readResume } from '@/lib/server/read-resume'

// One resume per request keeps each upload well under hosting body-size limits.
export const maxDuration = 60

/** Reads a resume PDF, keeps the original in object storage, and returns the parsed profile. */
export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Attach a resume PDF as "file".' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const text = await pdfToText(bytes)
    if (text.trim().length < 50) {
      return NextResponse.json({ error: `Could not read text from ${file.name}. Is it a scanned image?` }, { status: 422 })
    }

    const [fileKey, profile] = await Promise.all([storePdf('resumes/', file, bytes), readResume(text, file.name)])
    return NextResponse.json({ ...profile, fileKey })
  } catch (err) {
    console.error('parse-resume failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Parsing failed' }, { status: 500 })
  }
}
