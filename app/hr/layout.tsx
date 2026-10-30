import type { Metadata } from 'next'
import { HrNav } from '@/components/hr-nav'

export const metadata: Metadata = {
  title: 'HR workspace · RecruiterOS'
}

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:flex">
      <HrNav />
      <main className="relative min-w-0 flex-1 overflow-x-clip px-4 py-6 sm:px-8 md:py-10">
        {/* The homepage's warm glow, kept faint so data stays the focus. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 max-w-3xl rounded-full bg-brand/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
