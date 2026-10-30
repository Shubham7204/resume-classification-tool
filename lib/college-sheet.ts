// Reads the placement cell's registration sheet and pairs each resume with its row.

import { normalisePhone } from '@/lib/resume'
import type { Academics, Opening, ResumeProfile } from '@/lib/types'

export interface CollegeRow {
  usn?: string
  name: string
  email?: string
  altEmail?: string
  phone?: string
  rolesOpted: string[]
  resumeFile?: string
  record: Academics
}

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f.trim())) rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  row.push(field)
  if (row.some((f) => f.trim())) rows.push(row)
  return rows
}

// Header detection is by pattern so sheets from different colleges still import.
// Order matters: more specific patterns are claimed first.
const COLUMNS: Array<[keyof ColumnMap, RegExp]> = [
  ['altEmail', /personal\s*e-?mail/i],
  ['email', /e-?mail/i],
  ['usn', /\b(usn|roll|reg(istration)?\s*no|enrol?ment|student\s*id)\b/i],
  ['name', /name/i],
  ['branch', /branch|department|discipline|stream/i],
  ['batch', /batch|year of passing|passing year|graduation/i],
  ['phone', /mobile|phone|contact/i],
  ['diplomaPct', /diploma/i],
  ['classXII', /xii|12th|puc|hsc|intermediate/i],
  ['classX', /\bx\b|10th|sslc|ssc/i],
  ['cgpa', /cgpa|gpa|aggregate/i],
  ['activeBacklogs', /active\s*backlog|current\s*backlog/i],
  ['backlogHistory', /backlog/i],
  ['rolesOpted', /role|opted|preference|interest/i],
  ['resumeFile', /resume|cv/i]
]

type ColumnMap = Record<
  'usn' | 'name' | 'email' | 'altEmail' | 'phone' | 'branch' | 'batch' | 'cgpa' | 'classX' | 'classXII' | 'diplomaPct' | 'activeBacklogs' | 'backlogHistory' | 'rolesOpted' | 'resumeFile',
  number
>

/** Reads an uploaded .xlsx or .csv into a grid of strings (first sheet only for Excel). */
export async function readSheetFile(file: File): Promise<string[][]> {
  if (file.name.toLowerCase().endsWith('.csv')) return parseCsv((await file.text()).replace(/^﻿/, ''))
  const { readSheet } = await import('read-excel-file/universal')
  const data = await readSheet(file)
  return data.map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))))
}

export function parseCollegeSheet(table: string[][]): { rows: CollegeRow[]; columns: Partial<ColumnMap> } {
  // Placement-cell sheets often start with a title row; the header is the first row that names several known columns.
  const headerIndex = table.slice(0, 10).findIndex((r) => COLUMNS.filter(([, re]) => r.some((h) => re.test(h))).length >= 4)
  if (headerIndex < 0) return { rows: [], columns: {} }
  const header = table[headerIndex]
  const body = table.slice(headerIndex + 1)

  const columns: Partial<ColumnMap> = {}
  const claimed = new Set<number>()
  for (const [key, pattern] of COLUMNS) {
    const index = header.findIndex((h, i) => !claimed.has(i) && pattern.test(h))
    if (index >= 0) {
      columns[key] = index
      claimed.add(index)
    }
  }

  const cell = (r: string[], key: keyof ColumnMap) => {
    const i = columns[key]
    const v = i === undefined ? '' : (r[i] ?? '').trim()
    return v || undefined
  }
  const num = (r: string[], key: keyof ColumnMap) => {
    const v = cell(r, key)
    const n = v === undefined ? NaN : parseFloat(v)
    return Number.isFinite(n) ? n : undefined
  }

  const rows = body
    .map((r) => ({
      usn: cell(r, 'usn')?.toUpperCase(),
      name: cell(r, 'name') ?? '',
      email: cell(r, 'email')?.toLowerCase(),
      altEmail: cell(r, 'altEmail')?.toLowerCase(),
      phone: cell(r, 'phone') ? normalisePhone(cell(r, 'phone')!) : undefined,
      rolesOpted: (cell(r, 'rolesOpted') ?? '').split(/[;|/]/).map((s) => s.trim()).filter(Boolean),
      resumeFile: cell(r, 'resumeFile'),
      record: {
        branch: cell(r, 'branch'),
        batch: num(r, 'batch'),
        cgpa: num(r, 'cgpa'),
        classX: num(r, 'classX'),
        classXII: num(r, 'classXII'),
        diplomaPct: num(r, 'diplomaPct'),
        activeBacklogs: num(r, 'activeBacklogs'),
        backlogHistory: num(r, 'backlogHistory')
      }
    }))
    .filter((r) => r.name)

  return { rows, columns }
}

// ---------- Resume ↔ row matching ----------

export type MatchMethod = 'USN' | 'Email' | 'Phone' | 'File name' | 'Name'

export function matchResumeToRow(
  profile: ResumeProfile,
  fileName: string,
  rows: CollegeRow[],
  taken: Set<number>
): { index: number; method: MatchMethod } | null {
  const text = profile.text.toUpperCase()
  const email = profile.email?.toLowerCase()
  const phone = profile.phone
  const strategies: Array<[MatchMethod, (r: CollegeRow) => boolean]> = [
    ['USN', (r) => !!r.usn && (profile.usn === r.usn || text.includes(r.usn))],
    ['Email', (r) => !!email && (r.email === email || r.altEmail === email)],
    ['Phone', (r) => !!phone && r.phone === phone],
    ['File name', (r) => !!r.resumeFile && sameFile(r.resumeFile, fileName)],
    ['Name', (r) => normaliseName(r.name) === normaliseName(profile.name)]
  ]

  for (const [method, test] of strategies) {
    const index = rows.findIndex((r, i) => !taken.has(i) && test(r))
    if (index >= 0) return { index, method }
  }
  return null
}

function sameFile(a: string, b: string) {
  const base = (s: string) => s.toLowerCase().replace(/\.pdf$/, '').replace(/[^a-z0-9]/g, '')
  return base(a) === base(b)
}

function normaliseName(s: string) {
  return s.toLowerCase().replace(/[^a-z]/g, '')
}

// ---------- "Roles opted" → openings ----------

const ROLE_ALIASES: Record<string, string> = {
  sde: 'software development engineer',
  swe: 'software engineer',
  ds: 'data scientist',
  ml: 'machine learning',
  ai: 'ai artificial intelligence'
}

/** Best-guess opening for a free-text role label like "SDE Backend". HR can override in the UI. */
export function guessOpening(label: string, openings: Opening[]): string | undefined {
  const words = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 1)
  const wanted = new Set(words(label).flatMap((w) => words(ROLE_ALIASES[w] ?? w)))

  let best: { id: string; score: number } | undefined
  for (const o of openings) {
    const title = new Set(words(o.title))
    const score = [...wanted].filter((w) => title.has(w)).length
    if (score > 0 && (!best || score > best.score)) best = { id: o.id, score }
  }
  return best?.id
}
