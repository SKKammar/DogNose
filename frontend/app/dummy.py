import os

app_dir = r'z:\Santu\IntelliJ\DoGNose\frontend\app'

error_code = '''\'use client\'
import { useEffect } from \'react\'

export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className=\"flex flex-col items-center justify-center min-h-[60vh] p-4 text-center\">
      <h2 className=\"text-2xl font-bold mb-4\">Something went wrong!</h2>
      <p className=\"text-[var(--color-muted)] mb-8\">{error.message}</p>
      <button onClick={() => reset()} className=\"px-6 py-2 bg-[var(--color-accent)] text-white rounded-xl hover:opacity-90 transition\">Try again</button>
    </div>
  )
}'''

not_found_code = '''import Link from \'next/link\'

export default function NotFound() {
  return (
    <div className=\"flex flex-col items-center justify-center min-h-[60vh] p-4 text-center\">
      <h2 className=\"text-2xl font-bold mb-4\">404 - Page Not Found</h2>
      <Link href=\"/\" className=\"px-6 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg)] transition\">Return Home</Link>
    </div>
  )
}'''

loading_code = '''import { Loader2 } from \'lucide-react\'

export default function Loading() {
  return (
    <div className=\"flex items-center justify-center min-h-[60vh]\">
      <Loader2 className=\"w-8 h-8 animate-spin text-[var(--color-accent)]\" />
    </div>
  )
}'''

with open(os.path.join(app_dir, 'error.tsx'), 'w', encoding='utf-8') as f:
    f.write(error_code)
    
with open(os.path.join(app_dir, 'not-found.tsx'), 'w', encoding='utf-8') as f:
    f.write(not_found_code)
    
with open(os.path.join(app_dir, 'loading.tsx'), 'w', encoding='utf-8') as f:
    f.write(loading_code)
