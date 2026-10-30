import { Fragment } from 'react'
import { ArrowRight, ArrowUp, Check, FileSpreadsheet, FileText, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import { DecisionDemo } from '@/components/decision-demo'
import { JevDemo } from '@/components/jev-demo'
import { SiteFooter, SiteNav } from '@/components/site-nav'
import { ButtonLink, Serif } from '@/components/ui'

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <Stats />
        <Section
          id="decide"
          eyebrow="Decide"
          title={<>Approve, hold or reject <Serif>in one click.</Serif></>}
          body="Applicants arrive ranked, with the recommendation and anything that needs checking already on the row. Clear a drive’s queue in minutes, not days. Every decision is yours; nothing is rejected automatically."
        >
          <DecisionDemo />
        </Section>
        <Section
          id="rubric"
          eyebrow="Your criteria"
          title={<>Name the role, paste the JD. <Serif>The rubric writes itself.</Serif></>}
          body="An agent reads the job description and drafts 5–8 precise checks with weights and must-haves. You edit anything that doesn’t match how you’d screen. Then Jev asks exactly those questions of every resume, the same way, every time."
          flip
        >
          <RubricCard />
        </Section>
        <Section
          id="verification"
          eyebrow="Verify"
          title={<>Checked against the college’s numbers, <Serif>not the resume’s.</Serif></>}
          body="Campus eligibility runs on the record the placement cell sends. When a resume claims something different, it’s flagged for a human to confirm. A missing record means unverified, never rejected."
        >
          <VerificationCard />
        </Section>
        <Section
          id="pool"
          eyebrow="Talent pool"
          title={<>Ask your talent pool <Serif>like a colleague.</Serif></>}
          body="“I need someone with deep SQL who can join immediately.” The agent turns your question into checks, Jev runs them over every resume in the pool in parallel, and you get named people with the evidence behind each one."
          flip
        >
          <AgentCard />
        </Section>
        <Section
          eyebrow="Campus drives"
          title={<>The college’s sheet and the resumes, <Serif>paired for you.</Serif></>}
          body="Upload the placement cell’s Excel sheet and the folder of resume PDFs. Each resume is matched to its student by USN, email or phone, and every student is scored for each role they opted for."
        >
          <ImportSteps />
        </Section>
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  )
}

function rise(delay: number, y = 40) {
  return { animationDelay: `${delay}s`, '--rise-y': `${y}px` } as React.CSSProperties
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-36 pb-16 text-center sm:pt-44">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-24 mx-auto h-72 max-w-3xl rounded-full bg-brand/15 blur-3xl" />
      <p className="relative mb-6 inline-flex animate-rise items-center gap-2 rounded-full bg-elev px-3 py-1 text-[12.5px] text-muted ring-1 ring-line" style={rise(0, 20)}>
        <span className="size-1.5 rounded-full bg-brand" /> Powered by TypeSafe Jev
      </p>
      <h1 className="relative mx-auto max-w-5xl text-[clamp(2.6rem,7.5vw,6rem)] leading-[0.95] font-semibold tracking-[-0.045em] text-balance">
        {/* Real spaces between the animated words, so screen readers and copy-paste get a sentence. */}
        {['Screen', 'a', 'resume', 'in', 'under', 'a', 'second.'].map((w, i) => (
          <Fragment key={i}>
            <span className="inline-block animate-rise" style={rise(0.05 + i * 0.05)}>
              {w}
            </span>{' '}
          </Fragment>
        ))}
        <br />
        <span className="inline-block animate-rise text-brand" style={rise(0.45)}>
          <Serif>Show the working.</Serif>
        </span>
      </h1>
      <p className="relative mx-auto mt-7 max-w-2xl animate-rise text-lg text-balance text-muted" style={rise(0.55)}>
        RecruiterOS asks TypeSafe’s Jev model your screening questions about every resume and gets back probabilities, not prose.
        HR approves, holds or rejects with the evidence in front of them.
      </p>
      <div className="relative mt-9 flex animate-rise flex-wrap justify-center gap-3" style={rise(0.65)}>
        <ButtonLink href="/hr" size="lg">
          Open the HR workspace <ArrowRight size={16} />
        </ButtonLink>
        <ButtonLink href="/careers" size="lg" variant="secondary">
          See the careers page
        </ButtonLink>
      </div>
      <div className="relative mx-auto mt-16 max-w-5xl animate-rise" style={rise(0.8, 60)}>
        <JevDemo />
      </div>
    </section>
  )
}

function Stats() {
  // Measured on this app with the sample data in samples/.
  const items = [
    ['< 1s', 'per resume: one Jev call answers the whole rubric'],
    ['11s', 'to score a 40-student campus drive (63 applications)'],
    ['6s', 'to search a 50-person talent pool in plain English'],
    ['0', 'automatic rejections: a person makes every call']
  ]
  return (
    <section className="px-4 pb-8">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4">
        {items.map(([n, label]) => (
          <div key={label}>
            <p className="text-5xl font-semibold tracking-[-0.04em]">{n}</p>
            <p className="mt-2 text-sm text-muted">{label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Section({
  id,
  eyebrow,
  title,
  body,
  flip,
  children
}: {
  id?: string
  eyebrow: string
  title: React.ReactNode
  body: string
  flip?: boolean
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 px-4 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className={flip ? 'lg:order-2' : undefined}>
          <p className="font-mono text-[11px] tracking-wider text-brand-ink uppercase">{eyebrow}</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">{title}</h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">{body}</p>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  )
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-elev p-6 shadow-card ring-1 ring-line sm:p-8 ${className}`}>{children}</div>
}

function RubricCard() {
  const checks = [
    ['Distributed systems at scale', 'Depth 0–3', 5, true],
    ['3+ years backend', 'Yes / no', 4, true],
    ['Java / Go / Python', 'Yes / no', 3, false],
    ['Low-latency work', 'Yes / no', 3, false],
    ['Mentoring / design docs', 'Yes / no', 2, false]
  ] as const
  return (
    <Panel>
      <div className="mb-4 flex items-center gap-2 text-[12.5px] text-muted">
        <Sparkles size={14} className="text-brand" /> Drafted from the SDE-2 Backend JD in 5s · edit before publishing
      </div>
      <ul className="divide-y divide-line">
        {checks.map(([label, type, weight, must]) => (
          <li key={label} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="flex-1 font-medium">{label}</span>
            {must && <span className="rounded bg-bad-soft px-1.5 py-0.5 text-[11px] text-bad">Must-have</span>}
            <span className="w-20 text-[12px] text-muted">{type}</span>
            <span className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`h-3 w-1.5 rounded-sm ${n <= weight ? 'bg-fg' : 'bg-sunken'}`} />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function VerificationCard() {
  const rows = [
    { label: 'CGPA', college: '7.42', resume: '8.9', bad: true },
    { label: 'Class XII', college: '94.0%', resume: '94%' },
    { label: 'Active backlogs', college: '0', resume: 'n/a' },
    { label: 'Backlog history', college: '2', resume: 'n/a', bad: true }
  ]
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <p className="font-semibold">Arjun Reddy</p>
        <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[11.5px] font-medium text-warn">To verify</span>
      </div>
      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="text-left font-mono text-[10.5px] text-faint uppercase">
            <th className="pb-2 font-medium" />
            <th className="pb-2 font-medium">College record</th>
            <th className="pb-2 font-medium">Resume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-line">
              <td className="py-2.5 text-muted">{r.label}</td>
              <td className="py-2.5 font-mono">{r.college}</td>
              <td className={`py-2.5 font-mono ${r.bad ? 'font-semibold text-bad' : ''}`}>{r.resume}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-warn-soft px-4 py-3 text-[13px] text-[#7a5212]">
        <ShieldCheck size={15} className="mt-0.5 shrink-0" />
        The resume overstates CGPA by nearly 1.5 points. Flagged on every application; confirm with the college before deciding.
      </div>
    </Panel>
  )
}

function AgentCard() {
  return (
    <Panel>
      <div className="flex items-center gap-2 rounded-xl bg-bg py-1.5 pr-1.5 pl-4 text-sm ring-1 ring-line">
        <span className="flex-1 truncate">I need someone with deep SQL who can join immediately</span>
        <span className="grid size-8 place-items-center rounded-lg bg-fg text-white">
          <ArrowUp size={15} />
        </span>
      </div>
      <p className="mt-4 text-[14px] leading-relaxed">
        <strong>Harsh Vardhan</strong> is the top match: 3.0/3 on SQL depth (140 dbt models on Snowflake, window-function
        reconciliation) and an immediate-joiner notice period. <strong>Ayesha Siddiqui</strong> is close behind at 2.5/3 and can
        also start now.
      </p>
      <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-line text-[12.5px]">
        {[
          ['Harsh Vardhan', 99, '3.0/3', true],
          ['Ayesha Siddiqui', 91, '2.5/3', true],
          ['Divya Krishnan', 53, '3.0/3', false]
        ].map(([name, fit, sql, now]) => (
          <div key={name as string} className="flex items-center gap-3 border-b border-line px-4 py-2 last:border-0">
            <span className="flex-1 font-medium">{name}</span>
            <span className="w-8 font-mono">{fit}</span>
            <span className="w-12 font-mono text-muted">{sql}</span>
            {now ? <Check size={14} className="text-good" /> : <X size={14} className="text-bad" />}
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[11px] text-faint">50 resumes · 6.2s · checks: SQL depth (must), immediate start (must)</p>
    </Panel>
  )
}

function ImportSteps() {
  const steps = [
    { Icon: FileText, title: '3 roles, one non-tech', detail: 'Rubric and eligibility drafted from each JD' },
    { Icon: FileSpreadsheet, title: 'kings-2027-registrations.xlsx', detail: '41 students · CGPA, Class XII, backlogs, roles opted' },
    { Icon: Users, title: '40 resume PDFs', detail: 'All 40 matched by USN, email or phone · 1 student without a resume' }
  ]
  return (
    <Panel className="space-y-3">
      {steps.map(({ Icon, title, detail }, i) => (
        <div key={title} className="flex items-start gap-4 rounded-2xl bg-bg p-4 ring-1 ring-line">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-elev ring-1 ring-line">
            <Icon size={16} className="text-muted" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] text-faint">STEP {i + 1}</p>
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="text-[13px] text-muted">{detail}</p>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-2xl bg-fg px-5 py-4 text-sm text-white">
        <span>63 applications scored in 11s</span>
        <Check size={16} />
      </div>
    </Panel>
  )
}

const FAQS = [
  [
    'Does it reject candidates automatically?',
    'No. It recommends Interview, Screen or Hold with the evidence behind it and flags eligibility problems. A recruiter makes every decision with one click.'
  ],
  [
    'What exactly does Jev do?',
    'Jev is TypeSafe’s System One model. For each resume it answers the role’s rubric (0–3 depth scores and yes/no checks) as probabilities with a confidence value, in one request. It doesn’t write text and it doesn’t make the decision; our rules do, using weights you can see.'
  ],
  [
    'Where is an LLM used, then?',
    'In two agent steps: drafting the rubric from a job description (which HR edits), and turning a plain-English talent-pool question into checks and summarising the results. Scoring itself is Jev plus code.'
  ],
  [
    'How does it know a CGPA is real?',
    'It doesn’t guess. Campus eligibility uses the record the college sends. If the resume disagrees, it’s flagged for someone to confirm.'
  ]
]

function Faq() {
  return (
    <section className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
          Questions, <Serif>answered.</Serif>
        </h2>
        <div className="mt-12 divide-y divide-line border-y border-line">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {q}
                <span className="text-xl text-faint transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function ClosingCta() {
  return (
    <section className="px-4 py-24 text-center sm:py-32">
      <h2 className="mx-auto max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
        Every hiring decision, <Serif>with its reasons.</Serif>
      </h2>
      <div className="mt-9 flex justify-center">
        <ButtonLink href="/hr" size="lg">
          Open the HR workspace <ArrowRight size={16} />
        </ButtonLink>
      </div>
    </section>
  )
}
