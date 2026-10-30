// The talent-pool agent. Three steps:
//   1. plan:   an LLM turns HR's question into 2–5 atomic checks (the same rubric shape openings use)
//   2. search: Jev answers those checks for every resume in the pool, in parallel
//   3. answer: our code ranks the results; an LLM writes a short answer grounded only in them

import { askJev, decide, sanitiseRubric } from '@/lib/jev'
import { askJson } from '@/lib/server/llm'
import type { Criterion, Evaluation } from '@/lib/types'
import { mapLimit } from '@/lib/utils'

export interface SearchCandidate {
  id: string
  name: string
  text: string
}

export interface SearchMatch {
  candidateId: string
  name: string
  evaluation: Evaluation
}

export interface TalentSearchResult {
  understood: string
  criteria: Criterion[]
  matches: SearchMatch[] // best first; only people worth a look
  answer: string
  searched: number
  plannedBy: string
  ms: number
}

const PLAN_PROMPT = `You turn a recruiter's request into checks that TypeSafe's Jev model will answer about each resume in a talent pool.

Return ONLY JSON:
{
  "understood": "one sentence restating what the recruiter needs",
  "criteria": [   // 2 to 5
    { "type": "score", "label": "2-4 words", "question": "...", "levels": [4 strings, weakest first], "weight": 1-5, "mustHave": boolean },
    { "type": "noul",  "label": "2-4 words", "question": "...", "yes": "...", "no": "...", "weight": 1-5, "mustHave": boolean }
  ]
}

Rules:
- One specific judgment per check, answerable from a resume in a few seconds. Third person ("Does the resume show…").
- Use "score" for depth (e.g. SQL depth), "noul" for presence/absence (e.g. available to join immediately).
- Availability or notice period: ask whether the resume states it; if the resume is silent the answer is no.
- Mark mustHave only for what the recruiter clearly requires. Never ask about protected traits (age, gender, religion, caste, etc.).`

const ANSWER_PROMPT = `You are a recruiting assistant. Answer the recruiter's request using ONLY the screening results provided.
Name the best one to three people and say why in concrete terms taken from their check results and resume excerpt.
Mention important gaps or anything the recruiter should confirm (e.g. availability not stated). If nobody is a strong match, say so plainly.
Return ONLY JSON: { "answer": "3-5 sentences, plain text, no markdown" }`

const MIN_SHOWN_SCORE = 35
const MAX_SHOWN = 8

export async function searchTalentPool(question: string, pool: SearchCandidate[], jevKey: string): Promise<TalentSearchResult> {
  const started = Date.now()

  const plan = await askJson(PLAN_PROMPT, question, (parsed) => {
    const criteria = sanitiseRubric(parsed.criteria, 5)
    return criteria.length >= 1 ? { understood: String(parsed.understood || question), criteria } : null
  })
  if (!plan) throw new Error('Could not plan this search: no LLM provider is reachable.')
  const { understood, criteria } = plan.value

  const today = new Date().toISOString().slice(0, 10)
  const evaluated = await mapLimit(pool, 8, async (c) => {
    try {
      const response = await askJev(jevKey, { today, recruiter_request: question, resume: c.text.slice(0, 12_000) }, criteria)
      return { candidateId: c.id, name: c.name, evaluation: decide(criteria, response) }
    } catch (err) {
      console.warn(`Talent search: Jev failed for ${c.name}:`, err instanceof Error ? err.message : err)
      return null
    }
  })

  const matches = evaluated
    .filter((m): m is SearchMatch => m !== null && m.evaluation.fitScore >= MIN_SHOWN_SCORE)
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, MAX_SHOWN)

  const answer = await summarise(question, matches, pool)
  return { understood, criteria, matches, answer, searched: pool.length, plannedBy: plan.provider, ms: Date.now() - started }
}

// Missing a must-have sorts below everyone who meets them all.
function rank(m: SearchMatch) {
  const missed = m.evaluation.results.some((r) => r.mustHave && r.value < 0.5)
  return m.evaluation.fitScore - (missed ? 100 : 0)
}

async function summarise(question: string, matches: SearchMatch[], pool: SearchCandidate[]) {
  if (!matches.length) return 'Nobody in the talent pool is a good match for this request yet.'

  const evidence = matches.slice(0, 5).map((m) => ({
    name: m.name,
    fit_score: m.evaluation.fitScore,
    checks: m.evaluation.results.map((r) => ({
      check: r.label,
      answer: r.type === 'score' ? `${r.level?.toFixed(1)}/3: ${r.levelText}` : r.value >= 0.7 ? 'yes' : r.value <= 0.3 ? 'no' : 'unsure',
      must_have: r.mustHave
    })),
    resume_excerpt: pool.find((c) => c.id === m.candidateId)?.text.slice(0, 900)
  }))

  const result = await askJson(ANSWER_PROMPT, JSON.stringify({ request: question, results: evidence }), (parsed) =>
    typeof parsed.answer === 'string' && parsed.answer.trim() ? parsed.answer.trim() : null
  )
  if (result) return result.value

  const top = matches[0]
  return `Best match: ${top.name} (fit ${top.evaluation.fitScore}/100). ${matches.length - 1} others are worth a look; see the checks below.`
}
