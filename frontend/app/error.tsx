'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCcw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] px-4 w-full">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
        <div className="w-16 h-16 bg-[var(--color-bg)] rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-[var(--color-error)]" />
        </div>
        <h2 className="text-2xl font-display font-bold text-[var(--color-text)] mb-2">Something went wrong!</h2>
        <p className="text-[var(--color-muted)] mb-8">
          We encountered an unexpected error. Please try again.
        </p>
        <button
          onClick={() => reset()}
          className="flex items-center justify-center gap-2 w-full bg-[var(--color-accent)] text-white font-semibold py-3 px-4 rounded-xl hover:shadow-[0_0_20px_rgba(79,156,249,0.25)] transition-all"
        >
          <RefreshCcw className="w-5 h-5" />
          Try again
        </button>
      </div>
    </div>
  )
}
