'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, FileText, Info, Loader2, Mail, Phone, RotateCw, Trash2, UserPlus } from 'lucide-react'
import { EligibilityBadge, QuickDecision, RecommendationBadge, ScoreMeter, StageSelect } from '@/components/status'
import { Badge, Button, Card, EmptyState, PageLoading, Select } from '@/components/ui'
import { checkEligibility, verificationFlags } from '@/lib/eligibility'
import { allSkills } from '@/lib/resume'
import { applyTo, deleteCandidate, evaluateApplications, setInPool, useDb, useHydrated } from '@/lib/store'
import type { Academics, Application, Candidate, Evaluation, Opening } from '@/lib/types'
import { cn } from '@/lib/utils'
import { confirmAction } from '@/components/confirm-dialog'

export default function CandidatePage() {
  const { id } = useParams<{ id: string }>()
  const db = useDb()
  const hydrated = useHydrated()
  const router = useRouter()
  const [target, setTarget] = useState('')

  if (!hydrated) return <PageLoading />
  const candidate = db.candidates.find((c) => c.id === id)
  if (!candidate) return <EmptyState title="Candidate not found" />

  const applications = db.applications.filter((a) => a.candidateId === candidate.id)
  const flags = verificationFlags(candidate)
  const drive = db.drives.find((d) => d.id === candidate.driveId)
  // Students outside the pool can only be moved between roles at their own drive.
  const otherOpenings = db.openings.filter(
    (o) =>
      o.status === 'open' &&
      !applications.some((a) => a.openingId === o.id) &&
      (candidate.inPool || !drive || o.driveId === drive.id)
  )
  const profile = candidate.profile
  const email = candidate.email ?? profile?.email

  async function remove() {
    const ok = await confirmAction({
      title: `Delete ${candidate!.name}?`,
      body: `Their profile${applications.length ? ` and ${applications.length} application${applications.length > 1 ? 's' : ''}` : ''} will be permanently deleted. This can’t be undone.`,
      confirmLabel: 'Delete candidate',
      destructive: true
    })
    if (!ok) return
    deleteCandidate(candidate!.id)
    router.push(drive && !candidate!.inPool ? `/hr/campus/${drive.id}` : '/hr/pool')
  }

  function consider() {
    if (!target) return
    const application = applyTo(candidate!.id, target)
    void evaluateApplications([application.id])
    setTarget('')
  }

  return (
    <>
      <Link
        href={drive && !candidate.inPool ? `/hr/campus/${drive.id}` : '/hr/pool'}
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"
      >
        <ArrowLeft size={14} /> {drive && !candidate.inPool ? drive.college : 'Talent pool'}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">{candidate.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
            {candidate.usn && <span className="font-mono">{candidate.usn}</span>}
            {candidate.college && <span>{candidate.college}</span>}
            {email && (
              <a href={`mailto:${email}`} className="flex items-center gap-1 hover:text-fg">
                <Mail size={13} /> {email}
              </a>
            )}
            {(candidate.phone ?? profile?.phone) && (
              <span className="flex items-center gap-1">
                <Phone size={13} /> {candidate.phone ?? profile?.phone}
              </span>
            )}
            {profile?.links.github && (
              <a href={`https://${profile.links.github}`} target="_blank" rel="noreferrer" className="hover:text-fg">
                {profile.links.github}
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {candidate.inPool ? (
            <>
              <Badge tone="brand">In talent pool</Badge>
              {candidate.source === 'campus' && (
                <Button size="sm" variant="ghost" onClick={() => setInPool([candidate.id], false)}>
                  Remove from pool
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setInPool([candidate.id], true)}>
              <UserPlus size={14} /> Add to talent pool
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={remove} className="hover:text-bad" aria-label={`Delete ${candidate.name}`}>
            <Trash2 size={14} /> Delete
          </Button>
        {otherOpenings.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 w-56 text-[13px]">
              <option value="">Consider for another role…</option>
              {otherOpenings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </Select>
            <Button size="sm" onClick={consider} disabled={!target}>
              Add &amp; score
            </Button>
          </div>
        )}
        </div>
      </div>

      {flags.length > 0 && (
        <div className="mb-6 space-y-2">
          {flags.map((f) => (
            <div
              key={f.kind}
              className={cn(
                'flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm',
                f.severity === 'warn' ? 'bg-warn-soft text-[#7a5212]' : 'bg-sunken text-muted'
              )}
            >
              {f.severity === 'warn' ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <Info size={15} className="mt-0.5 shrink-0" />}
              <span>
                {f.message}
                {f.severity === 'warn' && <span className="opacity-70"> Confirm with the candidate or college before deciding.</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <h2 className="font-semibold">Applications</h2>
          {applications.length === 0 && <EmptyState title="Not applied to anything yet">Use “Consider for another role” above.</EmptyState>}
          {applications.map((a) => {
            const opening = db.openings.find((o) => o.id === a.openingId)
            return opening ? <ApplicationCard key={a.id} application={a} opening={opening} candidate={candidate} /> : null
          })}
        </div>

        <div className="space-y-4">
          <AcademicsCard candidate={candidate} />
          {profile && (
            <Card className="p-5">
              <h2 className="mb-3 font-medium">Skills found</h2>
              <div className="flex flex-wrap gap-1">
                {allSkills(profile).map((s) => (
                  <span key={s} className="rounded bg-sunken px-1.5 py-0.5 text-[12px] text-muted">
                    {s}
                  </span>
                ))}
              </div>
              {profile.projects.length > 0 && (
                <>
                  <h2 className="mt-5 mb-2 font-medium">Projects</h2>
                  <ul className="space-y-1.5 text-[13px] text-muted">
                    {profile.projects.slice(0, 8).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </>
              )}
              {profile.fileKey ? (
                <a
                  href={`/api/files?key=${encodeURIComponent(profile.fileKey)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-brand-ink hover:underline"
                >
                  <FileText size={14} /> Original resume (PDF)
                </a>
              ) : (
                candidate.resumeFileName && <p className="mt-4 font-mono text-[11px] text-faint">{candidate.resumeFileName}</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function ApplicationCard({ application, opening, candidate }: { application: Application; opening: Opening; candidate: Candidate }) {
  const [rescoring, setRescoring] = useState(false)
  const eligibility = checkEligibility(candidate, opening.rules)
  const ev = application.evaluation

  async function rescore() {
    setRescoring(true)
    await evaluateApplications([application.id])
    setRescoring(false)
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/hr/openings/${opening.id}`} className="font-medium hover:underline">
            {opening.title}
          </Link>
          <p className="font-mono text-[11.5px] text-faint">{opening.reqId}</p>
        </div>
        <div className="flex items-center gap-2">
          <RecommendationBadge application={application} />
          <QuickDecision application={application} />
          <StageSelect application={application} />
        </div>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <p className="text-[12px] font-medium text-faint uppercase">Eligibility</p>
            <EligibilityBadge result={eligibility} />
          </div>
          <ul className="space-y-1 text-[13px]">
            {eligibility.checks.map((c) => (
              <li key={c.rule} className="flex justify-between gap-3">
                <span className="text-muted">{c.rule}</span>
                <span className={cn('font-mono text-[12px]', c.status === 'fail' ? 'text-bad' : c.status === 'unknown' ? 'text-warn' : 'text-fg')}>
                  {c.detail}
                </span>
              </li>
            ))}
            {eligibility.checks.length === 0 && <li className="text-muted">No hard rules for this role.</li>}
            {eligibility.selfDeclared && eligibility.checks.length > 0 && (
              <li className="pt-1 text-[12px] text-faint">Based on the resume; no college record.</li>
            )}
          </ul>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-medium text-faint uppercase">Role fit</p>
            <button onClick={rescore} disabled={rescoring} className="flex items-center gap-1 text-[12px] text-muted hover:text-fg">
              {rescoring ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
              {ev ? 'Re-score' : 'Score'}
            </button>
          </div>
          {ev ? (
            <>
              <ScoreMeter score={ev.fitScore} />
              <ul className="mt-3 space-y-1 text-[13px] text-muted">
                {ev.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[13px] text-muted">{application.evaluationError ?? 'Not scored yet.'}</p>
          )}
        </div>
      </div>

      {ev && <ScoreBreakdown evaluation={ev} />}
    </Card>
  )
}

/** Every rubric check: what Jev answered, how much it weighs, and the points it added. */
function ScoreBreakdown({ evaluation }: { evaluation: Evaluation }) {
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="mb-2 text-[12px] font-medium text-faint uppercase">How the score was computed</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-faint">
              <th className="pb-2 font-medium">Check</th>
              <th className="pb-2 font-medium">Jev’s answer</th>
              <th className="pb-2 pl-4 text-right font-medium">Weight</th>
              <th className="pb-2 pl-4 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {evaluation.results.map((r) => (
              <tr key={r.key} className="align-top">
                <td className="py-2 pr-3">
                  <span className="font-medium">{r.label}</span>
                  {r.mustHave && <span className="ml-1.5 text-[11px] text-bad">must-have</span>}
                </td>
                <td className="py-2 pr-3">
                  {r.type === 'score' ? (
                    <>
                      <span className="font-mono">{r.level?.toFixed(1)}</span>
                      <span className="text-faint"> / 3</span>
                      <span className="text-muted"> · {r.levelText}</span>
                    </>
                  ) : (
                    <span className={cn(r.value >= 0.7 ? 'text-good' : r.value <= 0.3 ? 'text-bad' : 'text-warn')}>
                      {r.value >= 0.7 ? 'Yes' : r.value <= 0.3 ? 'No' : 'Unsure'}{' '}
                      <span className="font-mono text-[12px]">({Math.round(r.value * 100)}%)</span>
                    </span>
                  )}
                  {r.lowConfidence && <span className="ml-1.5 text-[11px] text-warn">low confidence</span>}
                </td>
                <td className="py-2 pl-4 text-right font-mono text-muted">{r.weight}</td>
                <td className="py-2 pl-4 text-right font-mono">{r.contribution.toFixed(1)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="pt-2 text-right text-muted">
                Fit score
              </td>
              <td className="pt-2 text-right font-mono font-semibold">{evaluation.fitScore}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] text-faint">Answered by TypeSafe {evaluation.model}. Points = answer (0–1) × weight share of 100.</p>
    </div>
  )
}

const ACADEMIC_ROWS: Array<[keyof Academics, string]> = [
  ['branch', 'Branch'],
  ['batch', 'Batch'],
  ['cgpa', 'CGPA'],
  ['classXII', 'Class XII %'],
  ['diplomaPct', 'Diploma %'],
  ['activeBacklogs', 'Active backlogs'],
  ['backlogHistory', 'Backlog history']
]

function AcademicsCard({ candidate }: { candidate: Candidate }) {
  const record = candidate.record
  const declared = candidate.profile?.declared
  return (
    <Card className="p-5">
      <h2 className="font-medium">Academics</h2>
      <table className="mt-3 w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] text-faint uppercase">
            <th className="pb-1.5 font-medium" />
            <th className="pb-1.5 font-medium">College</th>
            <th className="pb-1.5 font-medium">Resume</th>
          </tr>
        </thead>
        <tbody>
          {ACADEMIC_ROWS.map(([key, label]) => {
            const r = record?.[key]
            const d = declared?.[key]
            const mismatch = r !== undefined && d !== undefined && String(r) !== String(d) && key !== 'branch'
            return (
              <tr key={key} className="border-t border-line">
                <td className="py-1.5 text-muted">{label}</td>
                <td className="py-1.5 font-mono text-[12px]">{fmt(r)}</td>
                <td className={cn('py-1.5 font-mono text-[12px]', mismatch && 'font-semibold text-bad')}>{fmt(d)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!record && <Badge className="mt-3">No college record</Badge>}
    </Card>
  )
}

function fmt(v: string | number | undefined) {
  if (v === undefined) return <span className="text-faint">n/a</span>
  return typeof v === 'string' && v.length > 18 ? `${v.slice(0, 16)}…` : v
}
