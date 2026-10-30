'use client'

import Link from 'next/link'
import { ArrowRight, GraduationCap, Plus } from 'lucide-react'
import { Badge, Button, ButtonLink, Card, PageHeader, PageLoading, Serif } from '@/components/ui'
import { verificationFlags } from '@/lib/eligibility'
import { clearPool, loadDemoOpenings, useDb, useHydrated } from '@/lib/store'
import { confirmAction } from '@/components/confirm-dialog'

export default function OverviewPage() {
  const db = useDb()
  if (!useHydrated()) return <PageLoading />

  const open = db.openings.filter((o) => o.status === 'open')
  const unscored = db.applications.filter((a) => !a.evaluation).length
  const toVerify = db.candidates.filter((c) => verificationFlags(c).some((f) => f.severity === 'warn')).length

  const stats = [
    { label: 'Open roles', value: open.length, href: '/hr/openings' },
    { label: 'Campus drives', value: db.drives.length, href: '/hr/campus' },
    { label: 'In the talent pool', value: db.candidates.filter((c) => c.inPool).length, href: '/hr/pool' },
    { label: 'Need verification', value: toVerify }
  ]

  return (
    <>
      <PageHeader eyebrow="HR workspace" title={<>Hiring, <Serif>at a glance.</Serif></>}>
        <ButtonLink href="/hr/openings/new" variant="secondary">
          <Plus size={15} /> New role
        </ButtonLink>
        <ButtonLink href="/hr/campus/new">
          <GraduationCap size={15} /> New campus drive
        </ButtonLink>
      </PageHeader>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line lg:grid-cols-4">
        {stats.map((s) => {
          const body = (
            <>
              <p className="text-3xl font-semibold tracking-[-0.03em] tabular-nums">{s.value}</p>
              <p className="mt-1 text-[13px] text-muted">{s.label}</p>
            </>
          )
          return s.href ? (
            <Link key={s.label} href={s.href} className="bg-elev px-5 py-5 hover:bg-sunken/50">
              {body}
            </Link>
          ) : (
            <div key={s.label} className="bg-elev px-5 py-5">
              {body}
            </div>
          )
        })}
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Open roles</h2>
          {unscored > 0 && <span className="text-[13px] text-muted">{unscored} applications not yet scored</span>}
        </div>
        {open.length === 0 ? (
          <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-medium">No roles yet</p>
              <p className="text-sm text-muted">
                Start a campus drive for a college and add its roles there, or create a careers-page role. For a quick demo, load
                Kestrel Capital’s sample careers role (SDE-2); campus templates are offered inside each drive.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={loadDemoOpenings}>
                Load sample careers role
              </Button>
              <ButtonLink href="/hr/openings/new">Create a role</ButtonLink>
            </div>
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {open.map((o) => {
              const apps = db.applications.filter((a) => a.openingId === o.id)
              const interview = apps.filter((a) => a.evaluation?.recommendation === 'INTERVIEW').length
              return (
                <Link key={o.id} href={`/hr/openings/${o.id}`} className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-sunken/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{o.title}</p>
                    <p className="font-mono text-[11.5px] text-faint">
                      {o.reqId} · {o.experience} {o.ctc && `· ${o.ctc}`}
                    </p>
                  </div>
                  <Badge tone={o.source === 'campus' ? 'info' : 'brand'}>{o.source === 'campus' ? 'Campus' : 'Careers page'}</Badge>
                  <span className="w-36 text-right text-[13px] text-muted tabular-nums">
                    {apps.length} applied · <span className="text-good">{interview} interview</span>
                  </span>
                  <ArrowRight size={15} className="text-faint transition-transform group-hover:translate-x-0.5" />
                </Link>
              )
            })}
          </Card>
        )}
      </section>

      {db.candidates.length + db.openings.length > 0 && (
        <div className="mt-14 border-t border-line pt-4 text-right">
          <button
            className="text-xs text-faint hover:text-bad"
            onClick={async () => {
              const ok = await confirmAction({
                title: 'Delete all data?',
                body: 'Every role, campus drive, candidate and application will be permanently deleted from the database.',
                confirmLabel: 'Delete everything',
                destructive: true
              })
              if (ok) clearPool()
            }}
          >
            Reset all data
          </button>
        </div>
      )}
    </>
  )
}
