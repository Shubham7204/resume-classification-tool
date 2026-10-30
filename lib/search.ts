// Keyword search over the talent pool. Every query term must match somewhere in the
// profile; terms are lightly stemmed so "agentic" also finds "agent".

import { allSkills } from '@/lib/resume'
import type { Candidate } from '@/lib/types'

const SUFFIXES = ['ing', 'ic', 'ed', 'es', 's', 'al']

function stem(term: string) {
  for (const suffix of SUFFIXES) {
    if (term.length > suffix.length + 3 && term.endsWith(suffix)) return term.slice(0, -suffix.length)
  }
  return term
}

function haystack(c: Candidate) {
  return [c.name, c.college, c.usn, c.record?.branch, allSkills(c.profile).join(' '), c.profile?.text]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export interface SearchHit {
  candidate: Candidate
  score: number
  matched: string[]
}

export function searchPool(candidates: Candidate[], query: string): SearchHit[] {
  const terms = query.toLowerCase().split(/[\s,]+/).filter((t) => t.length > 1)
  if (!terms.length) return candidates.map((candidate) => ({ candidate, score: 0, matched: [] }))

  return candidates
    .map((candidate) => {
      const text = haystack(candidate)
      const skills = allSkills(candidate.profile)
      let score = 0
      const matched: string[] = []
      for (const term of terms) {
        const root = stem(term)
        const hits = text.split(root).length - 1
        if (!hits) return null
        score += hits + (skills.some((s) => s.includes(root)) ? 5 : 0)
        matched.push(term)
      }
      return { candidate, score, matched }
    })
    .filter((h): h is SearchHit => h !== null)
    .sort((a, b) => b.score - a.score)
}
