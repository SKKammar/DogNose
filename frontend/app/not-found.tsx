import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">404 - Page Not Found</h2>
      <Link href="/" className="px-6 py-2 bg-surface border border-border rounded-xl hover:bg-background transition">Return Home</Link>
    </div>
  )
}
