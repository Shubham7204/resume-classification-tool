// Neon Object Storage (S3-compatible) through the Files SDK's neon adapter. The adapter reads
// AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, which
// `neon deploy` / `neon env pull` write for the branch. The bucket is declared in neon.ts.

import { randomUUID } from 'crypto'
import { Files } from 'files-sdk'
import { neon } from 'files-sdk/neon'

const BUCKET = 'assets'
const PREFIXES = ['resumes/', 'job-descriptions/'] as const
export type FilePrefix = (typeof PREFIXES)[number]

const globalForFiles = globalThis as typeof globalThis & { __recruiterosFiles?: Files }

function files() {
  globalForFiles.__recruiterosFiles ??= new Files({ adapter: neon({ bucket: BUCKET }) })
  return globalForFiles.__recruiterosFiles
}

export function storageConfigured() {
  return Boolean(process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
}

/** Stores an uploaded PDF and returns its key, e.g. "resumes/1f0c…-ananya-iyer.pdf". */
export async function storePdf(prefix: FilePrefix, file: File, bytes: Buffer): Promise<string> {
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-80)
  const key = `${prefix}${randomUUID()}-${safeName}`
  await files().upload(key, bytes, { contentType: 'application/pdf' })
  return key
}

/** Short-lived signed link to a stored file; keys outside our prefixes are refused. */
export async function signedUrl(key: string, expiresIn = 300) {
  if (!PREFIXES.some((p) => key.startsWith(p)) || key.includes('..')) throw new Error('Unknown file')
  return files().url(key, { expiresIn })
}

/** Reads a stored PDF back, e.g. to re-parse a resume with an improved parser. */
export async function readPdf(key: string): Promise<Buffer> {
  if (!PREFIXES.some((p) => key.startsWith(p)) || key.includes('..')) throw new Error('Unknown file')
  return Buffer.from(await (await files().download(key)).arrayBuffer())
}

/** Round-trips a small object; used by the health check. */
export async function checkStorage() {
  const key = `resumes/healthcheck-${randomUUID()}.txt`
  const f = files()
  await f.upload(key, 'ok', { contentType: 'text/plain' })
  const text = await (await f.download(key)).text()
  await f.delete(key)
  return text === 'ok'
}
