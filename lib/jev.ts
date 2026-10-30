// TypeSafe Jev System One, used the way TypeSafe's docs describe for resume screening
// ("composite scoring"): Jev answers atomic questions about the resume, and our code
// combines them with weights. Jev never decides the outcome directly.
// https://docs.typesafe.ai/patterns/composite-scoring.md

import type { Criterion, CriterionResult, Evaluation, Recommendation } from '@/lib/types'

// ---------- Wire format (https://docs.typesafe.ai/api/system-one.md) ----------

type JevQuestion =
  | { type: 'score'; instructions: string; criteria: string[] }
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }

export type JevAnswer =
  | { type: 'score'; score: number; confidence: number; legend: Record<string, string>; probabilities: Record<string, number> }
  | { type: 'noul'; noul: number }

export interface JevResponse {
  model: string
  answers: Record<string, JevAnswer>
}

const JEV_URL = 'https://api.typesafe.ai/v1/systemone'

export function toJevQuestions(rubric: Criterion[]): Record<string, JevQuestion> {
  return Object.fromEntries(
    rubric.map((c) => [
      c.key,
      c.type === 'score'
        ? { type: 'score', instructions: c.question, criteria: c.levels }
        : { type: 'noul', instructions: c.question, criteria: { true: c.yes, false: c.no } }
    ])
  )
}

export async function askJev(apiKey: string, state: unknown, rubric: Criterion[]): Promise<JevResponse> {
  const response = await fetch(JEV_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', state, questions: toJevQuestions(rubric) })
  })
  if (!response.ok) {
    throw new Error(`Jev API error (${response.status}): ${await response.text()}`)
  }
  return response.json()
}

// ---------- Decision rules (all of the judgement policy lives here) ----------

export const POLICY = {
  interviewAt: 70, // fit score at or above → Interview
  screenAt: 45, // fit score at or above → Screen, below → Hold
  mustHavePass: 0.5, // a must-have criterion's value below this caps the result at Screen
  minConfidence: 0.5, // score answers below this are flagged for human review (TypeSafe's suggested floor)
  noulUnsure: [0.3, 0.7] as const // yes/no probabilities in this band are flagged as unsure
}

export function decide(rubric: Criterion[], response: JevResponse): Evaluation {
  const totalWeight = rubric.reduce((sum, c) => sum + c.weight, 0) || 1

  const results: CriterionResult[] = rubric.map((c) => {
    const answer = response.answers[c.key]
    const base = { key: c.key, label: c.label, type: c.type, weight: c.weight, mustHave: !!c.mustHave }

    if (c.type === 'score' && answer?.type === 'score') {
      const top = Math.max(1, c.levels.length - 1)
      const value = clamp01(answer.score / top)
      const nearest = Math.round(Math.min(top, Math.max(0, answer.score)))
      return {
        ...base,
        value,
        contribution: (value * c.weight * 100) / totalWeight,
        level: answer.score,
        levelText: answer.legend?.[String(nearest)] ?? c.levels[nearest],
        probabilities: answer.probabilities,
        confidence: answer.confidence,
        lowConfidence: answer.confidence < POLICY.minConfidence
      }
    }
    if (c.type === 'noul' && answer?.type === 'noul') {
      const p = clamp01(answer.noul)
      return {
        ...base,
        value: p,
        contribution: (p * c.weight * 100) / totalWeight,
        confidence: Math.abs(2 * p - 1),
        lowConfidence: p > POLICY.noulUnsure[0] && p < POLICY.noulUnsure[1]
      }
    }
    // Missing or mistyped answer: count it as zero and make a human look.
    return { ...base, value: 0, contribution: 0, confidence: 0, lowConfidence: true }
  })

  const fitScore = Math.round(results.reduce((sum, r) => sum + r.contribution, 0))
  const failedMustHaves = results.filter((r) => r.mustHave && r.value < POLICY.mustHavePass)

  let recommendation: Recommendation =
    fitScore >= POLICY.interviewAt ? 'INTERVIEW' : fitScore >= POLICY.screenAt ? 'SCREEN' : 'HOLD'
  const reasons = [
    `Fit score ${fitScore}/100 (Interview ≥ ${POLICY.interviewAt}, Screen ≥ ${POLICY.screenAt}).`
  ]
  if (recommendation === 'INTERVIEW' && failedMustHaves.length) {
    recommendation = 'SCREEN'
    reasons.push(`Capped at Screen: must-have not met (${failedMustHaves.map((r) => r.label).join(', ')}).`)
  }

  const unsure = results.filter((r) => r.lowConfidence)
  if (unsure.length) reasons.push(`Jev was unsure on: ${unsure.map((r) => r.label).join(', ')}. Check these by hand.`)

  return {
    fitScore,
    recommendation,
    reasons,
    results,
    needsReview: unsure.length > 0,
    model: response.model,
    evaluatedAt: new Date().toISOString()
  }
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

// ---------- Rubric helpers ----------

export const DEPTH_LEVELS = [
  'No evidence in the resume.',
  'Coursework, tutorials or a small personal project.',
  'Solid hands-on work: real projects or an internship with measurable results.',
  'Outstanding: production systems, research, open-source impact or notable wins.'
]

export function toKey(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'criterion'
}

/** Validates and repairs a rubric from an untrusted source (LLM output or a client request). */
export function sanitiseRubric(raw: unknown, maxCriteria = 10): Criterion[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: Criterion[] = []

  for (const item of raw.slice(0, maxCriteria)) {
    const r = item as Record<string, unknown>
    const question = typeof r.question === 'string' ? r.question.trim().slice(0, 400) : ''
    if (!question) continue
    const label = (typeof r.label === 'string' && r.label.trim()) || question.slice(0, 40)
    let key = toKey(typeof r.key === 'string' ? r.key : label)
    while (seen.has(key)) key += '_2'
    seen.add(key)
    const weight = Math.min(5, Math.max(1, Math.round(Number(r.weight) || 3)))
    const mustHave = r.mustHave === true

    if (r.type === 'score') {
      const levels = Array.isArray(r.levels) && r.levels.length >= 3 ? r.levels.slice(0, 5).map((l) => String(l).slice(0, 200)) : DEPTH_LEVELS
      out.push({ key, label: label.slice(0, 60), weight, mustHave, type: 'score', question, levels })
    } else if (r.type === 'noul') {
      out.push({
        key,
        label: label.slice(0, 60),
        weight,
        mustHave,
        type: 'noul',
        question,
        yes: String(r.yes || 'The resume shows clear evidence of this.').slice(0, 200),
        no: String(r.no || 'The resume shows no evidence of this.').slice(0, 200)
      })
    }
  }
  return out
}
