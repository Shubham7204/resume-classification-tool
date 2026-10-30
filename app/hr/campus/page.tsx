'use client'

import Link from 'next/link'
import { ArrowRight, GraduationCap, Plus } from 'lucide-react'
import { ButtonLink, PageHeader, PageLoading, Serif } from '@/components/ui'
import { useDb, useHydrated } from '@/lib/store'
import type { Application, Drive, Opening } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export default function CampusPage() {
  const db = useDb()
  if (!useHydrated()) return <PageLoading />

  return (
    <>
      <PageHeader eyebrow="Campus drives" title={<>Campus hiring, <Serif>college by college.</Serif></>}>
        <ButtonLink href="/hr/campus/new">
          <Plus size={15} /> New campus drive
        </ButtonLink>
      </PageHeader>

      {db.drives.length === 0 ? (
        <div className="rounded-3xl bg-elev px-6 py-16 text-center shadow-card ring-1 ring-line">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
            <GraduationCap size={22} />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">
            No drives yet. <Serif>Start with a college.</Serif>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted">
            Name the college and batch, add the roles you’re offering there, then drop in the resumes, with or without the placement
            cell’s sheet.
          </p>
          <ButtonLink href="/hr/campus/new" size="lg" className="mt-7">
            New campus drive <ArrowRight size={16} />
          </ButtonLink>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {db.drives.map((d, i) => (
            <DriveCard
              key={d.id}
              drive={d}
              index={i}
              roles={db.openings.filter((o) => o.driveId === d.id)}
              students={db.candidates.filter((c) => c.driveId === d.id).length}
              applications={db.applications}
            />
          ))}
        </div>
      )}
    </>
  )
}

function DriveCard({ drive, index, roles, students, applications }: { drive: Drive; index: number; roles: Opening[]; students: number; applications: Application[] }) {
  const roleIds = new Set(roles.map((r) => r.id))
  const apps = applications.filter((a) => roleIds.has(a.openingId))
  const count = (rec: string) => apps.filter((a) => a.evaluation?.recommendation === rec).length
  const outcomes = [
    { label: 'Interview', value: count('INTERVIEW'), color: 'bg-good' },
    { label: 'Screen', value: count('SCREEN'), color: 'bg-warn' },
    { label: 'Hold', value: count('HOLD'), color: 'bg-faint/50' }
  ]
  const scored = outcomes.reduce((s, o) => s + o.value, 0)

  return (
    <Link
      href={`/hr/campus/${drive.id}`}
      className="group block animate-rise rounded-3xl bg-elev p-6 shadow-[0_1px_2px_#12131a0a] ring-1 ring-line transition-shadow hover:shadow-card"
      style={{ animationDelay: `${index * 0.05}s`, '--rise-y': '14px' } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-wider text-brand-ink uppercase">{drive.batch} batch</p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-balance">{drive.college}</h2>
        </div>
        <ArrowRight size={17} className="mt-1 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Figure value={students} label="students" />
        <Figure value={roles.length} label={roles.length === 1 ? 'role' : 'roles'} />
        <Figure value={count('INTERVIEW')} label="to interview" accent />
      </div>

      <div className="mt-5">
        {scored > 0 ? (
          <>
            <div className="flex h-2 overflow-hidden rounded-full bg-sunken">
              {outcomes.map((o) => (
                <span key={o.label} className={o.color} style={{ width: `${(o.value / scored) * 100}%` }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
              {outcomes.map((o) => (
                <span key={o.label} className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${o.color}`} /> {o.label} {o.value}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-muted">{roles.length ? 'No resumes yet' : 'Add roles to get started'}</p>
        )}
      </div>

      {roles.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5 border-t border-line pt-4">
          {roles.map((r) => (
            <span key={r.id} className="rounded-full bg-sunken px-2.5 py-1 text-[12px] text-muted">
              {r.title.split(',')[0]}
            </span>
          ))}
        </div>
      )}
      <p className="mt-4 text-[11.5px] text-faint">Started {formatDate(drive.createdAt)}</p>
    </Link>
  )
}

function Figure({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={`text-3xl font-semibold tracking-[-0.04em] tabular-nums ${accent ? 'text-good' : ''}`}>{value}</p>
      <p className="text-[12px] text-muted">{label}</p>
    </div>
  )
}
