import { NextResponse } from 'next/server'
import { storePdf } from '@/lib/server/files'
import { pdfToText } from '@/lib/server/pdf'
import { draftRubric } from '@/lib/server/rubric'

export const maxDuration = 60

/** Body: multipart with `title`, and the JD as `text` or a PDF `file`. Returns the JD text and a rubric draft. */
export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const title = String(form.get('title') ?? '').trim()
    const file = form.get('file')
    const pasted = form.get('text')

    let description = typeof pasted === 'string' ? pasted.trim() : ''
    let jdFileKey: string | undefined
    if (file instanceof File) {
      const bytes = Buffer.from(await file.arrayBuffer())
      description = (await pdfToText(bytes)).trim()
      if (description.length >= 80) jdFileKey = await storePdf('job-descriptions/', file, bytes)
    }

    if (!title) return NextResponse.json({ error: 'Give the role a title first.' }, { status: 400 })
    if (description.length < 80) {
      return NextResponse.json({ error: 'The job description is too short to build a rubric from.' }, { status: 400 })
    }

    const draft = await draftRubric(title, description)
    return NextResponse.json({ ...draft, description, jdFileKey })
  } catch (err) {
    console.error('draft-rubric failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not draft a rubric' }, { status: 500 })
  }
}
