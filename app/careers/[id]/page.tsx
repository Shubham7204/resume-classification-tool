'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, FileText, Loader2 } from 'lucide-react'
import { SiteFooter, SiteNav } from '@/components/site-nav'
import { Button, Card, EmptyState, FileDrop, Input, Label } from '@/components/ui'
import { normalisePhone } from '@/lib/resume'
import { applyTo, evaluateApplications, upsertCandidate, useDb, useHydrated, whenSaved } from '@/lib/store'
import type { ResumeProfile } from '@/lib/types'

export default function CareerOpeningPage() {
  const { id } = useParams<{ id: string }>()
  const { openings } = useDb()
  const hydrated = useHydrated()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [resume, setResume] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')

  const opening = openings.find((o) => o.id === id)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!opening || !resume) return
    setStatus('sending')
    setError('')
    try {
      const form = new FormData()
      form.append('file', resume)
      const res = await fetch('/api/parse-resume', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const profile = data as ResumeProfile

      const candidate = upsertCandidate({
        name: name || profile.name,
        email: email.toLowerCase(),
        phone: phone ? normalisePhone(phone) : profile.phone,
        source: 'careers',
        inPool: true,
        profile,
        resumeFileName: resume.name
      })
      // Wait for scoring and saving so nothing is lost if the applicant closes the tab right after submitting.
      await evaluateApplications([applyTo(candidate.id, opening.id).id])
      await whenSaved()
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('idle')
    }
  }

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 pt-32 pb-24">
        <Link href="/careers" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg">
          <ArrowLeft size={14} /> All roles
        </Link>

        {hydrated && !opening && <EmptyState title="This role isn’t open" />}

        {opening && (
          <>
            <p className="mt-6 font-mono text-[11px] tracking-wider text-faint uppercase">
              {opening.company} · {opening.location} {opening.ctc && `· ${opening.ctc}`}
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{opening.title}</h1>
            <div className="mt-8 text-[15px] leading-relaxed whitespace-pre-line text-fg/85">{opening.description}</div>

            <Card className="mt-12 p-6">
              {status === 'done' ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 text-good" size={20} />
                  <div>
                    <p className="font-medium">Application received</p>
                    <p className="mt-1 text-sm text-muted">
                      Thanks{name ? `, ${name.split(' ')[0]}` : ''}. Our team will review your profile, and we may reach out
                      about other roles that fit you too.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <h2 className="text-lg font-semibold">Apply</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="name">Full name</Label>
                      <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                  {resume ? (
                    <div className="flex items-center gap-3 rounded-xl bg-sunken px-4 py-3 text-sm">
                      <FileText size={16} className="text-muted" />
                      <span className="flex-1 truncate">{resume.name}</span>
                      <button type="button" className="text-xs text-muted underline" onClick={() => setResume(null)}>
                        change
                      </button>
                    </div>
                  ) : (
                    <FileDrop accept=".pdf" onFiles={([f]) => setResume(f)} title="Attach your resume (PDF)" />
                  )}
                  {error && <p className="text-sm text-bad">{error}</p>}
                  <Button type="submit" variant="brand" size="lg" disabled={!resume || status === 'sending'}>
                    {status === 'sending' && <Loader2 size={16} className="animate-spin" />}
                    Submit application
                  </Button>
                </form>
              )}
            </Card>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
