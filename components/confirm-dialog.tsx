'use client'

// In-app replacement for window.confirm(): `await confirmAction({...})` resolves true or false.
// One <ConfirmDialogHost /> in the root layout renders whichever request is open. Built on <dialog>,
// so Esc cancels, focus is trapped while open, and screen readers announce it as a modal.

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui'

interface Request {
  title: string
  body?: string
  confirmLabel?: string
  destructive?: boolean
  resolve: (ok: boolean) => void
}

let current: Request | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function confirmAction(options: Omit<Request, 'resolve'>): Promise<boolean> {
  current?.resolve(false) // a new request replaces any open one
  return new Promise((resolve) => {
    current = { ...options, resolve }
    emit()
  })
}

function settle(ok: boolean) {
  current?.resolve(ok)
  current = null
  emit()
}

export function ConfirmDialogHost() {
  const request = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
    () => null
  )
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (request && !el.open) {
      el.showModal()
      cancel.current?.focus() // the safe choice gets focus
    } else if (!request && el.open) el.close()
  }, [request])

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault()
        settle(false)
      }}
      onClick={(e) => e.target === dialog.current && settle(false)} // click on the backdrop
      aria-labelledby="confirm-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-elev p-0 text-fg shadow-window ring-1 ring-line backdrop:bg-fg/30 backdrop:backdrop-blur-[2px] open:animate-rise"
      style={{ '--rise-y': '10px' } as React.CSSProperties}
    >
      {request && (
        <div className="p-6">
          <div className="flex items-start gap-3">
            {request.destructive && (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-bad-soft text-bad">
                <AlertTriangle size={17} />
              </span>
            )}
            <div className="min-w-0">
              <h2 id="confirm-title" className="text-lg font-semibold tracking-[-0.02em]">
                {request.title}
              </h2>
              {request.body && <p className="mt-1.5 text-sm leading-relaxed text-muted">{request.body}</p>}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button ref={cancel} variant="secondary" onClick={() => settle(false)}>
              Cancel
            </Button>
            <Button onClick={() => settle(true)} className={request.destructive ? 'bg-bad hover:bg-bad/90' : undefined}>
              {request.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  )
}
