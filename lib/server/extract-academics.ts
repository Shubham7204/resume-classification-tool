// Reads identity and academics from resume text with an LLM, then keeps only values the
// resume actually supports. Resumes vary too much for regexes alone ("Nov 2022 – *",
// "(GPA: 8.19)", two-column layouts that scramble the text order), but an unchecked LLM can
// invent a CGPA. So every number and the name must be findable in the text; anything that
// isn't is dropped, and the rule-based parser's value is used instead.

import { toDisplayCase } from '@/lib/resume'
import { askJson } from '@/lib/server/llm'
import type { Academics } from '@/lib/types'

export interface ExtractedIdentity {
  name?: string
  academics: Academics
}

const PROMPT = `You read a student's or graduate's resume and return their identity and academics as JSON.
The text may be scrambled by a two-column PDF layout; read carefully.

Return ONLY:
{
  "name": string | null,                 // the person's full name as written
  "degree": string | null,               // the current or highest degree, e.g. "B.Tech"
  "branch": string | null,               // the degree's discipline in full words, e.g. "Artificial Intelligence and Machine Learning"
  "degree_start_year": number | null,    // first year of that degree
  "degree_end_year": number | null,      // year that degree ends or ended (graduation year)
  "end_year_stated": boolean,            // true only if the resume states the end year for that degree
  "cgpa": number | null,                 // that degree's CGPA/CGPI/GPA on a 10-point scale, exactly as written
  "class_xii_percent": number | null,    // Class 12 / HSC / PUC / ISC / junior college percentage
  "diploma_percent": number | null,      // diploma percentage, if the student did a diploma instead of or after Class 12
  "active_backlogs": number | null       // only if the resume states it
}

Rules:
- The graduation year is the END year of the bachelor's or master's degree, never an internship, job or project date, and never the school years.
- If the degree shows "Present", "Current", "*", "ongoing" or no end date, set degree_end_year to null unless the resume states it elsewhere (e.g. "B.Tech in AIML – 2026", "Class of 2026", "expected May 2026").
- Ignore Class 10 / SSC marks completely.
- Use null for anything not stated. Never guess or convert between scales.`

export async function extractIdentity(text: string): Promise<ExtractedIdentity | null> {
  const result = await askJson(PROMPT, text.slice(0, 8000), (raw) => (typeof raw === 'object' && raw ? raw : null))
  if (!result) return null
  const r = result.value as Record<string, unknown>
  const haystack = normalise(text)

  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  // A value counts only if the resume shows it next to a matching label.
  const supported = (n: number | undefined, label: RegExp) => (n !== undefined && appearsNear(haystack, n, label) ? n : undefined)

  const cgpa = supported(num(r.cgpa), /c\.?g\.?p\.?a|cgpi|\bcpi\b|\bgpa\b|pointer|grade/)
  const xii = supported(num(r.class_xii_percent), /hsc|xii|12th|class 12|junior college|higher secondary|puc|\bisc\b|intermediate|percentage|grade/)
  const diploma = supported(num(r.diploma_percent), /diploma/)
  const backlogs = supported(num(r.active_backlogs), /backlog|\bkt\b|arrear/)

  return {
    name: plausibleName(r.name, haystack),
    academics: {
      cgpa: cgpa !== undefined && cgpa > 0 && cgpa <= 10 ? cgpa : undefined,
      classXII: xii !== undefined && xii >= 30 && xii <= 100 ? xii : undefined,
      diplomaPct: diploma !== undefined && diploma >= 30 && diploma <= 100 ? diploma : undefined,
      activeBacklogs: backlogs,
      branch: typeof r.branch === 'string' && r.branch.trim() ? r.branch.trim() : undefined,
      batch: graduationYear(r, haystack)
    }
  }
}

/** A stated end year must appear in the text; otherwise derive it from a stated start year for 4-year degrees. */
function graduationYear(r: Record<string, unknown>, haystack: string): number | undefined {
  const inRange = (y: unknown): y is number => typeof y === 'number' && y >= 2000 && y <= new Date().getFullYear() + 6
  const end = r.degree_end_year
  if (inRange(end) && haystack.includes(String(end))) return end
  const start = r.degree_start_year
  const degree = typeof r.degree === 'string' ? r.degree : ''
  const years = /\b(b\.?\s?tech|b\.?\s?e\b|bachelor of (engineering|technology))/i.test(degree) ? 4 : /\b(b\.?\s?sc|bca|b\.?\s?com|bba)\b/i.test(degree) ? 3 : 0
  if (years && inRange(start) && haystack.includes(String(start))) return start + years
  return undefined
}

function plausibleName(value: unknown, haystack: string): string | undefined {
  if (typeof value !== 'string') return undefined
  const name = value.replace(/\s+/g, ' ').trim()
  const words = name.split(' ')
  if (words.length < 1 || words.length > 5 || !/^[\p{L} .'-]+$/u.test(name)) return undefined
  if (!words.every((w) => haystack.includes(w.toLowerCase().replace(/\.$/, '')))) return undefined
  return toDisplayCase(name)
}

function normalise(text: string) {
  return text.toLowerCase().replace(/\s+/g, ' ')
}

/**
 * True when the number is written shortly after (or just before) a matching label: "CGPA : 8.0",
 * "(GPA: 8.19)", "HSC 81.50%", "Percentage - 62%". 8 matches "8", "8.0" or "8.00".
 */
function appearsNear(haystack: string, n: number, label: RegExp) {
  const forms = [...new Set([String(n), n.toFixed(1), n.toFixed(2)])].map((f) => f.replace('.', '\\.'))
  const number = `(?<![\\d.])(?:${forms.join('|')})(?![\\d]|\\.\\d)`
  const after = new RegExp(`(?:${label.source})[^\\d]{0,60}?${number}`)
  const before = new RegExp(`${number}\\s*%?[^\\d]{0,25}?(?:${label.source})`)
  return after.test(haystack) || before.test(haystack)
}
