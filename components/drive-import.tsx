'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileText, Loader2 } from 'lucide-react'
import { Badge, Button, Card, FileDrop, Label, Select } from '@/components/ui'
import { guessOpening, matchResumeToRow, parseCollegeSheet, readSheetFile, type CollegeRow, type MatchMethod } from '@/lib/college-sheet'
import { applyTo, evaluateApplications, upsertCandidate } from '@/lib/store'
import type { Drive, Opening, ResumeProfile } from '@/lib/types'
import { cn, mapLimit } from '@/lib/utils'

interface ParsedResume {
  fileName: string
  profile?: { ok: true; data: ResumeProfile } | { ok: false; error: string }
}

type Assignment = 'opted' | 'every'

/**
 * Adds students to a drive from resume PDFs, with or without the placement cell's sheet.
 * With a sheet, resumes are matched to rows and the college's academics drive eligibility.
 * Without one, each resume becomes a student with self-declared academics.
 */
export function DriveImport({ drive, roles, onDone }: { drive: Drive; roles: Opening[]; onDone: () => void }) {
  const [sheetName, setSheetName] = useState('')
  const [sheetError, setSheetError] = useState('')
  const [rows, setRows] = useState<CollegeRow[]>([])
  const [roleMap, setRoleMap] = useState<Record<string, string>>({})
  const [resumes, setResumes] = useState<ParsedResume[]>([])
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [everyRoleIds, setEveryRoleIds] = useState<string[] | null>(null)
  const [includeUnlisted, setIncludeUnlisted] = useState(true)
  const [committing, setCommitting] = useState(false)

  const optedLabels = useMemo(() => [...new Set(rows.flatMap((r) => r.rolesOpted))], [rows])
  const canUseOpted = optedLabels.length > 0
  const mode: Assignment = assignment ?? (canUseOpted ? 'opted' : 'every')
  const selectedEvery = everyRoleIds ?? roles.map((r) => r.id)
  const roleTarget = (label: string) => roleMap[label] ?? guessOpening(label, roles) ?? ''

  const matching = useMemo(() => {
    const taken = new Set<number>()
    const byRow = new Map<number, { resume: ParsedResume; method: MatchMethod }>()
    const unlisted: ParsedResume[] = []
    for (const resume of resumes) {
      if (!resume.profile?.ok) continue
      const match = rows.length ? matchResumeToRow(resume.profile.data, resume.fileName, rows, taken) : null
      if (match) {
        taken.add(match.index)
        byRow.set(match.index, { resume, method: match.method })
      } else unlisted.push(resume)
    }
    return { byRow, unlisted }
  }, [resumes, rows])

  async function onSheet(file: File) {
    setSheetError('')
    try {
      const parsed = parseCollegeSheet(await readSheetFile(file)).rows
      if (!parsed.length) throw new Error('No student rows found. The sheet needs a header row with columns like USN, Name, Email and CGPA.')
      setSheetName(file.name)
      setRows(parsed)
      setRoleMap({})
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  async function onResumes(files: File[]) {
    const fresh = files.filter((f) => !resumes.some((r) => r.fileName === f.name))
    setResumes((prev) => [...prev, ...fresh.map((f) => ({ fileName: f.name }))])
    await mapLimit(fresh, 3, async (file) => {
      const form = new FormData()
      form.append('file', file)
      let profile: ParsedResume['profile']
      try {
        const res = await fetch('/api/parse-resume', { method: 'POST', body: form })
        const data = await res.json()
        profile = res.ok ? { ok: true, data } : { ok: false, error: data.error }
      } catch {
        profile = { ok: false, error: 'Upload failed' }
      }
      setResumes((prev) => prev.map((r) => (r.fileName === file.name ? { ...r, profile } : r)))
    })
  }

  const rolesFor = (row?: CollegeRow) =>
    mode === 'every' ? selectedEvery : (row?.rolesOpted ?? []).map(roleTarget).filter(Boolean)

  async function commit() {
    setCommitting(true)
    const created: string[] = []
    const add = (input: Parameters<typeof upsertCandidate>[0], roleIds: string[]) => {
      const candidate = upsertCandidate(input)
      for (const id of new Set(roleIds)) created.push(applyTo(candidate.id, id).id)
    }

    rows.forEach((row, index) => {
      const match = matching.byRow.get(index)
      const profile = match?.resume.profile?.ok ? match.resume.profile.data : undefined
      add(
        {
          name: row.name,
          email: row.email,
          altEmail: row.altEmail,
          phone: row.phone,
          usn: row.usn,
          college: drive.college,
          source: 'campus',
          inPool: false,
          driveId: drive.id,
          record: { ...row.record, batch: row.record.batch ?? drive.batch },
          profile,
          resumeFileName: match?.resume.fileName
        },
        rolesFor(row)
      )
    })

    // No sheet: every resume is a student. With a sheet: resumes not on it only if HR opts in.
    if (!rows.length || includeUnlisted) {
      for (const resume of matching.unlisted) {
        if (!resume.profile?.ok) continue
        const p = resume.profile.data
        add(
          { name: p.name, email: p.email, phone: p.phone, usn: p.usn, college: drive.college, source: 'campus', inPool: false, driveId: drive.id, profile: p, resumeFileName: resume.fileName },
          mode === 'every' ? selectedEvery : []
        )
      }
    }

    void evaluateApplications(created)
    setCommitting(false)
    onDone()
  }

  const parsing = resumes.some((r) => !r.profile)
  const readOk = resumes.filter((r) => r.profile?.ok).length
  const failed = resumes.filter((r) => r.profile && !r.profile.ok)
  const studentCount = rows.length + (!rows.length || includeUnlisted ? matching.unlisted.length : 0)
  const ready = studentCount > 0 && !parsing && roles.length > 0 && (mode === 'opted' || selectedEvery.length > 0)

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <h3 className="font-medium">Resume PDFs</h3>
        <p className="mt-1 mb-4 text-[13px] text-muted">The resumes the college shared. Each one is read and its original kept in storage.</p>
        <FileDrop accept=".pdf" multiple onFiles={onResumes} title="Drop the resume PDFs here" hint="Select the whole folder’s files at once" />
        {resumes.length > 0 && (
          <p className="mt-3 text-[13px] text-muted">
            {parsing && <Loader2 size={13} className="mr-1 inline animate-spin" />}
            {readOk}/{resumes.length} read
            {failed.length > 0 && <span className="text-bad"> · couldn’t read {failed.map((f) => f.fileName).join(', ')}</span>}
          </p>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-medium">Placement cell’s sheet</h3>
          <Badge>Optional</Badge>
        </div>
        <p className="mt-1 mb-4 text-[13px] text-muted">
          If the college sent an Excel or CSV of registrations, add it: eligibility then uses the college’s CGPA and backlogs, and
          resumes that disagree are flagged. Without it, academics are taken from each resume as self-declared.
        </p>
        {rows.length === 0 ? (
          <>
            <FileDrop accept=".xlsx,.csv" onFiles={([f]) => onSheet(f)} title="Upload the registrations sheet (Excel or CSV)" />
            {sheetError && <p className="mt-3 text-sm text-bad">{sheetError}</p>}
          </>
        ) : (
          <p className="text-sm text-muted">
            <FileText size={14} className="mr-1 inline" />
            {sheetName}: <strong className="text-fg">{rows.length} students</strong>
            <button className="ml-2 text-xs underline" onClick={() => setRows([])}>
              remove
            </button>
          </p>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="font-medium">Which roles is each student considered for?</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Choice
            active={mode === 'opted'}
            disabled={!canUseOpted}
            onClick={() => setAssignment('opted')}
            title="The roles they opted for"
            detail={canUseOpted ? 'From the sheet’s “roles opted” column.' : 'Needs a sheet with a “roles opted” column.'}
          />
          <Choice
            active={mode === 'every'}
            onClick={() => setAssignment('every')}
            title="Match every student to every role"
            detail="Each resume is scored against each role; the drive shows every student’s best fit."
          />
        </div>

        {mode === 'opted' && canUseOpted && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {optedLabels.map((label) => (
              <div key={label} className="flex items-center gap-3 rounded-xl bg-sunken px-3 py-2">
                <span className="w-32 shrink-0 truncate text-sm">{label}</span>
                <Select value={roleTarget(label)} onChange={(e) => setRoleMap({ ...roleMap, [label]: e.target.value })} className="h-8 text-[13px]">
                  <option value="">Ignore</option>
                  {roles.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        )}

        {mode === 'every' && (
          <div className="mt-4 flex flex-wrap gap-2">
            {roles.map((o) => {
              const on = selectedEvery.includes(o.id)
              return (
                <button
                  key={o.id}
                  onClick={() => setEveryRoleIds(on ? selectedEvery.filter((x) => x !== o.id) : [...selectedEvery, o.id])}
                  className={cn('rounded-full px-3 py-1.5 text-[13px] ring-1 transition-colors', on ? 'bg-fg text-white ring-fg' : 'bg-elev text-muted ring-line-strong')}
                >
                  {o.title}
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {(rows.length > 0 || matching.unlisted.length > 0) && (
        <Card className="p-6">
          <h3 className="mb-3 font-medium">Review</h3>
          <div className="mb-3 flex flex-wrap gap-2 text-[13px]">
            {rows.length > 0 && <Badge tone="good">{matching.byRow.size} resumes matched to the sheet</Badge>}
            {rows.length - matching.byRow.size > 0 && <Badge tone="warn">{rows.length - matching.byRow.size} on the sheet without a resume</Badge>}
            {matching.unlisted.length > 0 && (
              <Badge>
                {matching.unlisted.length} {rows.length ? 'resumes not on the sheet' : 'resumes (self-declared academics)'}
              </Badge>
            )}
          </div>
          {rows.length > 0 && matching.unlisted.length > 0 && (
            <label className="mb-3 flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={includeUnlisted} onChange={(e) => setIncludeUnlisted(e.target.checked)} />
              Also add the {matching.unlisted.length} resumes that aren’t on the sheet
            </label>
          )}
          <div className="max-h-96 overflow-auto rounded-xl ring-1 ring-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-sunken text-left text-[12px] text-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Roles</th>
                  <th className="px-4 py-2 font-medium">Resume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row, i) => {
                  const match = matching.byRow.get(i)
                  return (
                    <tr key={`row-${i}`}>
                      <td className="px-4 py-2">
                        <p className="font-medium">{row.name}</p>
                        <p className="font-mono text-[11.5px] text-faint">{row.usn}</p>
                      </td>
                      <td className="px-3 py-2 text-[13px] text-muted">{rolesFor(row).length} role(s)</td>
                      <td className="px-4 py-2 text-[13px]">
                        {match ? (
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-good" /> {match.resume.fileName} <span className="text-faint">by {match.method}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-warn">
                            <AlertTriangle size={13} /> No resume
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {(!rows.length || includeUnlisted) &&
                  matching.unlisted.map((r) => (
                    <tr key={r.fileName}>
                      <td className="px-4 py-2 font-medium">{r.profile?.ok ? r.profile.data.name : r.fileName}</td>
                      <td className="px-3 py-2 text-[13px] text-muted">{mode === 'every' ? `${selectedEvery.length} role(s)` : 'None (not on the sheet)'}</td>
                      <td className="px-4 py-2 text-[13px] text-faint">{r.fileName}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={commit} disabled={!ready || committing} size="lg">
          {committing && <Loader2 size={16} className="animate-spin" />}
          Add {studentCount} students and score them
        </Button>
      </div>
      {roles.length === 0 && <p className="text-right text-[13px] text-warn">Add at least one role to this drive first.</p>}
    </div>
  )
}

function Choice({ active, disabled, onClick, title, detail }: { active: boolean; disabled?: boolean; onClick: () => void; title: string; detail: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-xl p-4 text-left ring-1 transition-colors disabled:opacity-45',
        active ? 'bg-fg/[0.04] ring-2 ring-fg' : 'bg-elev ring-line-strong hover:bg-sunken/60'
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-[12.5px] text-muted">{detail}</p>
    </button>
  )
}
