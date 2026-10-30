'use client'

// Animated walkthrough of one evaluation: resume in → Jev answers every rubric check in
// parallel → our code weights the answers → decision. Cycles through three sample candidates.
// Numbers follow the real scoring rules in lib/jev.ts applied to the AI Engineer demo rubric.

import { useEffect, useState } from 'react'
import { Check, Minus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const CHECKS = [
  { label: 'Agent & LLM systems', type: 'score', weight: 5 },
  { label: 'Software engineering', type: 'score', weight: 4 },
  { label: 'Retrieval / RAG', type: 'noul', weight: 3 },
  { label: 'LLM evaluation', type: 'noul', weight: 3 },
  { label: 'Shipped project link', type: 'noul', weight: 3 },
  { label: 'Python', type: 'noul', weight: 2 }
] as const
const TOTAL_WEIGHT = CHECKS.reduce((s, c) => s + c.weight, 0)

const CANDIDATES = [
  {
    name: 'Ananya Iyer',
    meta: 'CSE · 2027 · KC22CS014',
    lines: ['LangGraph multi-agent support assistant, 41% tickets resolved', 'MCP server over ledger APIs', 'tiny-evals: LLM regression tests, 140★'],
    answers: [3.0, 2.6, 0.97, 0.95, 0.98, 0.99],
    ms: 790
  },
  {
    name: 'Mohammed Faizan',
    meta: 'ECE · 2027 · KC22EC022',
    lines: ['9 n8n automations for small businesses', 'ResumeBuddy: Next.js + OpenAI chat app', 'PDF chat with LangChain + FAISS'],
    answers: [1.8, 1.9, 0.9, 0.1, 0.95, 0.9],
    ms: 640
  },
  {
    name: 'Rohan Das',
    meta: 'CSE · 2027 · KC22CS063',
    lines: ['Student result website (PHP, MySQL)', 'Tkinter calculator', '“Seeking a challenging position…”'],
    answers: [0.1, 0.6, 0.02, 0.01, 0.05, 0.4],
    ms: 610
  }
]

const value = (type: string, a: number) => (type === 'score' ? a / 3 : a)

function decision(score: number) {
  if (score >= 70) return { label: 'Interview', tone: 'bg-good text-white' }
  if (score >= 45) return { label: 'Screen', tone: 'bg-warn text-white' }
  return { label: 'Hold', tone: 'bg-fg/80 text-white' }
}

// Phases: 0 resume shown · 1 checks answered · 2 points weighted · 3 decision
const PHASE_MS = [900, 1300, 1300, 2600]

export function JevDemo() {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState(0)
  const [score, setScore] = useState(0)

  const c = CANDIDATES[index]
  const contributions = CHECKS.map((ch, i) => (value(ch.type, c.answers[i]) * ch.weight * 100) / TOTAL_WEIGHT)
  const fit = Math.round(contributions.reduce((a, b) => a + b, 0))

  useEffect(() => {
    const t = setTimeout(() => {
      if (phase < 3) setPhase(phase + 1)
      else {
        setPhase(0)
        setScore(0)
        setIndex((index + 1) % CANDIDATES.length)
      }
    }, PHASE_MS[phase])
    return () => clearTimeout(t)
  }, [phase, index])

  // Count the fit score up while points are being weighted.
  useEffect(() => {
    if (phase < 2) return
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900)
      setScore(Math.round(fit * (1 - Math.pow(1 - p, 3))))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase, fit])

  const d = decision(fit)

  return (
    <div className="overflow-hidden rounded-3xl bg-elev text-left shadow-window ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3 text-[12px] text-faint">
        <span className="font-mono">AI Engineer, Agentic Systems</span>
        <span className="ml-auto flex items-center gap-1.5">
          {CANDIDATES.map((_, i) => (
            <span key={i} className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-5 bg-fg' : 'w-1.5 bg-line-strong')} />
          ))}
        </span>
      </div>

      <div className="grid gap-px bg-line md:grid-cols-[1fr_1.25fr_1fr]">
        {/* 1. Resume */}
        <Column step="1" title="Resume in">
          <div key={c.name} className="animate-rise" style={{ '--rise-y': '10px' } as React.CSSProperties}>
            <p className="font-semibold">{c.name}</p>
            <p className="font-mono text-[11px] text-faint">{c.meta}</p>
            <ul className="mt-3 space-y-1.5 text-[12.5px] text-muted">
              {c.lines.map((l) => (
                <li key={l} className="rounded-lg bg-bg px-2.5 py-1.5 ring-1 ring-line">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </Column>

        {/* 2. Jev */}
        <Column step="2" title="Jev answers every check, in parallel" aside={phase >= 1 ? `${(c.ms / 1000).toFixed(2)}s` : undefined}>
          <ul className="space-y-1.5">
            {CHECKS.map((ch, i) => {
              const a = c.answers[i]
              const shown = phase >= 1
              return (
                <li key={ch.label} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] ring-1 ring-line">
                  <span className="truncate">{ch.label}</span>
                  <span
                    className={cn('shrink-0 font-mono text-[11.5px] transition-all duration-300', shown ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0')}
                    style={{ transitionDelay: shown ? `${i * 60}ms` : '0ms' }}
                  >
                    {ch.type === 'score' ? <span>{a.toFixed(1)} / 3</span> : <YesNo p={a} />}
                  </span>
                </li>
              )
            })}
          </ul>
        </Column>

        {/* 3. Rules */}
        <Column step="3" title="Rules in code decide">
          <ul className="space-y-1.5">
            {CHECKS.map((ch, i) => (
              <li key={ch.label} className="flex items-center gap-2 text-[11px] text-faint">
                <span className="w-3 font-mono">{ch.weight}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                  <span
                    className="block h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
                    style={{ width: phase >= 2 ? `${(contributions[i] / ((ch.weight * 100) / TOTAL_WEIGHT)) * 100}%` : '0%', transitionDelay: `${i * 50}ms` }}
                  />
                </span>
                <span className="w-7 text-right font-mono">{phase >= 2 ? contributions[i].toFixed(0) : ''}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
            <div>
              <p className="text-[11px] text-faint">Fit score</p>
              <p className="text-4xl font-semibold tracking-[-0.04em] tabular-nums">{phase >= 2 ? score : '–'}</p>
            </div>
            <span
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-300',
                d.tone,
                phase >= 3 ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
              )}
            >
              {d.label}
            </span>
          </div>
        </Column>
      </div>
    </div>
  )
}

function Column({ step, title, aside, children }: { step: string; title: string; aside?: string; children: React.ReactNode }) {
  return (
    <div className="bg-elev p-5">
      <div className="mb-3 flex items-center gap-2 text-[11.5px] text-faint">
        <span className="grid size-5 place-items-center rounded-full bg-sunken font-mono text-[10.5px] text-muted">{step}</span>
        <span className="font-medium text-muted">{title}</span>
        {aside && <span className="ml-auto font-mono text-good">{aside}</span>}
      </div>
      {children}
    </div>
  )
}

function YesNo({ p }: { p: number }) {
  if (p >= 0.7)
    return (
      <span className="inline-flex items-center gap-1 text-good">
        <Check size={12} /> {Math.round(p * 100)}%
      </span>
    )
  if (p <= 0.3)
    return (
      <span className="inline-flex items-center gap-1 text-bad">
        <X size={12} /> {Math.round(p * 100)}%
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-warn">
      <Minus size={12} /> {Math.round(p * 100)}%
    </span>
  )
}
