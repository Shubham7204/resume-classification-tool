import type { EligibilityRules } from '@/lib/types'

export function describeRules(rules: EligibilityRules): string[] {
  const parts: string[] = []
  if (rules.batch) parts.push(`${rules.batch} batch`)
  if (rules.minCgpa) parts.push(`CGPA ≥ ${rules.minCgpa}`)
  if (rules.minSchoolPct) parts.push(`XII/diploma ≥ ${rules.minSchoolPct}%`)
  if (rules.maxActiveBacklogs === 0) parts.push('No active backlogs')
  else if (rules.maxActiveBacklogs !== undefined) parts.push(`≤ ${rules.maxActiveBacklogs} active backlogs`)
  if (rules.maxBacklogHistory !== undefined) parts.push(`≤ ${rules.maxBacklogHistory} backlog in history`)
  if (rules.branches?.length) parts.push(rules.branches.join(', '))
  return parts
}

export function RulesSummary({ rules }: { rules: EligibilityRules }) {
  const parts = describeRules(rules)
  return (
    <p className="min-w-0 truncate font-mono text-[11.5px] text-faint" title={parts.join(' · ')}>
      {parts.length ? parts.join(' · ') : 'No hard eligibility rules'}
    </p>
  )
}
