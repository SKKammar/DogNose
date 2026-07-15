'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { listDogs, getScanLogs, deleteDog } from '../../lib/api'
import { Loader2, Trash2, ShieldCheck, PawPrint, Clock, MapPin, Search } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import AppHeader from '../components/AppHeader'

interface Dog {
  id: string
  name: string
  breed: string | null
  nose_print_count: number
  profile_photo_url: string | null
  created_at: string
}

interface ScanLog {
  id: string
  dog_name: string
  scanned_at: string
  location_lat: number | null
  location_lon: number | null
  match_confidence: number | null
}

export default function DashboardPage() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dogs, setDogs] = useState<Dog[]>([])
  const [logs, setLogs] = useState<ScanLog[]>([])
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchDashboardData(session.access_token)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchDashboardData(session.access_token)
      } else {
        setDogs([])
        setLogs([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchDashboardData = async (token: string) => {
    try {
      const [dogsData, logsData] = await Promise.all([
        listDogs(token),
        getScanLogs(token, 20)
      ])
      setDogs(dogsData)
      setLogs(logsData)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone and will remove all associated biometric data.`)) return
    
    setIsDeleting(id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      
      await deleteDog(id, session.access_token)
      setDogs(dogs.filter(d => d.id !== id))
      toast.success(`${name} has been deleted`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete dog')
    } finally {
      setIsDeleting(null)
    }
  }

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr)
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center w-full bg-[var(--color-bg)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center w-full z-10 relative bg-[var(--color-bg)]">
        <div className="flex flex-col items-center justify-center py-20 w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] p-8 rounded-3xl text-center shadow-2xl">
          <ShieldCheck className="text-[var(--color-accent)] w-12 h-12 mb-4" />
          <h2 className="text-2xl font-bold font-display text-[var(--color-text)] mb-3">Dashboard Access</h2>
          <p className="text-[var(--color-muted)] mb-8 text-sm">Sign in to manage your dogs and view scan activity logs.</p>
          <Link href="/login" className="w-full py-4 bg-[var(--color-text)] text-[var(--color-bg)] rounded-xl font-bold hover:bg-white transition">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <AppHeader />
      <div className="min-h-screen p-4 pt-24 max-w-5xl mx-auto w-full relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold font-display text-[var(--color-text)] tracking-tight">Dashboard</h1>
            <p className="text-[var(--color-muted)] mt-1">Manage your dogs and monitor identity scans.</p>
          </div>
          <Link href="/enroll" className="inline-flex items-center justify-center bg-[var(--color-accent)] hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl shadow-[0_0_15px_rgba(79,156,249,0.2)] hover:shadow-[0_0_25px_rgba(79,156,249,0.4)] transition-all gap-2">
            <PawPrint className="w-4 h-4" />
            Register Dog
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content: Dogs List */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold text-[var(--color-text)] flex items-center gap-2 border-b border-[var(--color-border)] pb-2">
              <ShieldCheck className="w-5 h-5 text-[var(--color-accent)]" /> Your Registered Dogs
            </h2>
            
            {dogs.length === 0 ? (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] border-dashed rounded-3xl p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-[var(--color-bg)] rounded-full flex items-center justify-center mb-4">
                  <PawPrint className="w-8 h-8 text-[var(--color-muted)] opacity-50" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">No dogs registered yet</h3>
                <p className="text-[var(--color-muted)] text-sm mb-6 max-w-sm">Secure your dog's identity by enrolling their unique nose print into the Canid registry.</p>
                <Link href="/enroll" className="text-[var(--color-accent)] hover:text-white font-medium transition-colors">
                  Get started →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence>
                  {dogs.map(dog => (
                    <motion.div 
                      key={dog.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 hover:border-[var(--color-accent)] transition-colors group relative overflow-hidden"
                    >
                      <div className="flex gap-4">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--color-bg)] shrink-0 border border-[var(--color-border)] flex items-center justify-center">
                          {dog.profile_photo_url ? (
                            <img src={dog.profile_photo_url} alt={dog.name} className="w-full h-full object-cover" />
                          ) : (
                            <PawPrint className="w-6 h-6 text-[var(--color-muted)]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold font-display text-[var(--color-text)] truncate pr-8">{dog.name}</h3>
                          <p className="text-[var(--color-muted)] text-sm truncate">{dog.breed || 'Unknown breed'}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20 uppercase">
                              Active
                            </span>
                            <span className="text-xs text-[var(--color-muted)]">
                              Enrolled {formatDate(dog.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleDelete(dog.id, dog.name)}
                        disabled={isDeleting === dog.id}
                        className="absolute top-4 right-4 p-2 text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                        title="Delete profile"
                      >
                        {isDeleting === dog.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Sidebar: Scan Logs */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-[var(--color-text)] flex items-center gap-2 border-b border-[var(--color-border)] pb-2">
              <Search className="w-5 h-5 text-[var(--color-accent-2)]" /> Scan Activity
            </h2>
            
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5 shadow-lg max-h-[600px] overflow-y-auto custom-scrollbar">
              {logs.length === 0 ? (
                <div className="text-center py-10">
                  <Clock className="w-8 h-8 text-[var(--color-muted)] mx-auto mb-3 opacity-30" />
                  <p className="text-[var(--color-muted)] text-sm">No scans logged yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map(log => (
                    <div key={log.id} className="flex gap-4 p-3 rounded-xl hover:bg-[var(--color-bg)] transition-colors border border-transparent hover:border-[var(--color-border)]">
                      <div className="w-10 h-10 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                        <Search className="w-4 h-4 text-[var(--color-accent-2)]" />
                      </div>
                      <div>
                        <p className="text-sm text-[var(--color-text)] font-medium">
                          <span className="text-[var(--color-accent)]">{log.dog_name}</span> was scanned
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[var(--color-muted)]">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(log.scanned_at)} {formatTime(log.scanned_at)}</span>
                          {log.match_confidence && (
                            <span className="flex items-center gap-1 font-mono text-[var(--color-success)]">
                              {(log.match_confidence * 100).toFixed(1)}% Match
                            </span>
                          )}
                        </div>
                        {(log.location_lat && log.location_lon) && (
                          <p className="text-xs text-[var(--color-muted)] flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" /> {log.location_lat.toFixed(4)}, {log.location_lon.toFixed(4)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </>
  )
}
