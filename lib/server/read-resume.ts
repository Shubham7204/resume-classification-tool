// One place that turns resume text into a profile: the rule-based parser for everything,
// then the verified LLM extraction for identity and academics, which wins where it found a value.

import { parseResume } from '@/lib/resume'
import { extractIdentity } from '@/lib/server/extract-academics'
import type { Academics, ResumeProfile } from '@/lib/types'

export async function readResume(text: string, fileName: string): Promise<ResumeProfile> {
  const profile = parseResume(text, fileName)
  const extracted = await extractIdentity(text).catch((err) => {
    console.warn('Academic extraction failed; using rule-based values:', err instanceof Error ? err.message : err)
    return null
  })
  if (!extracted) return profile

  const verified = Object.fromEntries(Object.entries(extracted.academics).filter(([, v]) => v !== undefined)) as Academics
  return { ...profile, name: extracted.name ?? profile.name, declared: { ...profile.declared, ...verified } }
}
