'use client'

import { Fragment, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowUp, Check, Loader2, Minus, Sparkles, X } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import type { SearchMatch, TalentSearchResult } from '@/lib/server/talent-search'
import type { Candidate } from '@/lib/types'
import { cn } from '@/lib/utils'

const EXAMPLES = [
  'Someone strong in SQL who can join immediately',
  'Backend engineer with Kafka and 3+ years',
  'Built AI agents that real users use',
  'Data analyst with dashboarding and stakeholder experience'
]

type Turn = { question: string } & ({ status: 'thinking' } | { status: 'done'; result: TalentSearchResult } | { status: 'error'; error: string })

/** Plain-English search over the pool: an LLM plans the checks, Jev runs them on every resume. */
export function TalentAgent({ pool }: { pool: Candidate[] }) {
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const searchable = pool.filter((c) => c.profile)
  const busy = turns.some((t) => t.status === 'thinking')

  async function ask(q: string) {
    if (!q.trim() || busy) return
    setQuestion('')
    setTurns((t) => [{ question: q, status: 'thinking' }, ...t])
    let next: Turn
    try {
      const res = await fetch('/api/talent-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          candidates: searchable.map((c) => ({ id: c.id, name: c.name, text: c.profile!.text }))
        })
      })
      const data = await res.json()
      next = res.ok ? { question: q, status: 'done', result: data } : { question: q, status: 'error', error: data.error }
    } catch {
      next = { question: q, status: 'error', error: 'Network error' }
    }
    setTurns((t) => t.map((turn, i) => (i === 0 ? next : turn)))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void ask(question)
  }

  return (
    <Card className="mb-8 overflow-hidden">
      <form onSubmit={submit} className="border-b border-line p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-brand" />
          <h2 className="font-medium">Ask the talent pool</h2>
          <span className="text-[12px] text-faint">· searches {searchable.length} resumes with TypeSafe Jev</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-bg py-1.5 pr-1.5 pl-4 ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-fg/70">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Who do you need? e.g. someone strong in SQL who can join immediately"
            className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
            aria-label="Ask the talent pool"
          />
          <button
            type="submit"
            disabled={!question.trim() || busy || !searchable.length}
            aria-label="Ask"
            className="grid size-9 place-items-center rounded-lg bg-fg text-white transition-opacity disabled:opacity-30"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
          </button>
        </div>
        {turns.length === 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => ask(e)}
                disabled={!searchable.length}
                className="rounded-full bg-sunken px-3 py-1 text-[12.5px] text-muted hover:text-fg disabled:opacity-50"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </form>

      {turns.map((turn, i) => (
        <div key={turns.length - i} className="border-b border-line p-5 last:border-0">
          <p className="mb-3 text-sm font-medium">“{turn.question}”</p>
          {turn.status === 'thinking' && <Thinking count={searchable.length} />}
          {turn.status === 'error' && <p className="text-sm text-bad">{turn.error}</p>}
          {turn.status === 'done' && <Answer result={turn.result} />}
        </div>
      ))}
    </Card>
  )
}

function Thinking({ count }: { count: number }) {
  return (
    <ol className="space-y-1.5 text-[13px] text-muted">
      <li className="flex items-center gap-2">
        <Loader2 size={13} className="animate-spin" /> Turning your question into checks, then asking Jev about {count} resumes in parallel…
      </li>
    </ol>
  )
}

const missedMustHaves = (m: SearchMatch) => m.evaluation.results.filter((r) => r.mustHave && r.value < 0.5).map((r) => r.label)

function Answer({ result }: { result: TalentSearchResult }) {
  const full = result.matches.filter((m) => missedMustHaves(m).length === 0)
  const partial = result.matches.filter((m) => missedMustHaves(m).length > 0).slice(0, 4)
  return (
    <div>
      <p className="text-[15px] leading-relaxed">{result.answer}</p>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
        <span className="text-faint">Checked:</span>
        {result.criteria.map((c) => (
          <Badge key={c.key} tone={c.mustHave ? 'bad' : 'neutral'} title={c.question}>
            {c.label}
            {c.mustHave && ' · must'}
          </Badge>
        ))}
        <span className="ml-auto font-mono text-[11px] text-faint">
          {result.searched} resumes · {(result.ms / 1000).toFixed(1)}s · planned by {result.plannedBy}
        </span>
      </div>

      {result.matches.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-line">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-line bg-sunken/60 text-left text-[11.5px] text-faint">
                <th className="px-4 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Match</th>
                {result.criteria.map((c) => (
                  <th key={c.key} className="px-3 py-2 font-medium" title={c.question}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {full.length === 0 && (
                <tr>
                  <td colSpan={2 + result.criteria.length} className="px-4 py-2.5 text-muted">
                    Nobody meets every must-have.
                  </td>
                </tr>
              )}
              {[...full, ...partial].map((m, i) => (
                <Fragment key={m.candidateId}>
                {i === full.length && partial.length > 0 && (
                  <tr className="bg-sunken/60">
                    <td colSpan={2 + result.criteria.length} className="px-4 py-1.5 text-[11.5px] font-medium text-faint">
                      Close, but missing a must-have
                    </td>
                  </tr>
                )}
                <tr className={cn(i >= full.length && 'text-muted')}>
                  <td className="px-4 py-2.5">
                    <Link href={`/hr/candidates/${m.candidateId}`} className="font-medium hover:underline">
                      {m.name}
                    </Link>
                    {i >= full.length && <p className="text-[11.5px] text-bad">Missing: {missedMustHaves(m).join(', ')}</p>}
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">{m.evaluation.fitScore}</td>
                  {m.evaluation.results.map((r) => (
                    <td key={r.key} className="px-3 py-2.5" title={r.levelText}>
                      {r.type === 'score' ? (
                        <span className="font-mono">{r.level?.toFixed(1)}/3</span>
                      ) : (
                        <Verdict value={r.value} />
                      )}
                    </td>
                  ))}
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Verdict({ value }: { value: number }) {
  const [Icon, tone] = value >= 0.7 ? [Check, 'text-good'] : value <= 0.3 ? [X, 'text-bad'] : [Minus, 'text-warn']
  return (
    <span className={cn('inline-flex items-center gap-1', tone)}>
      <Icon size={13} />
      <span className="font-mono text-[11.5px]">{Math.round(value * 100)}%</span>
    </span>
  )
}
