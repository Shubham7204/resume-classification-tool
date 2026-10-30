'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, Upload } from 'lucide-react'
import { FlagBadges, RecommendationBadge } from '@/components/status'
import { TalentAgent } from '@/components/talent-agent'
import { Badge, Button, Card, EmptyState, Input, PageHeader, PageLoading, Select, Serif } from '@/components/ui'
import { verificationFlags } from '@/lib/eligibility'
import { allSkills, availabilityOf, latestRole } from '@/lib/resume'
import { searchPool } from '@/lib/search'
import { applyTo, evaluateApplications, upsertCandidate, useDb, useHydrated } from '@/lib/store'
import type { CandidateSource, ResumeProfile } from '@/lib/types'
import { cn, mapLimit } from '@/lib/utils'

const SOURCE_LABEL: Record<CandidateSource, string> = {
  campus: 'Campus',
  careers: 'Careers page',
  hr_upload: 'HR upload'
}

export default function PoolPage() {
  const db = useDb()
  const hydrated = useHydrated()
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<CandidateSource | 'all'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState('')
  const uploadInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])

  const pool = useMemo(() => db.candidates.filter((c) => c.inPool), [db.candidates])
  const hits = useMemo(
    () => searchPool(pool, query).filter((h) => source === 'all' || h.candidate.source === source),
    [pool, query, source]
  )

  if (!hydrated) return <PageLoading />

  const openOpenings = db.openings.filter((o) => o.status === 'open')

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function uploadResumes(files: File[]) {
    if (!files.length) return
    setUploadErrors([])
    setUploading({ done: 0, total: files.length })
    let done = 0
    const failed: string[] = []
    await mapLimit(files, 4, async (file) => {
      const form = new FormData()
      form.append('file', file)
      try {
        const res = await fetch('/api/parse-resume', { method: 'POST', body: form })
        const profile = (await res.json()) as ResumeProfile & { error?: string }
        if (!res.ok) throw new Error(profile.error)
        upsertCandidate({
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          source: 'hr_upload',
          inPool: true,
          profile,
          resumeFileName: file.name
        })
      } catch {
        failed.push(file.name)
      }
      setUploading({ done: ++done, total: files.length })
    })
    setUploadErrors(failed)
    setUploading(null)
  }

  function addToOpening() {
    if (!target) return
    const ids = [...selected].map((cid) => applyTo(cid, target).id)
    void evaluateApplications(ids.filter((id) => !db.applications.find((a) => a.id === id)?.evaluation))
    setSelected(new Set())
  }

  return (
    <>
      <PageHeader eyebrow="Talent pool" title={<>{pool.length} people, <Serif>ready for the next role.</Serif></>}>
        <Button variant="secondary" onClick={() => uploadInput.current?.click()} disabled={!!uploading}>
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {uploading ? `Reading ${uploading.done}/${uploading.total}` : 'Upload resumes'}
        </Button>
        <input
          ref={uploadInput}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            void uploadResumes(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
      </PageHeader>
      <p className="-mt-3 mb-5 max-w-2xl text-sm text-muted">
        Careers-page applicants land here automatically, and you can upload resumes you already have. Campus students stay in
        their drive unless you add them from the drive page.
      </p>
      {uploadErrors.length > 0 && <p className="-mt-2 mb-4 text-[13px] text-bad">Couldn’t read: {uploadErrors.join(', ')}</p>}

      <TalentAgent pool={pool} />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by keyword: skills, companies, colleges…"
            className="pl-9"
          />
        </div>
        <Select value={source} onChange={(e) => setSource(e.target.value as CandidateSource | 'all')} className="sm:w-44">
          <option value="all">All sources</option>
          <option value="campus">Campus</option>
          <option value="careers">Careers page</option>
          <option value="hr_upload">HR upload</option>
        </Select>
      </div>

      {selected.size > 0 && (
        <Card className="sticky top-3 z-10 mb-4 flex flex-wrap items-center gap-3 px-4 py-3 shadow-card">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 max-w-xs flex-1 text-[13px]">
            <option value="">Consider for opening…</option>
            {openOpenings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={addToOpening} disabled={!target}>
            Add &amp; score
          </Button>
          <button className="ml-auto text-xs text-muted hover:text-fg" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </Card>
      )}

      {pool.length === 0 ? (
        <EmptyState title="The pool is empty">
          Publish a role on the careers page, or add standout students from a campus drive.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-faint">
                <th className="w-10 px-4 py-3" />
                <th className="py-3 pr-3 font-medium">Person</th>
                <th className="px-3 py-3 font-medium">Latest role · availability</th>
                <th className="px-3 py-3 font-medium">Top skills</th>
                <th className="px-3 py-3 font-medium">Applications</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {hits.map(({ candidate, matched }) => {
                const availability = availabilityOf(candidate.profile)
                const apps = db.applications.filter((a) => a.candidateId === candidate.id)
                const skills = allSkills(candidate.profile)
                return (
                  <tr key={candidate.id} className={cn('hover:bg-sunken/50', selected.has(candidate.id) && 'bg-brand-soft/40')}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${candidate.name}`}
                        checked={selected.has(candidate.id)}
                        onChange={() => toggle(candidate.id)}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <Link href={`/hr/candidates/${candidate.id}`} className="font-medium hover:underline">
                        {candidate.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={candidate.source === 'campus' ? 'info' : candidate.source === 'careers' ? 'brand' : 'neutral'}>
                          {SOURCE_LABEL[candidate.source]}
                        </Badge>
                        <FlagBadges flags={verificationFlags(candidate)} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[13px]">
                      <p className="max-w-56 truncate">{latestRole(candidate.profile) ?? <span className="text-faint">n/a</span>}</p>
                      <p className={cn('max-w-56 truncate text-[12px]', availability ? 'text-good' : 'text-faint')}>
                        {availability ?? 'Availability not stated'}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {skills.slice(0, 6).map((s) => (
                          <span
                            key={s}
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[11.5px]',
                              matched.some((m) => s.includes(m.slice(0, 4))) ? 'bg-brand-soft text-brand-ink' : 'bg-sunken text-muted'
                            )}
                          >
                            {s}
                          </span>
                        ))}
                        {!candidate.profile && <span className="text-[12px] text-warn">No resume</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        {apps.length === 0 && <span className="text-[12px] text-faint">None yet</span>}
                        {apps.map((a) => (
                          <span key={a.id} className="flex items-center gap-1.5 text-[12px] text-muted">
                            <RecommendationBadge application={a} />
                            <span className="max-w-40 truncate">{db.openings.find((o) => o.id === a.openingId)?.title}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {hits.length === 0 && <p className="px-5 py-6 text-sm text-muted">No one matches “{query}”.</p>}
        </Card>
      )}
    </>
  )
}
