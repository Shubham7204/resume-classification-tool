import Link from 'next/link'
import { cn } from '@/lib/utils'

export function Logo({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn('flex items-center gap-2 font-semibold tracking-[-0.02em]', className)}>
      <span aria-hidden className="grid size-6 place-items-center rounded-[7px] bg-fg text-[11px] font-bold text-white">
        R
      </span>
      RecruiterOS
    </Link>
  )
}
