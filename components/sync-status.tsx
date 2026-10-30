'use client'

import { AlertTriangle } from 'lucide-react'
import { useSyncStatus } from '@/lib/store'

/** Shown when the database can't be reached or a change didn't save. */
export function SyncStatus() {
  const status = useSyncStatus()
  if (status.state !== 'error') return null
  return (
    <div role="alert" className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-start gap-2 rounded-xl bg-bad px-4 py-3 text-sm text-white shadow-card">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      {status.message}
    </div>
  )
}
