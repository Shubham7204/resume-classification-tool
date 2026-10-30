import path from 'path'
import { pathToFileURL } from 'url'
import { PDFParse } from 'pdf-parse'

// pdf-parse needs an explicit worker path; file:// keeps it working on Windows.
try {
  const worker = path.resolve(process.cwd(), 'node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs')
  PDFParse.setWorker(pathToFileURL(worker).href)
} catch (err) {
  console.warn('pdf-parse worker setup failed, relying on fallback extraction:', err)
}

const PDF_SYNTAX = new Set(['obj', 'endobj', 'stream', 'endstream', 'xref', 'trailer', 'startxref'])

export async function pdfToText(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const { text } = await parser.getText()
    await parser.destroy()
    if (text && text.trim().length > 30) return text
  } catch (err) {
    console.warn('pdf-parse failed, using fallback extraction:', err)
  }
  return fallbackExtract(buffer)
}

/** Pulls readable strings out of an uncompressed PDF when the real parser fails. */
function fallbackExtract(buffer: Buffer): string {
  const binary = buffer.toString('binary')
  const lines: string[] = []

  for (const match of binary.matchAll(/\(([^)]+)\)\s*(?:Tj|'|")/g)) {
    const cleaned = match[1].replace(/\\([()\\])/g, '$1').trim()
    if (cleaned.length > 1 && !/[^\x20-\x7E\t\n]/.test(cleaned)) lines.push(cleaned)
  }
  if (lines.length > 10) return lines.join(' ')

  return binary
    .replace(/[^\x20-\x7E\n\r]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && t.length <= 40 && !PDF_SYNTAX.has(t.toLowerCase()))
    .join(' ')
    .slice(0, 15_000)
}
