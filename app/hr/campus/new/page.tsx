'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Input, Label, PageHeader, PageLoading, Serif } from '@/components/ui'
import { createDrive, useHydrated } from '@/lib/store'

/** Step one of a campus drive: which college and batch. Roles and resumes are added on the drive's page. */
export default function NewDrivePage() {
  const router = useRouter()
  const [college, setCollege] = useState('')
  const [batch, setBatch] = useState(new Date().getFullYear() + 1)
  const hydrated = useHydrated()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!college.trim()) return
    router.push(`/hr/campus/${createDrive(college, batch).id}`)
  }

  if (!hydrated) return <PageLoading />

  return (
    <>
      <PageHeader eyebrow="Campus drives" title={<>New drive, <Serif>new college.</Serif></>} />
      <Card className="max-w-2xl p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div>
              <Label htmlFor="college">College</Label>
              <Input id="college" autoFocus value={college} onChange={(e) => setCollege(e.target.value)} placeholder="e.g. DJ Sanghvi College of Engineering" />
            </div>
            <div>
              <Label htmlFor="batch">Batch</Label>
              <Input id="batch" type="number" value={batch} onChange={(e) => setBatch(Number(e.target.value))} />
            </div>
          </div>
          <p className="text-[13px] text-muted">
            Next you’ll add the roles you’re offering at this college (each with its own JD, rubric and cutoffs), then the resumes.
          </p>
          <div className="flex justify-end">
            <Button type="submit" disabled={!college.trim()}>
              Create drive
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
