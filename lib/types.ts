// Domain model. The key split: a Candidate is a permanent person record; an Application is
// that person's attempt at one Opening, with its own evaluation and stage.
// Campus students live under their Drive; only people with `inPool` appear in the talent pool.

export type OpeningSource = 'campus' | 'careers'
export type CandidateSource = 'campus' | 'careers' | 'hr_upload'
export type Recommendation = 'INTERVIEW' | 'SCREEN' | 'HOLD'

export const STAGES = ['new', 'shortlisted', 'interview', 'offer', 'hired', 'on_hold', 'rejected'] as const
export type Stage = (typeof STAGES)[number]

export interface EligibilityRules {
  batch?: number // graduating year, e.g. 2027
  minCgpa?: number // 10-point scale
  minSchoolPct?: number // Class XII, or diploma for students who did one instead; Class X is not considered
  maxActiveBacklogs?: number
  maxBacklogHistory?: number
  branches?: string[] // empty or missing = all branches
}

/**
 * One atomic judgment Jev makes about a resume. A rubric is a list of these;
 * the fit score is their weighted sum, computed in our code (see lib/jev.ts).
 */
export type Criterion = {
  key: string
  label: string
  weight: number // relative importance, 1–5
  mustHave?: boolean // failing it caps the recommendation at Screen
} & (
  | { type: 'score'; question: string; levels: string[] } // ordered weakest → strongest
  | { type: 'noul'; question: string; yes: string; no: string } // yes/no, answered as a probability
)

export interface Opening {
  id: string
  reqId: string
  title: string
  company: string
  source: OpeningSource
  driveId?: string // campus roles belong to one drive; their rubric and cutoffs are specific to it
  location: string
  experience: string // e.g. "Freshers (2027 batch)" or "3–5 years"
  ctc?: string
  summary: string
  description: string // the JD as written by HR; shown on the careers page
  jdFileKey?: string // the uploaded JD PDF in object storage, if HR uploaded one
  rules: EligibilityRules
  rubric: Criterion[]
  status: 'open' | 'closed'
  createdAt: string
}

export interface Drive {
  id: string
  college: string
  batch: number
  createdAt: string
}

/** Academic facts. `record` comes from the college; `declared` is what the resume claims. */
export interface Academics {
  cgpa?: number
  classX?: number
  classXII?: number
  diplomaPct?: number
  activeBacklogs?: number
  backlogHistory?: number
  branch?: string
  batch?: number
}

export type SkillCategory = 'languages' | 'ai' | 'data' | 'backend' | 'frontend' | 'infra' | 'tools'

export interface ResumeProfile {
  name: string
  email?: string
  phone?: string
  usn?: string
  links: { github?: string; linkedin?: string; website?: string }
  skills: Record<SkillCategory, string[]>
  education: string[]
  experience: string[]
  projects: string[]
  declared: Academics
  text: string // normalised resume text, trimmed for storage
  fileKey?: string // the original PDF in object storage
}

export interface Candidate {
  id: string
  name: string
  email?: string
  altEmail?: string
  phone?: string
  usn?: string
  college?: string
  source: CandidateSource
  inPool: boolean
  driveId?: string
  resumeFileName?: string
  profile?: ResumeProfile
  record?: Academics
  createdAt: string
  updatedAt: string
}

/** Jev's answer to one criterion, plus what it contributed to the fit score. */
export interface CriterionResult {
  key: string
  label: string
  type: Criterion['type']
  weight: number
  mustHave: boolean
  value: number // 0–1: normalised score level, or probability of "yes"
  contribution: number // points out of 100 this criterion added to the fit score
  level?: number // score questions: Jev's (fractional) level
  levelText?: string // score questions: the nearest level's description
  probabilities?: Record<string, number>
  confidence: number // 0–1; for yes/no, distance from 0.5
  lowConfidence: boolean
}

export interface Evaluation {
  fitScore: number // 0–100, weighted sum of criterion values
  recommendation: Recommendation
  reasons: string[] // why the recommendation is what it is, in plain words
  results: CriterionResult[]
  needsReview: boolean // any low-confidence answer
  model: string
  evaluatedAt: string
}

export interface Application {
  id: string
  candidateId: string
  openingId: string
  stage: Stage
  evaluation?: Evaluation
  evaluationError?: string
  history: Array<{ stage: Stage; at: string }>
  createdAt: string
}

/** Everything the app stores. Postgres is the source of truth; the client keeps a synced copy. */
export interface Db {
  openings: Opening[]
  drives: Drive[]
  candidates: Candidate[]
  applications: Application[]
}
