// Eligibility (does this person meet an opening's hard rules?) and verification
// (does the resume agree with the college's record?). Neither rejects anyone on its own:
// they produce facts for HR to act on.

import type { Academics, Candidate, EligibilityRules, Opening } from '@/lib/types'

export type CheckStatus = 'pass' | 'fail' | 'unknown'

export interface EligibilityCheck {
  rule: string
  status: CheckStatus
  detail: string
}

export interface EligibilityResult {
  status: 'eligible' | 'ineligible' | 'unverified'
  checks: EligibilityCheck[]
  selfDeclared: boolean // true when we only have the resume's word for it
}

export function academicsOf(candidate: Candidate): { facts: Academics; selfDeclared: boolean } {
  if (candidate.record) {
    // College record wins; fall back to the resume only for fields the college didn't send.
    return { facts: { ...candidate.profile?.declared, ...stripUndefined(candidate.record) }, selfDeclared: false }
  }
  return { facts: candidate.profile?.declared ?? {}, selfDeclared: true }
}

export function checkEligibility(candidate: Candidate, rules: EligibilityRules): EligibilityResult {
  const { facts, selfDeclared } = academicsOf(candidate)
  const checks: EligibilityCheck[] = []

  if (rules.batch) {
    checks.push(
      compare('Batch', facts.batch, (b) => b === rules.batch, (b) => `${b} (needs ${rules.batch})`)
    )
  }
  if (rules.minCgpa) {
    checks.push(
      compare('CGPA', facts.cgpa, (c) => c >= rules.minCgpa!, (c) => `${c.toFixed(2)} (min ${rules.minCgpa})`)
    )
  }
  if (rules.minSchoolPct) {
    const min = rules.minSchoolPct
    // Diploma students skip Class XII, so either qualifies; the better of the two counts.
    const school = Math.max(facts.classXII ?? -1, facts.diplomaPct ?? -1)
    const label = facts.diplomaPct !== undefined && school === facts.diplomaPct ? 'Diploma' : 'Class XII'
    checks.push(compare(`${label} %`, school >= 0 ? school : undefined, (p) => p >= min, (p) => `${p}% (min ${min}%)`))
  }
  if (rules.maxActiveBacklogs !== undefined) {
    const max = rules.maxActiveBacklogs
    checks.push(
      compare('Active backlogs', facts.activeBacklogs ?? (selfDeclared ? undefined : 0), (n) => n <= max, (n) => `${n} (max ${max})`)
    )
  }
  if (rules.maxBacklogHistory !== undefined) {
    const max = rules.maxBacklogHistory
    checks.push(
      compare('Backlog history', facts.backlogHistory ?? (selfDeclared ? undefined : 0), (n) => n <= max, (n) => `${n} (max ${max})`)
    )
  }
  if (rules.branches?.length) {
    checks.push(
      compare(
        'Branch',
        facts.branch,
        (b) => rules.branches!.some((r) => sameBranch(b, r)),
        (b) => b
      )
    )
  }

  const status = checks.some((c) => c.status === 'fail')
    ? 'ineligible'
    : checks.some((c) => c.status === 'unknown')
      ? 'unverified'
      : 'eligible'

  return { status, checks, selfDeclared }
}

function compare<T>(rule: string, value: T | undefined, ok: (v: T) => boolean, describe: (v: T) => string): EligibilityCheck {
  if (value === undefined || value === null) return { rule, status: 'unknown', detail: 'Not provided' }
  return { rule, status: ok(value) ? 'pass' : 'fail', detail: describe(value) }
}

// ---------- Branches ----------

const BRANCH_ALIASES: Record<string, string[]> = {
  aiml: ['computer science ai and ml', 'ai and ml', 'aiml', 'artificial intelligence and machine learning'],
  aids: ['artificial intelligence and data science', 'ai and ds', 'aids'],
  csds: ['computer science data science', 'computer engineering data science'],
  ds: ['data science'],
  ai: ['artificial intelligence'],
  mnc: ['mathematics and computing', 'maths and computing'],
  extc: ['electronics and telecommunication', 'electronics and tele communication', 'extc'],
  ece: ['electronics and communication engineering', 'electronics and communication', 'ece'],
  eee: ['electrical and electronics engineering', 'electrical and electronics', 'eee'],
  electronics: ['electronics engineering', 'electronics'],
  electrical: ['electrical engineering', 'electrical'],
  it: ['information technology', 'information science'],
  mech: ['mechanical engineering', 'mechanical'],
  civil: ['civil engineering', 'civil'],
  chem: ['chemical engineering', 'chemical'],
  cse: ['computer science and engineering', 'computer science', 'computer engineering', 'software engineering', 'cse', 'comps']
}

// Most specific first, so "Artificial Intelligence and Machine Learning" isn't read as plain AI.
const ORDER = ['aiml', 'aids', 'csds', 'ds', 'ai', 'mnc', 'extc', 'ece', 'eee', 'electronics', 'electrical', 'it', 'mech', 'civil', 'chem', 'cse']

// Branches a rule naming the parent also accepts ("CSE and allied branches").
const FAMILY: Record<string, string[]> = {
  cse: ['aiml', 'aids', 'csds', 'ds', 'ai'],
  electronics: ['extc', 'ece', 'eee'],
  electrical: ['eee']
}

// A rule like "Other Engineering", "All branches" or "Any" accepts everyone.
const ANY_BRANCH = /\b(any|all|other)\b/

function normaliseBranch(s: string) {
  return s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function branchCode(s: string) {
  const n = normaliseBranch(s)
  const compact = n.replace(/ /g, '')
  for (const code of ORDER) {
    if (compact === code || BRANCH_ALIASES[code].some((alias) => n === alias || n.includes(alias))) return code
  }
  return n
}

/** Does a candidate's branch satisfy one branch named in a role's rules? */
export function sameBranch(candidate: string, rule: string) {
  if (ANY_BRANCH.test(normaliseBranch(rule))) return true
  const have = branchCode(candidate)
  const want = branchCode(rule)
  return have === want || (FAMILY[want] ?? []).includes(have)
}

// ---------- Verification ----------

export interface VerificationFlag {
  kind: 'cgpa_mismatch' | 'undisclosed_backlog' | 'missing_resume' | 'self_declared'
  severity: 'warn' | 'info'
  message: string
}

const CGPA_TOLERANCE = 0.15

export function verificationFlags(candidate: Candidate): VerificationFlag[] {
  const flags: VerificationFlag[] = []
  const record = candidate.record
  const declared = candidate.profile?.declared

  if (!candidate.profile) {
    flags.push({ kind: 'missing_resume', severity: 'warn', message: 'No resume received.' })
  }
  if (!record) {
    flags.push({ kind: 'self_declared', severity: 'info', message: 'Academics are self-declared; no college record.' })
  }
  if (record?.cgpa !== undefined && declared?.cgpa !== undefined && Math.abs(record.cgpa - declared.cgpa) > CGPA_TOLERANCE) {
    flags.push({
      kind: 'cgpa_mismatch',
      severity: 'warn',
      message: `Resume says CGPA ${declared.cgpa}; college record says ${record.cgpa}.`
    })
  }
  if (record?.activeBacklogs && candidate.profile && !declared?.activeBacklogs) {
    flags.push({
      kind: 'undisclosed_backlog',
      severity: 'warn',
      message: `College record shows ${record.activeBacklogs} active backlog${record.activeBacklogs > 1 ? 's' : ''}; the resume doesn't mention it.`
    })
  }
  return flags
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>
}
