'use client'

import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import { SiteFooter, SiteNav } from '@/components/site-nav'
import { Badge, Card, EmptyState, Serif } from '@/components/ui'
import { useDb, useHydrated } from '@/lib/store'

export default function CareersPage() {
  const { openings } = useDb()
  const hydrated = useHydrated()
  const listed = openings.filter((o) => o.status === 'open' && o.source === 'careers')
  const company = listed[0]?.company ?? openings[0]?.company ?? 'Kestrel Capital'

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 pt-36 pb-24">
        <p className="font-mono text-[11px] tracking-wider text-faint uppercase">{company} · Careers</p>
        <h1 className="mt-3 text-5xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
          Build what millions <Serif>invest with.</Serif>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Open roles outside campus season. Apply once, and we’ll keep your profile in mind for future roles too.
        </p>

        <div className="mt-12 space-y-3">
          {hydrated && listed.length === 0 && (
            <EmptyState title="No open roles right now">
              HR can publish one from the workspace by creating an opening with “Careers page” selected.
            </EmptyState>
          )}
          {listed.map((o) => (
            <Link key={o.id} href={`/careers/${o.id}`} className="group block">
              <Card className="flex items-center gap-4 p-5 transition-shadow group-hover:shadow-card">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.title}</p>
                  <p className="mt-1 line-clamp-1 text-sm text-muted">{o.summary}</p>
                  <div className="mt-2 flex items-center gap-3 text-[12px] text-faint">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {o.location}
                    </span>
                    {o.ctc && <Badge>{o.ctc}</Badge>}
                  </div>
                </div>
                <ArrowRight size={16} className="text-faint transition-transform group-hover:translate-x-0.5" />
              </Card>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
