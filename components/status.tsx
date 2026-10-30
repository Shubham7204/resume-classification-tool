'use client'

import { AlertTriangle, Check, CheckCircle2, CircleHelp, Pause, X, XCircle } from 'lucide-react'
import { Badge, Select, type Tone } from '@/components/ui'
import type { EligibilityResult, VerificationFlag } from '@/lib/eligibility'
import { POLICY } from '@/lib/jev'
import { NO_RESUME, setStage } from '@/lib/store'
import { STAGES, type Application, type Recommendation, type Stage } from '@/lib/types'
import { cn } from '@/lib/utils'

const RECOMMENDATION: Record<Recommendation, { label: string; tone: Tone }> = {
  INTERVIEW: { label: 'Interview', tone: 'good' },
  SCREEN: { label: 'Screen', tone: 'warn' },
  HOLD: { label: 'Hold', tone: 'neutral' }
}

export function RecommendationBadge({ application }: { application: Application }) {
  if (application.evaluation) {
    const { label, tone } = RECOMMENDATION[application.evaluation.recommendation]
    return <Badge tone={tone}>{label}</Badge>
  }
  if (application.evaluationError === NO_RESUME) return <Badge tone="warn">No resume</Badge>
  if (application.evaluationError) {
    return (
      <Badge tone="bad" title={application.evaluationError}>
        Failed
      </Badge>
    )
  }
  return <Badge>Not scored</Badge>
}

const ELIGIBILITY = {
  eligible: { label: 'Eligible', tone: 'good', Icon: CheckCircle2 },
  ineligible: { label: 'Not eligible', tone: 'bad', Icon: XCircle },
  unverified: { label: 'Unverified', tone: 'warn', Icon: CircleHelp }
} as const

export function EligibilityBadge({ result }: { result: EligibilityResult }) {
  const { label, tone, Icon } = ELIGIBILITY[result.status]
  const failed = result.checks.filter((c) => c.status === 'fail').map((c) => `${c.rule}: ${c.detail}`)
  return (
    <Badge tone={tone} title={failed.join('\n') || undefined}>
      <Icon size={12} />
      {label}
    </Badge>
  )
}

export function FlagBadges({ flags }: { flags: VerificationFlag[] }) {
  const warnings = flags.filter((f) => f.severity === 'warn')
  if (!warnings.length) return null
  return (
    <Badge tone="warn" title={warnings.map((f) => f.message).join('\n')}>
      <AlertTriangle size={12} />
      {warnings.length === 1 ? 'Verify' : `${warnings.length} to verify`}
    </Badge>
  )
}

export function ScoreMeter({ score, className }: { score?: number; className?: string }) {
  if (score === undefined) return <span className="font-mono text-xs text-faint">n/a</span>
  const color = score >= POLICY.interviewAt ? 'bg-good' : score >= POLICY.screenAt ? 'bg-warn' : 'bg-faint'
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="w-8 text-right font-mono text-[13px] tabular-nums">{score}</span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-sunken">
        <span className={cn('block h-full rounded-full', color)} style={{ width: `${score}%` }} />
      </span>
    </span>
  )
}

export const STAGE_LABEL: Record<Stage, string> = {
  new: 'New',
  shortlisted: 'Shortlisted',
  interview: 'Interviewing',
  offer: 'Offer made',
  hired: 'Hired',
  on_hold: 'On hold',
  rejected: 'Not progressing'
}

const QUICK: Array<{ stage: Stage; label: string; Icon: typeof Check; on: string }> = [
  { stage: 'shortlisted', label: 'Shortlist', Icon: Check, on: 'bg-good text-white' },
  { stage: 'on_hold', label: 'Hold', Icon: Pause, on: 'bg-warn text-white' },
  { stage: 'rejected', label: 'Reject', Icon: X, on: 'bg-bad text-white' }
]

/** One-click decision buttons; clicking the active one moves the application back to New. */
export function QuickDecision({ application }: { application: Application }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-line-strong" onClick={(e) => e.stopPropagation()}>
      {QUICK.map(({ stage, label, Icon, on }) => {
        const active = application.stage === stage
        return (
          <button
            key={stage}
            title={label}
            aria-pressed={active}
            onClick={() => setStage(application.id, active ? 'new' : stage)}
            className={cn(
              'flex h-8 items-center gap-1 px-2.5 text-[12.5px] transition-colors not-first:border-l not-first:border-line-strong',
              active ? on : 'bg-elev text-muted hover:bg-sunken hover:text-fg'
            )}
          >
            <Icon size={13} />
            <span className="hidden lg:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function StageSelect({ application }: { application: Application }) {
  return (
    <Select
      aria-label="Stage"
      value={application.stage}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setStage(application.id, e.target.value as Stage)}
      className="h-8 w-[9.5rem] rounded-lg text-[13px]"
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {STAGE_LABEL[s]}
        </option>
      ))}
    </Select>
  )
}
