'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Download, FileText, Loader2, Pencil, Play, RotateCcw, Trash2, UserPlus } from 'lucide-react'
import { RubricView } from '@/components/rubric'
import { describeRules } from '@/components/rules-summary'
import { EligibilityBadge, FlagBadges, QuickDecision, RecommendationBadge, ScoreMeter } from '@/components/status'
import { Badge, Button, ButtonLink, Card, EmptyState, PageHeader, PageLoading } from '@/components/ui'
import { checkEligibility, verificationFlags, type EligibilityResult, type VerificationFlag } from '@/lib/eligibility'
import { NO_RESUME, deleteOpening, evaluateApplications, pendingApplicationIds, setOpeningStatus, useDb, useHydrated } from '@/lib/store'
import type { Application } from '@/lib/types'
import { cn, downloadCsv } from '@/lib/utils'
import { confirmAction } from '@/components/confirm-dialog'

const TABS = ['Applicants', 'Screening rubric', 'Job description'] as const
const FILTERS = ['All', 'Eligible', 'Not eligible', 'To verify', 'Interview', 'Screen', 'Hold'] as const
type Filter = (typeof FILTERS)[number]

export default function OpeningPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const db = useDb()
  const hydrated = useHydrated()
  const [tab, setTab] = useState<(typeof TABS)[number]>('Applicants')
  const [filter, setFilter] = useState<Filter>('All')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const opening = db.openings.find((o) => o.id === id)
  const drive = db.drives.find((d) => d.id === opening?.driveId)

  // Safety net: score anything that was never scored (e.g. a careers applicant closed the tab mid-request).
  useEffect(() => {
    if (hydrated) void evaluateApplications(pendingApplicationIds(id))
  }, [hydrated, id])

  const rows = useMemo(() => {
    if (!opening) return []
    return db.applications
      .filter((a) => a.openingId === opening.id)
      .flatMap((application) => {
        // Skip applications whose person was deleted (e.g. in another tab) instead of crashing.
        const candidate = db.candidates.find((c) => c.id === application.candidateId)
        if (!candidate) return []
        return [{ application, candidate, eligibility: checkEligibility(candidate, opening.rules), flags: verificationFlags(candidate) }]
      })
      .sort((a, b) => (b.application.evaluation?.fitScore ?? -1) - (a.application.evaluation?.fitScore ?? -1))
  }, [db, opening])

  if (!hydrated) return <PageLoading />
  if (!opening) {
    return <EmptyState title="Opening not found">It may have been created in a different browser.</EmptyState>
  }

  const count = (f: Filter) => rows.filter((r) => matchesFilter(f, r)).length
  const visible = rows.filter((r) => matchesFilter(filter, r))
  const scorable = rows.map((r) => r.application).filter((a) => a.evaluationError !== NO_RESUME)
  const unscored = scorable.filter((a) => !a.evaluation).map((a) => a.id)

  async function scoreUnscored() {
    let ids = unscored
    if (!ids.length) {
      // Everything has a score: rescore all of them, e.g. after the rubric or a resume changed.
      ids = scorable.map((a) => a.id)
      const ok = await confirmAction({
        title: `Rescore ${ids.length} applicant${ids.length > 1 ? 's' : ''}?`,
        body: 'Every fit score and recommendation for this role is recalculated. Shortlist, hold and reject decisions are kept.',
        confirmLabel: 'Rescore'
      })
      if (!ok) return
    }
    setProgress({ done: 0, total: ids.length })
    await evaluateApplications(ids, (done) => setProgress({ done, total: ids.length }))
    setProgress(null)
  }

  function exportCsv() {
    downloadCsv(`${opening!.reqId}-applicants.csv`, [
      ['Name', 'USN', 'Email', 'Eligibility', 'Fit score', 'Recommendation', 'Stage', 'Flags'],
      ...rows.map(({ candidate, application, eligibility, flags }) => [
        candidate.name,
        candidate.usn ?? '',
        candidate.email ?? candidate.profile?.email ?? '',
        eligibility.status,
        application.evaluation?.fitScore ?? '',
        application.evaluation?.recommendation ?? '',
        application.stage,
        flags.filter((f) => f.severity === 'warn').map((f) => f.message).join(' | ')
      ])
    ])
  }

  async function remove() {
    const ok = await confirmAction({
      title: `Delete ${opening!.title}?`,
      body: rows.length ? `Its ${rows.length} applications and their scores will be deleted too. This can’t be undone.` : 'This can’t be undone.',
      confirmLabel: 'Delete role',
      destructive: true
    })
    if (!ok) return
    deleteOpening(opening!.id)
    router.push(drive ? `/hr/campus/${drive.id}` : '/hr/openings')
  }

  return (
    <>
      {drive && (
        <Link href={`/hr/campus/${drive.id}`} className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
          <ArrowLeft size={14} /> {drive.college}
        </Link>
      )}
      <PageHeader
        eyebrow={`${opening.reqId} · ${drive ? `${drive.college} · ${drive.batch} batch` : 'Careers page'}`}
        title={opening.title}
      >
        <ButtonLink href={`/hr/openings/${opening.id}/edit`} variant="ghost" size="sm">
          <Pencil size={14} /> Edit
        </ButtonLink>
        <Button variant="ghost" size="sm" onClick={remove} className="hover:text-bad">
          <Trash2 size={14} /> Delete
        </Button>
        <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
          <Download size={15} /> CSV
        </Button>
        <ButtonLink href="/hr/pool" variant="secondary">
          <UserPlus size={15} /> Add from pool
        </ButtonLink>
        <Button onClick={scoreUnscored} disabled={!scorable.length || !!progress} variant={unscored.length ? 'primary' : 'secondary'}>
          {progress ? <Loader2 size={15} className="animate-spin" /> : unscored.length ? <Play size={15} /> : <RotateCcw size={15} />}
          {progress ? `Scoring ${progress.done}/${progress.total}` : unscored.length ? `Score ${unscored.length} applicants` : 'Rescore all'}
        </Button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted">
        <span>{opening.company}</span>
        <span>{opening.location}</span>
        {opening.ctc && <span>{opening.ctc}</span>}
        <span className="font-mono text-[11.5px] text-faint">{describeRules(opening.rules).join(' · ')}</span>
        <button
          className="ml-auto text-xs underline-offset-2 hover:underline"
          onClick={() => setOpeningStatus(opening.id, opening.status === 'open' ? 'closed' : 'open')}
        >
          {opening.status === 'open' ? 'Close opening' : 'Reopen'}
        </button>
      </div>

      <div className="mb-6 flex gap-6 border-b border-line text-sm">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('-mb-px border-b-2 pb-2.5 transition-colors', tab === t ? 'border-fg font-medium text-fg' : 'border-transparent text-muted hover:text-fg')}
          >
            {t}
            {t === 'Applicants' && <span className="ml-1.5 text-faint">{rows.length}</span>}
            {t === 'Screening rubric' && <span className="ml-1.5 text-faint">{opening.rubric.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'Screening rubric' && (
        <Card className="p-6">
          <p className="mb-2 text-[13px] text-muted">
            Every applicant’s resume is sent to TypeSafe Jev with exactly these checks. Jev answers each one on its own; the weights
            and thresholds below are applied in our code.
          </p>
          <RubricView rubric={opening.rubric} />
        </Card>
      )}

      {tab === 'Job description' && (
        <Card className="p-6 text-sm leading-relaxed whitespace-pre-line text-fg/85">
          {opening.jdFileKey && (
            <a href={`/api/files?key=${encodeURIComponent(opening.jdFileKey)}`} target="_blank" rel="noreferrer" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-brand-ink hover:underline">
              <FileText size={14} /> Original JD (PDF)
            </a>
          )}
          <div>{opening.description}</div>
        </Card>
      )}

      {tab === 'Applicants' && (
      <>
      <div className="mb-3 flex gap-1 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full px-3 py-1 text-[13px] whitespace-nowrap transition-colors',
              filter === f ? 'bg-fg text-white' : 'text-muted hover:bg-sunken'
            )}
          >
            {f} <span className="opacity-60">{count(f)}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No applicants yet">
          Import a campus drive, share the careers page, or add people from the talent pool.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-faint">
                <th className="px-5 py-3 font-medium">Candidate</th>
                <th className="px-3 py-3 font-medium">Eligibility</th>
                <th className="px-3 py-3 font-medium">Fit</th>
                <th className="px-3 py-3 font-medium">Recommendation</th>
                <th className="px-5 py-3 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map(({ application, candidate, eligibility, flags }) => (
                <tr
                  key={application.id}
                  className="cursor-pointer hover:bg-sunken/50"
                  onClick={() => router.push(`/hr/candidates/${candidate.id}?opening=${opening.id}`)}
                >
                  <td className="px-5 py-3">
                    <Link href={`/hr/candidates/${candidate.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                      {candidate.name}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-faint">
                      <span className="font-mono">{candidate.usn ?? candidate.profile?.email ?? candidate.email}</span>
                      {candidate.source === 'careers' && <Badge tone="brand">Careers</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <EligibilityBadge result={eligibility} />
                      <FlagBadges flags={flags} />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <ScoreMeter score={application.evaluation?.fitScore} />
                  </td>
                  <td className="px-3 py-3">
                    <RecommendationBadge application={application} />
                  </td>
                  <td className="px-5 py-3">
                    <QuickDecision application={application} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p className="px-5 py-6 text-sm text-muted">Nobody matches this filter.</p>}
        </Card>
      )}

      <p className="mt-4 text-[12px] text-faint">
        Recommendations are decision support. Eligibility uses the college’s record where available; nobody is rejected
        automatically.
      </p>
      </>
      )}
    </>
  )
}

function matchesFilter(
  f: Filter,
  r: { application: Application; eligibility: EligibilityResult; flags: VerificationFlag[] }
) {
  switch (f) {
    case 'All':
      return true
    case 'Eligible':
      return r.eligibility.status === 'eligible'
    case 'Not eligible':
      return r.eligibility.status === 'ineligible'
    case 'To verify':
      return r.flags.some((x) => x.severity === 'warn')
    default:
      return r.application.evaluation?.recommendation === f.toUpperCase()
  }
}
