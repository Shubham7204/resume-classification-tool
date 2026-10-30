'use client'

import Link from 'next/link'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { RulesSummary } from '@/components/rules-summary'
import { Badge, Button, ButtonLink, Card, EmptyState, PageHeader, PageLoading, Serif } from '@/components/ui'
import { deleteOpening, useDb, useHydrated } from '@/lib/store'
import type { Application, Opening } from '@/lib/types'
import { confirmAction } from '@/components/confirm-dialog'

/** Every role, grouped by where it's hiring: the careers page, or a specific college's drive. */
export default function OpeningsPage() {
  const { openings, drives, applications } = useDb()
  if (!useHydrated()) return <PageLoading />

  const careers = openings.filter((o) => o.source === 'careers')
  // Campus roles from before roles belonged to drives.
  const unattached = openings.filter((o) => o.source === 'campus' && !o.driveId)
  const groups = drives
    .map((d) => ({ drive: d, roles: openings.filter((o) => o.driveId === d.id) }))
    .filter((g) => g.roles.length > 0)

  return (
    <>
      <PageHeader eyebrow="Openings" title={<>Roles you’re <Serif>hiring for.</Serif></>}>
        <ButtonLink href="/hr/campus" variant="secondary">
          Campus roles live in their drive
        </ButtonLink>
        <ButtonLink href="/hr/openings/new">
          <Plus size={15} /> New careers-page role
        </ButtonLink>
      </PageHeader>

      {openings.length === 0 && (
        <EmptyState title="No roles yet">Create a careers-page role here, or start a campus drive and add its roles there.</EmptyState>
      )}

      {careers.length > 0 && <Group title="Careers page" subtitle="Off-campus and lateral roles, shown publicly" roles={careers} applications={applications} />}
      {unattached.length > 0 && (
        <Group
          title="Not attached to a drive"
          subtitle="Older campus roles. Recreate them inside the right drive (or copy them there), then delete these."
          roles={unattached}
          applications={applications}
        />
      )}
      {groups.map(({ drive, roles }) => (
        <Group
          key={drive.id}
          title={drive.college}
          subtitle={`Campus drive · ${drive.batch} batch`}
          href={`/hr/campus/${drive.id}`}
          roles={roles}
          applications={applications}
        />
      ))}
    </>
  )
}

function Group({
  title,
  subtitle,
  href,
  roles,
  applications
}: {
  title: string
  subtitle: string
  href?: string
  roles: Opening[]
  applications: Application[]
}) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        {href ? (
          <Link href={href} className="font-semibold hover:underline">
            {title}
          </Link>
        ) : (
          <h2 className="font-semibold">{title}</h2>
        )}
        <p className="text-[13px] text-muted">{subtitle}</p>
      </div>
      <Card className="divide-y divide-line">
        {roles.map((o) => {
          const count = applications.filter((a) => a.openingId === o.id).length
          return (
            <div key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <Link href={`/hr/openings/${o.id}`} className="font-medium hover:underline">
                  {o.title}
                </Link>
                <RulesSummary rules={o.rules} />
              </div>
              {o.status === 'closed' && <Badge>Closed</Badge>}
              <span className="text-[13px] text-muted">{count} applicants</span>
              <ButtonLink href={`/hr/openings/${o.id}/edit`} variant="ghost" size="sm" aria-label={`Edit ${o.title}`}>
                <Pencil size={14} />
              </ButtonLink>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Delete ${o.title}`}
                className="hover:text-bad"
                onClick={async () => {
                  const ok = await confirmAction({
                    title: `Delete ${o.title}?`,
                    body: count ? `Its ${count} applications and their scores will be deleted too.` : 'This can’t be undone.',
                    confirmLabel: 'Delete role',
                    destructive: true
                  })
                  if (ok) deleteOpening(o.id)
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          )
        })}
      </Card>
    </section>
  )
}
