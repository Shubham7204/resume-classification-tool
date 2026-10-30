'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, Sparkles, X } from 'lucide-react'
import { RubricEditor, PolicyNote } from '@/components/rubric'
import { Button, Card, FileDrop, Input, Label, PageHeader, Select, Textarea } from '@/components/ui'
import { saveOpening, updateOpening, useDb } from '@/lib/store'
import type { Criterion, EligibilityRules, Opening, OpeningSource } from '@/lib/types'
import { uid } from '@/lib/utils'

/**
 * Create or edit a role. Campus roles created from a drive's page belong to that drive; their
 * rubric and cutoffs apply only there. Editing a rubric re-scores that role's applicants.
 */
export function OpeningForm({ initial, driveId, returnTo }: { initial?: Opening; driveId?: string; returnTo?: string | null }) {
  const router = useRouter()
  const { drives } = useDb()
  const editing = Boolean(initial)
  const drive = drives.find((d) => d.id === (initial?.driveId ?? driveId))

  const [title, setTitle] = useState(initial?.title ?? '')
  const [source, setSource] = useState<OpeningSource>(initial?.source ?? (drive ? 'campus' : 'careers'))
  const [company, setCompany] = useState(initial?.company ?? 'Kestrel Capital')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [experience, setExperience] = useState(initial?.experience ?? (drive ? `Freshers (${drive.batch} batch)` : ''))
  const [ctc, setCtc] = useState(initial?.ctc ?? '')
  const [reqId, setReqId] = useState(initial?.reqId ?? '')
  const [jdText, setJdText] = useState(initial?.description ?? '')
  const [jdFile, setJdFile] = useState<File | null>(null)

  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState('')
  const [generatedBy, setGeneratedBy] = useState('')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [rules, setRules] = useState<EligibilityRules>(initial?.rules ?? (drive ? { batch: drive.batch } : {}))
  const [rubric, setRubric] = useState<Criterion[] | null>(initial?.rubric ?? null)
  const [jdFileKey, setJdFileKey] = useState<string | undefined>(initial?.jdFileKey)

  async function draft() {
    setDrafting(true)
    setError('')
    const form = new FormData()
    form.append('title', title)
    if (jdFile) form.append('file', jdFile)
    else form.append('text', jdText)
    try {
      const res = await fetch('/api/draft-rubric', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setJdText(data.description)
      setJdFile(null)
      setSummary(data.summary)
      // Keep the drive's batch even if the JD doesn't state one.
      setRules({ ...data.rules, batch: data.rules.batch ?? drive?.batch })
      setRubric(data.rubric)
      setGeneratedBy(data.generatedBy)
      setJdFileKey(data.jdFileKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not draft a rubric')
    } finally {
      setDrafting(false)
    }
  }

  function publish() {
    if (!rubric) return
    const id = initial?.id ?? uid('op')
    const opening: Opening = {
      id,
      reqId: reqId || `REQ-${Date.now().toString().slice(-5)}`,
      title: title.trim(),
      company: company.trim(),
      source,
      driveId: source === 'campus' ? drive?.id : undefined,
      location: location.trim(),
      experience: experience.trim() || (source === 'campus' ? 'Freshers' : ''),
      ctc: ctc.trim() || undefined,
      summary: summary || title,
      description: jdText,
      jdFileKey,
      // College cutoffs only apply to campus hiring; off-campus experience is judged by the rubric.
      rules: source === 'campus' ? rules : {},
      rubric: rubric.filter((c) => c.question.trim()),
      status: initial?.status ?? 'open',
      createdAt: initial?.createdAt ?? new Date().toISOString()
    }
    if (editing) updateOpening(opening)
    else saveOpening(opening)
    router.push(returnTo ?? `/hr/openings/${id}`)
  }

  const setRule = <K extends keyof EligibilityRules>(key: K, value: EligibilityRules[K]) => setRules((r) => ({ ...r, [key]: value }))
  const hasJd = !!jdFile || jdText.trim().length >= 80

  return (
    <>
      <PageHeader
        eyebrow={drive ? `${drive.college} · ${drive.batch} batch` : editing ? 'Edit role' : 'New role'}
        title={editing ? `Edit ${initial!.title}` : 'Create a role'}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <h2 className="font-medium">1. The role</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role title" className="sm:col-span-2">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Associate Software Engineer" autoFocus />
              </Field>
              <Field label="Hiring for">
                {drive ? (
                  <Input value={`Campus drive: ${drive.college}`} disabled />
                ) : (
                  <Select value={source} onChange={(e) => setSource(e.target.value as OpeningSource)} disabled={editing}>
                    <option value="careers">Careers page (off-campus / lateral)</option>
                    <option value="campus" disabled>
                      Campus: create it from the drive’s page
                    </option>
                  </Select>
                )}
              </Field>
              <Field label="Company">
                <Input value={company} onChange={(e) => setCompany(e.target.value)} />
              </Field>
              <Field label="Location">
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bengaluru" />
              </Field>
              <Field label="Experience">
                <Input value={experience} onChange={(e) => setExperience(e.target.value)} placeholder={source === 'campus' ? 'Freshers (2027 batch)' : 'e.g. 2–4 years'} />
              </Field>
              <Field label="CTC">
                <Input value={ctc} onChange={(e) => setCtc(e.target.value)} placeholder="e.g. 12 LPA" />
              </Field>
              <Field label="Requisition ID (optional)">
                <Input value={reqId} onChange={(e) => setReqId(e.target.value)} placeholder="Auto-generated if empty" />
              </Field>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-medium">2. Job description</h2>
              <span className="text-[12px] text-faint">{source === 'careers' ? 'Shown as-is on the careers page' : 'Shared with the college'}</span>
            </div>
            {jdFile ? (
              <div className="flex items-center gap-3 rounded-xl bg-sunken px-4 py-3">
                <FileText size={16} className="text-muted" />
                <span className="flex-1 truncate text-sm">{jdFile.name}</span>
                <button onClick={() => setJdFile(null)} aria-label="Remove file" className="text-faint hover:text-fg">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <Textarea rows={10} placeholder="Paste the job description…" value={jdText} onChange={(e) => setJdText(e.target.value)} />
                <FileDrop accept=".pdf" onFiles={([f]) => setJdFile(f)} title="…or upload the JD as a PDF" />
              </>
            )}
            {error && <p className="text-sm text-bad">{error}</p>}
            <div className="flex justify-end">
              <Button onClick={draft} disabled={drafting || !title.trim() || !hasJd} variant={rubric ? 'secondary' : 'primary'}>
                {drafting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {drafting ? 'Reading the JD…' : rubric ? 'Redraft rubric' : 'Draft screening rubric'}
              </Button>
            </div>
          </Card>

          {rubric && (
            <Card className="space-y-4 p-6">
              <div>
                <h2 className="font-medium">3. Screening rubric</h2>
                <p className="mt-1 text-[13px] text-muted">
                  {generatedBy && `Drafted by ${generatedBy}. `}Every resume is judged on exactly these checks, so edit anything that
                  doesn’t match how you’d screen.{editing && ' Saving a changed rubric re-scores this role’s applicants.'}
                </p>
              </div>
              <RubricEditor rubric={rubric} onChange={setRubric} />
              <PolicyNote />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {source === 'campus' && (
          <Card className="h-fit space-y-4 p-6">
            <div>
              <h2 className="font-medium">Eligibility rules</h2>
              <p className="mt-1 text-[13px] text-muted">Hard cutoffs, checked against the college’s records. Filled in from the JD; leave empty for none.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Batch" value={rules.batch} onChange={(v) => setRule('batch', v)} />
              <NumberField label="Min CGPA" step={0.1} value={rules.minCgpa} onChange={(v) => setRule('minCgpa', v)} />
              <NumberField label="Min XII / diploma %" value={rules.minSchoolPct} onChange={(v) => setRule('minSchoolPct', v)} />
              <NumberField label="Max active backlogs" value={rules.maxActiveBacklogs} onChange={(v) => setRule('maxActiveBacklogs', v)} />
              <NumberField label="Max backlog history" value={rules.maxBacklogHistory} onChange={(v) => setRule('maxBacklogHistory', v)} />
            </div>
            <Field label="Branches (comma separated)">
              <Input
                placeholder="All branches"
                value={rules.branches?.join(', ') ?? ''}
                onChange={(e) => setRule('branches', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              />
            </Field>
          </Card>
          )}

          <Button onClick={publish} disabled={!rubric || !title.trim() || !rubric.some((c) => c.question.trim())} size="lg" className="w-full">
            {editing ? 'Save changes' : source === 'careers' ? 'Publish to careers page' : `Add role to ${drive?.college ?? 'drive'}`}
          </Button>
          {!rubric && <p className="text-center text-[12px] text-faint">Draft the rubric first. You can edit it before publishing.</p>}
        </div>
      </div>
    </>
  )
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function NumberField({ label, value, step = 1, onChange }: { label: string; value?: number; step?: number; onChange: (v: number | undefined) => void }) {
  return (
    <Field label={label}>
      <Input
        type="number"
        step={step}
        value={value ?? ''}
        placeholder="Any"
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </Field>
  )
}
