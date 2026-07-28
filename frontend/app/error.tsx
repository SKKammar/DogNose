'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <p className="text-[var(--color-muted)] mb-8">{error.message}</p>
      <button onClick={() => reset()} className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-xl hover:opacity-90 transition">Try again</button>
    </div>
  )
}
