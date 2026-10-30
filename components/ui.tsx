'use client'

import Link from 'next/link'
import { useRef, useState, type ComponentProps, type DragEvent, type ReactNode } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------- Button ----------

const BUTTON_VARIANTS = {
  primary: 'bg-fg text-white hover:bg-fg/85',
  brand: 'bg-brand text-white hover:bg-brand-ink',
  secondary: 'bg-elev text-fg ring-1 ring-line-strong hover:bg-sunken',
  ghost: 'text-muted hover:bg-sunken hover:text-fg'
}
const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2'
}

interface ButtonStyle {
  variant?: keyof typeof BUTTON_VARIANTS
  size?: keyof typeof BUTTON_SIZES
}

function buttonClass({ variant = 'primary', size = 'md' }: ButtonStyle, className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap transition-[background-color,color,transform] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className
  )
}

export function Button({ variant, size, className, ...props }: ComponentProps<'button'> & ButtonStyle) {
  return <button className={buttonClass({ variant, size }, className)} {...props} />
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />
}

// ---------- Surfaces & text ----------

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-3xl bg-elev shadow-[0_1px_2px_#12131a0a] ring-1 ring-line', className)} {...props} />
}

/** Page title in the homepage's voice: mono eyebrow, tight semibold heading (pair it with <Serif>), rising in. */
export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex animate-rise flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-7" style={{ '--rise-y': '12px' } as React.CSSProperties}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 font-mono text-[11px] tracking-wider text-brand-ink uppercase">{eyebrow}</p>}
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.035em] text-balance sm:text-4xl">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** Placeholder shown while data loads from the database, instead of a blank page. */
export function PageLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="mb-3 h-3 w-28 rounded bg-sunken" />
      <div className="mb-8 h-9 w-72 max-w-full rounded-lg bg-sunken" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-3xl bg-sunken" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-3xl bg-sunken" />
        ))}
      </div>
    </div>
  )
}

export function Serif({ children }: { children: ReactNode }) {
  return <span className="font-serif font-normal tracking-normal italic">{children}</span>
}

const TONES = {
  neutral: 'bg-sunken text-muted',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info',
  brand: 'bg-brand-soft text-brand-ink'
}
export type Tone = keyof typeof TONES

export function Badge({ tone = 'neutral', className, ...props }: ComponentProps<'span'> & { tone?: Tone }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap', TONES[tone], className)}
      {...props}
    />
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
    </div>
  )
}

// ---------- Form controls ----------

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('mb-1.5 block text-[13px] font-medium text-muted', className)} {...props} />
}

const FIELD = 'w-full rounded-xl bg-elev px-3 text-sm ring-1 ring-line-strong outline-none placeholder:text-faint focus:ring-2 focus:ring-fg/70'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(FIELD, 'h-10', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(FIELD, 'py-2.5 leading-relaxed', className)} {...props} />
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(FIELD, 'h-10 pr-8', className)} {...props} />
}

export function FileDrop({
  accept,
  multiple,
  onFiles,
  title,
  hint
}: {
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  title: string
  hint?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const extensions = accept.split(',').map((a) => a.trim().toLowerCase())

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => extensions.some((ext) => f.name.toLowerCase().endsWith(ext)))
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    take(e.dataTransfer.files)
  }

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors',
        dragging ? 'border-brand bg-brand-soft' : 'border-line-strong bg-elev hover:bg-sunken/60'
      )}
    >
      <Upload size={18} className="text-muted" />
      <span className="text-sm font-medium">{title}</span>
      {hint && <span className="text-xs text-faint">{hint}</span>}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ''
        }}
      />
    </button>
  )
}
