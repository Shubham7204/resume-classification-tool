'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Badge, Input, Select, Textarea } from '@/components/ui'
import { DEPTH_LEVELS, POLICY, toKey } from '@/lib/jev'
import type { Criterion } from '@/lib/types'
import { cn } from '@/lib/utils'

const TYPE_LABEL = { score: 'Depth 0–3', noul: 'Yes / no' } as const

function share(c: Criterion, rubric: Criterion[]) {
  const total = rubric.reduce((s, x) => s + x.weight, 0) || 1
  return Math.round((c.weight / total) * 100)
}

/** Read-only view of what every resume is judged on, and how much each check counts. */
export function RubricView({ rubric }: { rubric: Criterion[] }) {
  return (
    <div>
      <ol className="divide-y divide-line">
        {rubric.map((c, i) => (
          <li key={c.key} className="flex gap-4 py-3">
            <span className="w-5 shrink-0 pt-0.5 font-mono text-[12px] text-faint">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.label}</span>
                <Badge tone={c.type === 'score' ? 'info' : 'brand'}>{TYPE_LABEL[c.type]}</Badge>
                {c.mustHave && <Badge tone="bad">Must-have</Badge>}
              </div>
              <p className="mt-0.5 text-[13px] text-muted">{c.question}</p>
              {c.type === 'score' && (
                <ol className="mt-1.5 grid gap-x-4 gap-y-0.5 text-[12px] text-faint sm:grid-cols-2">
                  {c.levels.map((l, n) => (
                    <li key={n}>
                      <span className="font-mono">{n}</span> {l}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <span className="shrink-0 text-right">
              <span className="block font-mono text-[13px] tabular-nums">{share(c, rubric)}%</span>
              <span className="text-[11px] text-faint">weight {c.weight}</span>
            </span>
          </li>
        ))}
      </ol>
      <PolicyNote />
    </div>
  )
}

export function PolicyNote() {
  return (
    <p className="mt-4 rounded-xl bg-sunken px-4 py-3 text-[12.5px] leading-relaxed text-muted">
      Jev answers each check independently from the resume. Fit score = Σ (answer × weight), out of 100. Interview at ≥{' '}
      {POLICY.interviewAt}, Screen at ≥ {POLICY.screenAt}, otherwise Hold. Failing a must-have caps the result at Screen,
      and any answer Jev is unsure about is flagged for a human.
    </p>
  )
}

/** Editable rubric: HR can reword, reweight, add or remove checks before the opening goes live. */
export function RubricEditor({ rubric, onChange }: { rubric: Criterion[]; onChange: (rubric: Criterion[]) => void }) {
  const set = (i: number, patch: Partial<Criterion>) =>
    onChange(rubric.map((c, n) => (n === i ? ({ ...c, ...patch } as Criterion) : c)))

  const changeType = (i: number, type: Criterion['type']) => {
    const c = rubric[i]
    const base = { key: c.key, label: c.label, weight: c.weight, mustHave: c.mustHave, question: c.question }
    set(
      i,
      type === 'score'
        ? { ...base, type, levels: DEPTH_LEVELS }
        : { ...base, type, yes: 'The resume shows clear evidence of this.', no: 'The resume shows no evidence of this.' }
    )
  }

  const add = () =>
    onChange([
      ...rubric,
      { key: `check_${rubric.length + 1}`, label: 'New check', weight: 3, type: 'noul', question: '', yes: 'The resume shows clear evidence of this.', no: 'The resume shows no evidence of this.' }
    ])

  return (
    <div className="space-y-3">
      {rubric.map((c, i) => (
        <div key={i} className="rounded-xl bg-bg p-4 ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={c.label}
              onChange={(e) => set(i, { label: e.target.value, key: toKey(e.target.value) })}
              className="h-8 max-w-56 flex-1 font-medium"
              aria-label="Check name"
            />
            <Select value={c.type} onChange={(e) => changeType(i, e.target.value as Criterion['type'])} className="h-8 w-32 text-[13px]">
              <option value="score">Depth 0–3</option>
              <option value="noul">Yes / no</option>
            </Select>
            <label className="flex items-center gap-1.5 text-[13px] text-muted">
              Weight
              <Select value={c.weight} onChange={(e) => set(i, { weight: Number(e.target.value) })} className="h-8 w-16 pr-2 pl-2.5 text-[13px]">
                {[1, 2, 3, 4, 5].map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-1.5 text-[13px] text-muted">
              <input type="checkbox" checked={!!c.mustHave} onChange={(e) => set(i, { mustHave: e.target.checked })} />
              Must-have
            </label>
            <span className="ml-auto font-mono text-[12px] text-faint">{share(c, rubric)}%</span>
            <button onClick={() => onChange(rubric.filter((_, n) => n !== i))} aria-label="Remove check" className="text-faint hover:text-bad">
              <Trash2 size={15} />
            </button>
          </div>
          <Textarea
            rows={2}
            value={c.question}
            placeholder="The question Jev answers about each resume, e.g. “Does the resume show hands-on Kafka use?”"
            onChange={(e) => set(i, { question: e.target.value })}
            className="mt-2 text-[13px]"
          />
          {c.type === 'score' && (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {c.levels.map((level, n) => (
                <label key={n} className="flex items-center gap-2 text-[12px] text-faint">
                  <span className="w-3 font-mono">{n}</span>
                  <Input
                    value={level}
                    onChange={(e) => set(i, { levels: c.levels.map((l, m) => (m === n ? e.target.value : l)) })}
                    className="h-8 text-[12.5px]"
                  />
                </label>
              ))}
            </div>
          )}
          {c.type === 'noul' && (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-[12px] text-good">
                Yes
                <Input value={c.yes} onChange={(e) => set(i, { yes: e.target.value })} className="h-8 text-[12.5px]" />
              </label>
              <label className="flex items-center gap-2 text-[12px] text-bad">
                No
                <Input value={c.no} onChange={(e) => set(i, { no: e.target.value })} className="h-8 text-[12.5px]" />
              </label>
            </div>
          )}
        </div>
      ))}
      <button
        onClick={add}
        className={cn('flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-3 text-[13px] text-muted hover:text-fg')}
      >
        <Plus size={14} /> Add a check
      </button>
    </div>
  )
}
