'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { OpeningForm } from '@/components/opening-form'
import { EmptyState, PageLoading } from '@/components/ui'
import { useDb, useHydrated } from '@/lib/store'

export default function EditOpeningPage() {
  return (
    <Suspense>
      <EditOpening />
    </Suspense>
  )
}

function EditOpening() {
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const { openings } = useDb()
  if (!useHydrated()) return <PageLoading />
  const opening = openings.find((o) => o.id === id)
  if (!opening) return <EmptyState title="Role not found">It may have been deleted.</EmptyState>
  return <OpeningForm initial={opening} returnTo={params.get('returnTo')} />
}
