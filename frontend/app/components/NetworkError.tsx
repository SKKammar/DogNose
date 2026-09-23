'use client'

import { useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import type { ApiError } from '../../lib/api'

interface Props {
  error: ApiError
  onRetry: () => Promise<void> | void
}

export default function NetworkError({ error, onRetry }: Props) {
  const [busy, setBusy] = useState(false)

  const handleRetry = async () => {
    setBusy(true)
    try { await onRetry() } finally { setBusy(false) }
  }

  return (
    <div className="w-full max-w-md card p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-md bg-error/10 border border-error/30 flex items-center justify-center shrink-0">
          <WifiOff className="w-5 h-5 text-error" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-display font-bold text-text-primary mb-1">
            Couldn&apos;t reach the server
          </h3>
          <p className="text-sm text-text-secondary break-words">{error.message}</p>
        </div>
      </div>

      <ul className="text-xs text-text-muted space-y-1.5 mb-6 pl-4 list-disc">
        <li>Check your internet connection</li>
        <li>Make sure the backend server is running</li>
        <li>Try again in a moment — the server may be waking up</li>
      </ul>

      <button
        onClick={handleRetry}
        disabled={busy}
        className="btn-primary w-full"
      >
        <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
        {busy ? 'Retrying…' : 'Try again'}
      </button>
    </div>
  )
}
