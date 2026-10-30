'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Copy, Download, Loader2, Pencil, Play, Plus, RotateCcw, Trash2, Upload, UserPlus } from 'lucide-react'
import { DriveImport } from '@/components/drive-import'
import { RulesSummary } from '@/components/rules-summary'
import { FlagBadges, RecommendationBadge } from '@/components/status'
import { Badge, Button, ButtonLink, Card, EmptyState, Input, PageHeader, PageLoading, Select } from '@/components/ui'
import { CAMPUS_TEMPLATES } from '@/lib/demo'
import { academicsOf, checkEligibility, verificationFlags } from '@/lib/eligibility'
import { NO_RESUME, copyRoleToDrive, deleteDrive, deleteOpening, evaluateApplications, setInPool, updateDrive, useDb, useHydrated } from '@/lib/store'
import type { Application, Opening } from '@/lib/types'
import { cn, downloadCsv } from '@/lib/utils'
import { confirmAction } from '@/components/confirm-dialog'

export default function DrivePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const db = useDb()
  const hydrated = useHydrated()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [importing, setImporting] = useState(false)
  const [editing, setEditing] = useState(false)

  const drive = db.drives.find((d) => d.id === id)
  const roles = useMemo(() => db.openings.filter((o) => o.driveId === id), [db.openings, id])
  const appsByStudent = useMemo(() => {
    const map = new Map<string, Application[]>()
    for (const a of db.applications) map.set(a.candidateId, [...(map.get(a.candidateId) ?? []), a])
    return map
  }, [db.applications])
  // Strongest first: by each student's best fit score across their roles; no score sinks to the bottom.
  const students = useMemo(() => {
    const best = (cid: string) => Math.max(-1, ...(appsByStudent.get(cid) ?? []).map((a) => a.evaluation?.fitScore ?? -1))
    return db.candidates.filter((c) => c.driveId === id).sort((a, b) => best(b.id) - best(a.id))
  }, [db.candidates, appsByStudent, id])

  if (!hydrated) return <PageLoading />
  if (!drive) return <EmptyState title="Drive not found">It may have been deleted.</EmptyState>

  const appsOf = (cid: string) => (appsByStudent.get(cid) ?? []).filter((a) => roles.some((r) => r.id === a.openingId))
  const scorable = students.flatMap((s) => appsOf(s.id)).filter((a) => a.evaluationError !== NO_RESUME)
  const unscored = scorable.filter((a) => !a.evaluation).map((a) => a.id)
  const toVerify = students.filter((s) => verificationFlags(s).some((f) => f.severity === 'warn')).length
  const showImport = importing || (students.length === 0 && roles.length > 0)

  async function scoreAll() {
    let ids = unscored
    if (!ids.length) {
      // Everything has a score: rescore all of them, e.g. after the rubric or a resume changed.
      ids = scorable.map((a) => a.id)
      const ok = await confirmAction({
        title: `Rescore ${ids.length} application${ids.length > 1 ? 's' : ''}?`,
        body: 'Every fit score and recommendation in this drive is recalculated. Shortlist, hold and reject decisions are kept.',
        confirmLabel: 'Rescore'
      })
      if (!ok) return
    }
    setProgress({ done: 0, total: ids.length })
    await evaluateApplications(ids, (done) => setProgress({ done, total: ids.length }))
    setProgress(null)
  }

  async function remove() {
    const keep = students.filter((s) => s.inPool).length
    const parts = [
      roles.length && `${roles.length} role${roles.length > 1 ? 's' : ''}`,
      students.length - keep && `${students.length - keep} student${students.length - keep > 1 ? 's' : ''} and their applications`
    ].filter(Boolean)
    const ok = await confirmAction({
      title: `Delete the ${drive!.college} drive?`,
      body:
        (parts.length ? `This also deletes its ${parts.join(' and ')}. ` : '') +
        (keep ? `${keep} student${keep > 1 ? 's' : ''} already in the talent pool will be kept. ` : '') +
        'This can’t be undone.',
      confirmLabel: 'Delete drive',
      destructive: true
    })
    if (!ok) return
    deleteDrive(drive!.id)
    router.push('/hr/campus')
  }

  function toggle(cid: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(cid)) next.delete(cid)
      else next.add(cid)
      return next
    })
  }

  function exportCsv() {
    downloadCsv(`${drive!.college}-${drive!.batch}.csv`, [
      ['Name', 'USN', 'Branch', 'CGPA (college)', 'Best fit', ...roles.map((o) => o.title), 'Verification'],
      ...students.map((s) => {
        const fit = bestFit(appsOf(s.id), roles)
        return [
          s.name,
          s.usn ?? '',
          academicsOf(s).facts.branch ?? '',
          String(s.record?.cgpa ?? ''),
          fit ? `${fit.role.title} (${fit.score})` : '',
          ...roles.map((o) => {
            const a = appsOf(s.id).find((x) => x.openingId === o.id)
            if (!a) return ''
            return `${a.evaluation?.recommendation ?? 'not scored'} ${a.evaluation?.fitScore ?? ''} (${checkEligibility(s, o.rules).status})`.trim()
          }),
          verificationFlags(s).filter((f) => f.severity === 'warn').map((f) => f.message).join(' | ')
        ]
      })
    ])
  }

  return (
    <>
      {editing ? (
        <DriveEditor drive={drive} onClose={() => setEditing(false)} />
      ) : (
        <PageHeader eyebrow={`Campus drive · ${drive.batch} batch`} title={drive.college}>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={remove} className="hover:text-bad">
            <Trash2 size={14} /> Delete
          </Button>
          {students.length > 0 && (
            <>
              <Button variant="secondary" onClick={exportCsv}>
                <Download size={15} /> CSV
              </Button>
              <Button onClick={scoreAll} disabled={!scorable.length || !!progress} variant={unscored.length ? 'primary' : 'secondary'}>
                {progress ? <Loader2 size={15} className="animate-spin" /> : unscored.length ? <Play size={15} /> : <RotateCcw size={15} />}
                {progress ? `Scoring ${progress.done}/${progress.total}` : unscored.length ? `Score ${unscored.length}` : 'Rescore all'}
              </Button>
            </>
          )}
        </PageHeader>
      )}

      <RolesSection driveId={drive.id} roles={roles} applications={db.applications} otherRoles={db.openings.filter((o) => o.source === 'campus' && o.driveId !== drive.id)} drives={db.drives} />

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Students {students.length > 0 && <span className="text-faint">{students.length}</span>}</h2>
          {students.length > 0 && !importing && (
            <Button variant="secondary" size="sm" onClick={() => setImporting(true)} disabled={!roles.length}>
              <Upload size={14} /> Add more resumes
            </Button>
          )}
        </div>

        {roles.length === 0 && students.length === 0 && (
          <EmptyState title="Add a role first">Create the roles you’re offering at this college, then add the resumes.</EmptyState>
        )}

        {showImport && (
          <div className="mb-8">
            {importing && (
              <div className="mb-3 flex justify-end">
                <button className="text-xs text-muted underline" onClick={() => setImporting(false)}>
                  Cancel
                </button>
              </div>
            )}
            <DriveImport drive={drive} roles={roles} onDone={() => setImporting(false)} />
          </div>
        )}

        {students.length > 0 && !importing && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line sm:grid-cols-4">
              <Stat label="Students" value={students.length} />
              <Stat label="Roles" value={roles.length} />
              <Stat label="Without a resume" value={students.filter((s) => !s.profile).length} />
              <Stat label="Need verification" value={toVerify} />
            </div>

            {selected.size > 0 && (
              <Card className="sticky top-3 z-10 mb-4 flex flex-wrap items-center gap-3 px-4 py-3 shadow-card">
                <span className="text-sm font-medium">{selected.size} selected</span>
                <Button
                  size="sm"
                  onClick={() => {
                    setInPool([...selected], true)
                    setSelected(new Set())
                  }}
                >
                  <UserPlus size={14} /> Add to talent pool
                </Button>
                <span className="text-[12px] text-muted">Keeps them for future roles after this drive closes.</span>
                <button className="ml-auto text-xs text-muted hover:text-fg" onClick={() => setSelected(new Set())}>
                  Clear
                </button>
              </Card>
            )}

            <Card className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 700 + roles.length * 170 }}>
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-faint">
                    <th className="w-10 px-4 py-3" />
                    <th className="py-3 pr-3 font-medium">Student</th>
                    <th className="px-3 py-3 font-medium">CGPA</th>
                    <th className="px-3 py-3 font-medium">Best fit</th>
                    {roles.map((o) => (
                      <th key={o.id} className="px-3 py-3 font-medium">
                        <Link href={`/hr/openings/${o.id}`} className="hover:text-fg hover:underline">
                          {o.title}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {students.map((s) => {
                    const apps = appsOf(s.id)
                    const fit = bestFit(apps, roles)
                    const { facts, selfDeclared } = academicsOf(s)
                    return (
                      <tr key={s.id} className={cn('hover:bg-sunken/40', selected.has(s.id) && 'bg-brand-soft/40')}>
                        <td className="px-4 py-3">
                          <input type="checkbox" aria-label={`Select ${s.name}`} checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                        </td>
                        <td className="py-3 pr-3">
                          <Link href={`/hr/candidates/${s.id}`} className="font-medium hover:underline">
                            {s.name}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {s.usn && <span className="font-mono text-[11.5px] text-faint">{s.usn}</span>}
                            <FlagBadges flags={verificationFlags(s)} />
                            {s.inPool && <Badge tone="brand">In pool</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-[13px] tabular-nums">
                          {facts.cgpa ?? 'n/a'}
                          {selfDeclared && facts.cgpa !== undefined && <span className="ml-1 text-[11px] text-faint">(self)</span>}
                        </td>
                        <td className="px-3 py-3 text-[13px]">
                          {fit ? (
                            <span>
                              <span className="font-medium">{fit.role.title.split(',')[0]}</span>{' '}
                              <span className="font-mono text-muted">{fit.score}</span>
                            </span>
                          ) : (
                            <span className="text-faint">n/a</span>
                          )}
                        </td>
                        {roles.map((o) => {
                          const a = apps.find((x) => x.openingId === o.id)
                          if (!a) return <td key={o.id} className="px-3 py-3 text-[12px] text-faint">Not considered</td>
                          const eligible = checkEligibility(s, o.rules)
                          return (
                            <td key={o.id} className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <RecommendationBadge application={a} />
                                {a.evaluation && <span className="font-mono text-[12px] text-muted">{a.evaluation.fitScore}</span>}
                              </div>
                              {eligible.status === 'ineligible' && (
                                <p className="mt-0.5 text-[11.5px] text-bad">
                                  Not eligible: {eligible.checks.filter((c) => c.status === 'fail').map((c) => c.rule).join(', ')}
                                </p>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
            <p className="mt-4 text-[12px] text-faint">
              Best fit is the role with the highest fit score. Students stay in this drive; add the ones worth keeping to the talent pool.
            </p>
          </>
        )}
      </section>
    </>
  )
}

function bestFit(apps: Application[], roles: Opening[]) {
  const scored = apps.filter((a) => a.evaluation).sort((a, b) => b.evaluation!.fitScore - a.evaluation!.fitScore)[0]
  const role = scored && roles.find((r) => r.id === scored.openingId)
  return role ? { role, score: scored.evaluation!.fitScore } : null
}

function RolesSection({
  driveId,
  roles,
  applications,
  otherRoles,
  drives
}: {
  driveId: string
  roles: Opening[]
  applications: Application[]
  otherRoles: Opening[]
  drives: { id: string; college: string }[]
}) {
  const [template, setTemplate] = useState('')
  const returnTo = encodeURIComponent(`/hr/campus/${driveId}`)

  function copy() {
    const [kind, key] = template.split(':')
    const source = kind === 'template' ? CAMPUS_TEMPLATES[Number(key)] : otherRoles.find((o) => o.id === key)
    if (source) copyRoleToDrive(source, driveId)
    setTemplate('')
  }

  async function remove(role: Opening) {
    const count = applications.filter((a) => a.openingId === role.id).length
    const ok = await confirmAction({
      title: `Remove ${role.title} from this drive?`,
      body: count ? `Its ${count} applications and their scores will be deleted too.` : 'Students in the drive are not affected.',
      confirmLabel: 'Delete role',
      destructive: true
    })
    if (ok) deleteOpening(role.id)
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Roles at this drive</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={template} onChange={(e) => setTemplate(e.target.value)} className="h-9 w-64 text-[13px]" aria-label="Copy a role">
            <option value="">Copy a role from a template…</option>
            <optgroup label="Templates">
              {CAMPUS_TEMPLATES.map((t, i) => (
                <option key={t.reqId} value={`template:${i}`}>
                  {t.title}
                </option>
              ))}
            </optgroup>
            {otherRoles.length > 0 && (
              <optgroup label="Your other campus roles">
                {otherRoles.map((o) => (
                  <option key={o.id} value={`role:${o.id}`}>
                    {o.title} ({drives.find((d) => d.id === o.driveId)?.college ?? 'no drive'})
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
          <Button variant="secondary" size="sm" onClick={copy} disabled={!template}>
            <Copy size={14} /> Copy
          </Button>
          <ButtonLink href={`/hr/openings/new?driveId=${driveId}&returnTo=${returnTo}`} size="sm">
            <Plus size={14} /> Create role
          </ButtonLink>
        </div>
      </div>

      {roles.length === 0 ? (
        <Card className="px-5 py-6 text-sm text-muted">
          No roles yet. Create one from its JD, or copy a template and adjust it for this college. Rubrics and cutoffs belong to this
          drive only.
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {roles.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <Link href={`/hr/openings/${o.id}`} className="font-medium hover:underline">
                  {o.title}
                </Link>
                <RulesSummary rules={o.rules} />
              </div>
              <span className="text-[13px] text-muted">
                {o.rubric.length} checks · {applications.filter((a) => a.openingId === o.id).length} applicants
              </span>
              <ButtonLink href={`/hr/openings/${o.id}/edit?returnTo=${returnTo}`} variant="ghost" size="sm" aria-label={`Edit ${o.title}`}>
                <Pencil size={14} />
              </ButtonLink>
              <Button variant="ghost" size="sm" onClick={() => remove(o)} aria-label={`Delete ${o.title}`} className="hover:text-bad">
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </Card>
      )}
    </section>
  )
}

function DriveEditor({ drive, onClose }: { drive: { id: string; college: string; batch: number }; onClose: () => void }) {
  const [college, setCollege] = useState(drive.college)
  const [batch, setBatch] = useState(drive.batch)
  return (
    <Card className="mb-6 flex flex-wrap items-end gap-3 p-5">
      <div className="min-w-64 flex-1">
        <label className="mb-1.5 block text-[13px] font-medium text-muted" htmlFor="edit-college">
          College
        </label>
        <Input id="edit-college" value={college} onChange={(e) => setCollege(e.target.value)} />
      </div>
      <div className="w-28">
        <label className="mb-1.5 block text-[13px] font-medium text-muted" htmlFor="edit-batch">
          Batch
        </label>
        <Input id="edit-batch" type="number" value={batch} onChange={(e) => setBatch(Number(e.target.value))} />
      </div>
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button
        disabled={!college.trim()}
        onClick={() => {
          updateDrive(drive.id, { college, batch })
          onClose()
        }}
      >
        Save
      </Button>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-elev px-5 py-4">
      <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums">{value}</p>
      <p className="text-[13px] text-muted">{label}</p>
    </div>
  )
}
