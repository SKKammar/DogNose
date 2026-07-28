import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">404 - Page Not Found</h2>
      <Link href="/" className="px-6 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg)] transition">Return Home</Link>
    </div>
  )
}
