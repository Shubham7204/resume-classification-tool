'use client'

// A self-playing applicant list: HR clears a ranked queue with one-click decisions.

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Pause, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Decision = 'shortlisted' | 'on_hold' | 'rejected' | null

const ROWS: Array<{ name: string; score: number; rec: string; recTone: string; flag?: string; decide: Exclude<Decision, null> }> = [
  { name: 'Ananya Iyer', score: 98, rec: 'Interview', recTone: 'bg-good-soft text-good', decide: 'shortlisted' },
  { name: 'Diya Menon', score: 95, rec: 'Interview', recTone: 'bg-good-soft text-good', decide: 'shortlisted' },
  { name: 'Mohammed Faizan', score: 62, rec: 'Screen', recTone: 'bg-warn-soft text-warn', decide: 'shortlisted' },
  { name: 'Devika Nair', score: 55, rec: 'Screen', recTone: 'bg-warn-soft text-warn', flag: 'CGPA 9.1 on resume, 7.9 on record', decide: 'on_hold' },
  { name: 'Rajat Verma', score: 12, rec: 'Hold', recTone: 'bg-sunken text-muted', decide: 'rejected' }
]

const BUTTONS = [
  { d: 'shortlisted', label: 'Shortlist', Icon: Check, on: 'bg-good text-white' },
  { d: 'on_hold', label: 'Hold', Icon: Pause, on: 'bg-warn text-white' },
  { d: 'rejected', label: 'Reject', Icon: X, on: 'bg-bad text-white' }
] as const

export function DecisionDemo() {
  const [step, setStep] = useState(0) // how many rows decided

  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s > ROWS.length ? 0 : s + 1)), step === 0 ? 1200 : step > ROWS.length - 1 ? 2400 : 700)
    return () => clearTimeout(t)
  }, [step])

  return (
    <div className="overflow-hidden rounded-3xl bg-elev shadow-card ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line px-5 py-3 text-[12px] text-faint">
        <span className="font-mono">AI Engineer · ranked by fit</span>
        <span>
          {Math.min(step, ROWS.length)}/{ROWS.length} decided
        </span>
      </div>
      <ul className="divide-y divide-line">
        {ROWS.map((r, i) => {
          const decided: Decision = i < step ? r.decide : null
          return (
            <li key={r.name} className={cn('flex flex-wrap items-center gap-3 px-5 py-3 transition-colors', i === step && 'bg-brand-soft/40')}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.name}</p>
                {r.flag && (
                  <p className="flex items-center gap-1 text-[11.5px] text-warn">
                    <AlertTriangle size={11} /> {r.flag}
                  </p>
                )}
              </div>
              <span className="w-8 text-right font-mono text-[13px] tabular-nums">{r.score}</span>
              <span className={cn('w-20 rounded-md px-1.5 py-0.5 text-center text-[11.5px] font-medium', r.recTone)}>{r.rec}</span>
              <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-line-strong">
                {BUTTONS.map(({ d, label, Icon, on }) => (
                  <span
                    key={d}
                    className={cn(
                      'flex h-7 items-center gap-1 px-2 text-[11.5px] transition-colors duration-200 not-first:border-l not-first:border-line-strong',
                      decided === d ? on : 'bg-elev text-muted'
                    )}
                  >
                    <Icon size={12} />
                    <span className="hidden sm:inline">{label}</span>
                  </span>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
