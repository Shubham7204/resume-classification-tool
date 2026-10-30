import { NextResponse } from 'next/server'
import { readPdf } from '@/lib/server/files'

/**
 * GET /api/files?key=resumes/… streams a stored PDF through the app. Proxying (rather than
 * redirecting to a signed storage link) means the browser never has to reach the storage host,
 * which some networks' DNS refuses to resolve.
 */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key') ?? ''
  try {
    const bytes = await readPdf(key)
    const name = key.split('/').pop()!.replace(/^[0-9a-f-]{36}-/, '').replace(/"/g, '')
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${name}"`,
        'Cache-Control': 'private, max-age=300'
      }
    })
  } catch {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 })
  }
}
