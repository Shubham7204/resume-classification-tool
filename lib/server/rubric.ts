// Drafting a screening rubric from a job description: atomic, weighted questions for Jev
// plus the hard eligibility rules. HR reviews and edits
// the draft before it is used. Falls back to a generic rubric when no LLM is reachable.

import { DEPTH_LEVELS, sanitiseRubric } from '@/lib/jev'
import { askJson } from '@/lib/server/llm'
import type { Criterion, EligibilityRules } from '@/lib/types'

export interface RubricDraft {
  summary: string
  rules: EligibilityRules
  rubric: Criterion[]
  generatedBy: string
}

// Question-writing rules follow TypeSafe's guidance: one specific judgment per question,
// answerable from the resume in a few seconds; split anything that weighs several factors.
const SYSTEM_PROMPT = `You design resume-screening rubrics for TypeSafe's Jev model. Jev reads one resume and answers each question independently. Our code then combines the answers with your weights.

Return ONLY JSON:
{
  "summary": string,                 // one sentence describing the role
  "rules": {                         // hard eligibility rules stated in the JD, else null
    "batch": number | null,          // graduating year
    "minCgpa": number | null,        // 10-point scale; "70%" means 7.0
    "minSchoolPct": number | null,   // Class XII (or diploma) percentage; ignore Class X
    "maxActiveBacklogs": number | null,
    "maxBacklogHistory": number | null,
    "branches": string[]             // [] if all branches are allowed
  },
  "rubric": [                        // 5 to 8 criteria
    { "type": "score", "label": "2-4 words", "question": "...", "levels": [4 strings, weakest first], "weight": 1-5, "mustHave": boolean },
    { "type": "noul",  "label": "2-4 words", "question": "...", "yes": "what counts as yes", "no": "what counts as no", "weight": 1-5, "mustHave": boolean }
  ]
}

Rules for the rubric:
- Each criterion is ONE specific judgment about evidence in the resume. Never ask "is this a good candidate" or for an overall verdict.
- Use "score" for depth that varies by degree (e.g. backend systems depth). Levels must be concrete and observable, weakest first.
- Use "noul" for a single capability that is present or not (e.g. "Does the candidate show hands-on Kafka use?").
- Write in the third person about the candidate: "Rate the candidate's…", "Does the resume show…". Never say "you".
- Weight 5 = core to the job, 1 = nice to have. Mark mustHave only for 1-2 truly non-negotiable skills.
- Cover the JD's core responsibilities and required skills; leave out perks, company boilerplate and soft skills that a resume cannot evidence.
- Never ask about age, gender, religion, caste, marital status, disability or any protected trait. Academic cutoffs belong in "rules", not the rubric.`

export async function draftRubric(title: string, jd: string): Promise<RubricDraft> {
  const result = await askJson(SYSTEM_PROMPT, `Role title: ${title}

Job description:
${jd.slice(0, 12_000)}`, (parsed) => {
    const rubric = sanitiseRubric(parsed.rubric)
    if (rubric.length < 3) return null
    return {
      summary: String(parsed.summary || '').slice(0, 300),
      rules: cleanRules((parsed.rules as Record<string, unknown>) ?? {}),
      rubric
    }
  })
  return result ? { ...result.value, generatedBy: result.provider } : fallbackDraft(title, jd)
}

function cleanRules(raw: Record<string, unknown>): EligibilityRules {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  let minCgpa = num(raw.minCgpa)
  if (minCgpa && minCgpa > 10) minCgpa = minCgpa / 10
  return {
    batch: num(raw.batch),
    minCgpa,
    minSchoolPct: num(raw.minSchoolPct),
    maxActiveBacklogs: num(raw.maxActiveBacklogs),
    maxBacklogHistory: num(raw.maxBacklogHistory),
    branches: Array.isArray(raw.branches) ? raw.branches.map(String) : []
  }
}

/** Used only when no LLM is reachable: a generic rubric plus regex-read cutoffs. */
function fallbackDraft(title: string, jd: string): RubricDraft {
  const cgpa = jd.match(/cgpa[^\d\n]{0,25}(\d(?:\.\d+)?)/i)?.[1]
  const pct = jd.match(/(\d{2})\s*%\s*(?:throughout|in academics|aggregate|or equivalent)/i)?.[1]
  const batch = jd.match(/batch[^\n\d]{0,20}(20\d{2})/i)?.[1]

  return {
    summary: title,
    generatedBy: 'Rule-based fallback (no LLM reachable)',
    rules: {
      batch: batch ? Number(batch) : undefined,
      minCgpa: cgpa ? Number(cgpa) : pct ? Number(pct) / 10 : undefined,
      minSchoolPct: pct ? Number(pct) : undefined,
      maxActiveBacklogs: /no active backlogs?/i.test(jd) ? 0 : undefined,
      branches: []
    },
    rubric: sanitiseRubric([
      { type: 'score', label: 'Role-relevant depth', question: `Rate the depth of hands-on work relevant to a ${title}.`, levels: DEPTH_LEVELS, weight: 5 },
      { type: 'score', label: 'Engineering quality', question: 'Rate the evidence of engineering quality: testing, deployment, code review or production use.', levels: DEPTH_LEVELS, weight: 3 },
      { type: 'noul', label: 'Shipped project', question: 'Does the resume link to a deployed project, demo or public repository the candidate built?', weight: 3 },
      { type: 'noul', label: 'Relevant internship/job', question: `Does the candidate have an internship or job doing work relevant to a ${title}?`, weight: 4 }
    ])
  }
}
