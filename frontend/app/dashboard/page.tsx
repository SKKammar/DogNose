'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { listDogs, deleteDog, getScanLogs } from '../../lib/api'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PawPrint, Plus, Edit, Trash2, Loader2, ShieldCheck,
  Search, Clock, MapPin, ScanFace, BarChart2, ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'

interface Dog {
  id: string
  name: string
  breed?: string
  age?: number
  sex?: string
  profile_photo_url?: string
  created_at: string
  embedding_count?: number
}

interface ScanLog {
  id: string
  dog_name: string
  scanned_at: string
  match_confidence?: number
  location_lat?: number
  location_lon?: number
}

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

export default function DashboardPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [dogs, setDogs] = useState<Dog[]>([])
  const [logs, setLogs] = useState<ScanLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      setSession(session)
      try {
        const [dogsData, logsData] = await Promise.all([
          listDogs(session.access_token),
          getScanLogs(session.access_token, 20)
        ])
        setDogs(dogsData)
        setLogs(logsData)
      } catch (err) {
        toast.error('Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the registry? This cannot be undone.`)) return
    setIsDeleting(id)
    try {
      await deleteDog(id, session.access_token)
      setDogs(prev => prev.filter(d => d.id !== id))
      toast.success(`${name} removed from registry`)
    } catch {
      toast.error('Failed to remove dog')
    } finally {
      setIsDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center w-full">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 w-full">
        <div className="card p-10 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center mx-auto mb-5">
            <ShieldCheck className="w-7 h-7 text-[var(--color-accent)]" />
          </div>
          <h2 className="text-xl font-bold mb-2">Sign in required</h2>
          <p className="text-[var(--color-muted)] text-sm mb-6">Access your dogs and scan activity after signing in.</p>
          <Link href="/login" className="btn-primary w-full justify-center py-3 rounded-xl">Sign In</Link>
        </div>
      </div>
    )
  }

  const recentLogs = logs.slice(0, 5)

  return (
    <div className="min-h-screen w-full max-w-6xl mx-auto px-4 sm:px-6 py-10">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10"
      >
        <div>
          <h1 className="text-3xl md:text-4xl font-bold font-display tracking-tight">Dashboard</h1>
          <p className="text-[var(--color-muted)] mt-1 text-sm">Manage your dogs and monitor identity scans.</p>
        </div>
        <Link href="/enroll" className="btn-primary py-2.5 px-5 rounded-xl shrink-0">
          <Plus className="w-4 h-4" /> Register Dog
        </Link>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12"
      >
        {[
          { label: 'Registered Dogs', value: dogs.length, icon: PawPrint, color: 'accent' },
          { label: 'Total Scans', value: logs.length, icon: ScanFace, color: 'accent-2' },
          { label: 'Recent Activity', value: recentLogs.length > 0 ? formatDate(recentLogs[0].scanned_at) : '—', icon: BarChart2, color: 'success' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl bg-[var(--color-${color})]/10 border border-[var(--color-${color})]/20 flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 text-[var(--color-${color})]`} />
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted)] mb-0.5">{label}</p>
              <p className="text-lg font-bold font-display">{value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Dogs Section */}
      <section className="mb-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold font-display flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--color-accent)]" /> Your Dogs
          </h2>
          {dogs.length > 0 && (
            <Link href="/enroll" className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1">
              Add another <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {dogs.length === 0 ? (
          <div className="card border-dashed p-14 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] flex items-center justify-center mb-4">
              <PawPrint className="w-7 h-7 text-[var(--color-muted)] opacity-50" />
            </div>
            <h3 className="text-lg font-bold mb-2">No dogs registered yet</h3>
            <p className="text-[var(--color-muted)] text-sm mb-6 max-w-xs">Secure your dog&apos;s identity by enrolling their unique nose print into the registry.</p>
            <Link href="/enroll" className="btn-primary py-2.5 px-6 rounded-xl">Get Started</Link>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            <AnimatePresence>
              {dogs.map(dog => (
                <motion.div
                  key={dog.id}
                  variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="card card-lift group relative overflow-hidden"
                >
                  {/* Dog photo */}
                  <div className="w-full aspect-[4/3] bg-[var(--color-surface-2)] overflow-hidden">
                    {dog.profile_photo_url ? (
                      <img src={dog.profile_photo_url} alt={dog.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PawPrint className="w-10 h-10 text-[var(--color-muted)] opacity-30" />
                      </div>
                    )}
                  </div>

                  {/* Dog info */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="text-lg font-bold font-display truncate">{dog.name}</h3>
                      <span className="badge badge-success ml-2 shrink-0">Active</span>
                    </div>
                    <p className="text-[var(--color-muted)] text-sm mb-1">{dog.breed || 'Unknown breed'}</p>
                    {dog.age && <p className="text-[var(--color-muted)] text-xs">{dog.age} yrs · {dog.sex || 'Unknown sex'}</p>}
                    <p className="text-[var(--color-muted)] text-xs mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Enrolled {formatDate(dog.created_at)}
                    </p>
                  </div>

                  {/* Action overlay */}
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                    <Link
                      href={`/edit/${dog.id}`}
                      className="w-8 h-8 rounded-lg bg-[var(--color-surface)]/90 backdrop-blur-sm border border-[var(--color-border)] flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      onClick={() => handleDelete(dog.id, dog.name)}
                      disabled={isDeleting === dog.id}
                      className="w-8 h-8 rounded-lg bg-[var(--color-surface)]/90 backdrop-blur-sm border border-[var(--color-border)] flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-error)] hover:border-[var(--color-error)] transition-colors"
                    >
                      {isDeleting === dog.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* Scan Activity Section */}
      <section>
        <h2 className="text-xl font-bold font-display flex items-center gap-2 mb-6">
          <Search className="w-5 h-5 text-[var(--color-accent-2)]" /> Scan Activity
        </h2>

        {logs.length === 0 ? (
          <div className="card p-10 text-center">
            <Clock className="w-8 h-8 text-[var(--color-muted)] mx-auto mb-3 opacity-30" />
            <p className="text-[var(--color-muted)] text-sm">No scans logged yet. When someone scans a dog, it will appear here.</p>
          </div>
        ) : (
          <div className="card divide-y divide-[var(--color-border)]">
            <AnimatePresence>
              {logs.map((log, idx) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="flex items-start gap-4 p-5 hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-2)]/10 border border-[var(--color-accent-2)]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <ScanFace className="w-4 h-4 text-[var(--color-accent-2)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      <span className="text-[var(--color-accent)]">{log.dog_name}</span>{' '}
                      <span className="text-[var(--color-text-secondary)]">was scanned</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <span className="text-xs text-[var(--color-muted)] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDate(log.scanned_at)} at {formatTime(log.scanned_at)}
                      </span>
                      {log.match_confidence && (
                        <span className="badge badge-success">{(log.match_confidence * 100).toFixed(1)}% match</span>
                      )}
                      {log.location_lat && log.location_lon && (
                        <span className="text-xs text-[var(--color-muted)] flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {log.location_lat.toFixed(3)}, {log.location_lon.toFixed(3)}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  )
}
