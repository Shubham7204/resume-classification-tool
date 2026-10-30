'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { OpeningForm } from '@/components/opening-form'
import { useHydrated } from '@/lib/store'
import { PageLoading } from '@/components/ui'

export default function NewOpeningPage() {
  return (
    <Suspense>
      <NewOpening />
    </Suspense>
  )
}

function NewOpening() {
  const params = useSearchParams()
  if (!useHydrated()) return <PageLoading />
  return <OpeningForm driveId={params.get('driveId') ?? undefined} returnTo={params.get('returnTo')} />
}
