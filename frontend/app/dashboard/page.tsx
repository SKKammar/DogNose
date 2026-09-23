'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PawPrint, Clock, Search, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { listDogs, getScanLogs, deleteDog } from '../../lib/api'
import EmptyState from '../components/EmptyState'

interface Dog {
  id: string
  name: string
  breed: string | null
  profile_photo_url: string | null
}

interface ScanLog {
  id: string
  dog_name: string
  scanned_at: string
  match_confidence: number | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dogs, setDogs] = useState<Dog[]>([])
  const [logs, setLogs] = useState<ScanLog[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      try {
        const [d, l] = await Promise.all([
          listDogs(session.access_token),
          getScanLogs(session.access_token, 20),
        ])
        setDogs(Array.isArray(d) ? d : [])
        setLogs(Array.isArray(l) ? l : [])
      } catch {
        toast.error("Couldn't load your dashboard")
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    setDeleting(id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await deleteDog(id, session.access_token)
      setDogs((d) => d.filter((x) => x.id !== id))
      toast.success(`${name} was deleted`)
    } catch {
      toast.error("Couldn't delete")
    } finally {
      setDeleting(null)
    }
  }

  const fmt = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-12">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary">Your dogs</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage profiles and see who&apos;s been scanned.
          </p>
        </div>
        <Link href="/enroll" className="btn-primary btn-sm shrink-0">
          <Plus className="w-3.5 h-3.5" />
          Register dog
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        {/* Dogs */}
        <div className="lg:col-span-2">
          <div className="section-heading">
            <h2>Registered</h2>
            <span className="meta">{dogs.length} {dogs.length === 1 ? 'dog' : 'dogs'}</span>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="skeleton h-40" />
              <div className="skeleton h-40" />
            </div>
          ) : dogs.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={PawPrint}
                title="No dogs yet"
                description="Add your first dog so they can be found if they ever get lost."
                action={{ label: 'Register a dog', href: '/enroll' }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {dogs.map((d) => (
                <div 
                  key={d.id} 
                  className="group flex flex-col sm:flex-row sm:items-center gap-4 p-3 pr-4 rounded-md border border-border bg-surface hover:bg-surface-raised hover:border-border-strong transition-all duration-200 cursor-default"
                >
                  {/* Precision Frame Avatar */}
                  <div className="relative w-16 h-16 shrink-0 bg-background border border-border rounded-sm overflow-hidden flex items-center justify-center">
                    <div className="absolute -top-px -left-px w-1.5 h-1.5 border-t border-l border-text-muted z-10" />
                    <div className="absolute -bottom-px -right-px w-1.5 h-1.5 border-b border-r border-text-muted z-10" />
                    {d.profile_photo_url ? (
                      <img src={d.profile_photo_url} alt={d.name} className="w-full h-full object-cover grayscale-[15%] group-hover:grayscale-0 transition-all duration-300" />
                    ) : (
                      <PawPrint className="w-5 h-5 text-text-muted" />
                    )}
                  </div>

                  {/* Structured Data Columns */}
                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 gap-4 items-center">
                    <div className="col-span-2 sm:col-span-1 min-w-0">
                      <h3 className="font-display font-bold text-text-primary text-base truncate tracking-tight">{d.name}</h3>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mt-0.5 truncate">
                        {d.breed || 'UNSPECIFIED'}
                      </p>
                    </div>
                    
                    <div className="hidden sm:block min-w-0">
                      <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-muted mb-0.5">Registry ID</p>
                      <p className="text-xs font-mono text-text-secondary truncate">
                        {d.id.split('-')[0]} 
                      </p>
                    </div>

                    {/* Hover Actions */}
                    <div className="flex items-center gap-2 justify-end opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Link href={`/edit/${d.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                        Manage
                      </Link>
                      <button onClick={() => onDelete(d.id, d.name)} className="btn-icon text-text-muted hover:text-error hover:bg-error/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity */}
        <div>
          <div className="section-heading">
            <h2>Recent scans</h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-14" />
              <div className="skeleton h-14" />
              <div className="skeleton h-14" />
            </div>
          ) : logs.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Clock}
                title="No scans yet"
                description="When someone finds one of your dogs and scans their nose, it'll show up here."
              />
            </div>
          ) : (
            <div className="card divide-y divide-border">
              {logs.map((l) => (
                <div key={l.id} className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md border border-border bg-background flex items-center justify-center shrink-0">
                    <Search className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary">
                      <span className="font-medium">{l.dog_name}</span> was scanned
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-muted font-mono mt-1">
                      <span>{fmt(l.scanned_at)}</span>
                      {l.match_confidence != null && (
                        <>
                          <span>·</span>
                          <span className="text-success">
                            {Math.round(l.match_confidence * 100)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
