import Link from 'next/link'
import { Logo } from '@/components/logo'
import { ButtonLink } from '@/components/ui'

const LINKS = [
  { href: '/#decide', label: 'How it works' },
  { href: '/#verification', label: 'Verification' },
  { href: '/#pool', label: 'Talent pool' },
  { href: '/careers', label: 'Careers demo' }
]

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex animate-rise justify-center px-4 pt-3" style={{ '--rise-y': '-40px' } as React.CSSProperties}>
      <nav className="flex w-full max-w-4xl items-center gap-6 rounded-full bg-elev/75 py-2 pr-2 pl-5 shadow-card ring-1 ring-line backdrop-blur-xl">
        <Logo />
        <div className="hidden flex-1 items-center justify-center gap-6 text-[13.5px] text-muted md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-fg">
              {l.label}
            </Link>
          ))}
        </div>
        <ButtonLink href="/hr" size="sm" className="ml-auto md:ml-0">
          Open HR workspace
        </ButtonLink>
      </nav>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/hr" className="hover:text-fg">HR workspace</Link>
          <Link href="/hr/campus" className="hover:text-fg">Campus drives</Link>
          <Link href="/hr/pool" className="hover:text-fg">Talent pool</Link>
          <Link href="/careers" className="hover:text-fg">Careers page</Link>
        </div>
        <p className="text-faint">Decision support for recruiters. People make the hiring calls.</p>
      </div>
    </footer>
  )
}
