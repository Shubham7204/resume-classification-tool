'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Briefcase, ExternalLink, GraduationCap, LayoutGrid, Menu, Users, X } from 'lucide-react'
import { Logo } from '@/components/logo'
import { useDb } from '@/lib/store'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/hr', label: 'Overview', Icon: LayoutGrid, exact: true },
  { href: '/hr/campus', label: 'Campus drives', Icon: GraduationCap },
  { href: '/hr/openings', label: 'Openings', Icon: Briefcase },
  { href: '/hr/pool', label: 'Talent pool', Icon: Users }
]

export function HrNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const poolSize = useDb().candidates.filter((c) => c.inPool).length
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`))

  const links = (
    <nav className="flex flex-col gap-1">
      {LINKS.map(({ href, label, Icon, exact }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={cn(
            'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors',
            active(href, exact) ? 'bg-elev font-medium text-fg shadow-[0_1px_2px_#12131a14] ring-1 ring-line' : 'text-muted hover:bg-elev/60 hover:text-fg'
          )}
        >
          <Icon size={15} className={cn(active(href, exact) && 'text-brand-ink')} />
          {label}
          {href === '/hr/pool' && poolSize > 0 && <span className="ml-auto font-mono text-[11px] text-faint">{poolSize}</span>}
        </Link>
      ))}
      <div className="mt-6 border-t border-line pt-4">
        <p className="px-3 font-mono text-[10px] tracking-wider text-faint uppercase">Public</p>
        <Link href="/careers" className="mt-2 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted hover:text-fg">
          Careers page <ExternalLink size={12} />
        </Link>
        <Link href="/" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted hover:text-fg">
          Homepage
        </Link>
      </div>
    </nav>
  )

  return (
    <>
      {/* Phones: slim top bar with a menu sheet */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo href="/hr" />
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="grid size-9 place-items-center rounded-xl text-muted ring-1 ring-line hover:text-fg"
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
        {open && <div className="border-t border-line px-3 pt-3 pb-4">{links}</div>}
      </header>

      {/* Desktop: sidebar */}
      <aside className="hidden border-r border-line bg-sidebar md:sticky md:top-0 md:block md:h-screen md:w-60 md:shrink-0">
        <div className="px-5 py-5">
          <Logo href="/hr" />
        </div>
        <div className="px-3">{links}</div>
      </aside>
    </>
  )
}
