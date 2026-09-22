'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { listDogs, deleteDog, getScanLogs } from '../../lib/api'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PawPrint, Plus, Edit, Trash2, Loader2, ShieldCheck,
  Search, Clock, ScanFace, BarChart2, ArrowRight, Camera
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
}

const formatDate = (d: string) => new Date(d).toISOString().split('T')[0]
const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

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
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 w-full">
        <div className="bg-surface border border-border p-10 max-w-sm w-full text-center flex flex-col items-center shadow-brutalist">
          <ShieldCheck className="w-10 h-10 text-accent-blue mb-4" />
          <h2 className="text-xl font-display font-bold mb-2 uppercase tracking-wide text-text-primary">Authentication Required</h2>
          <p className="text-text-muted font-sans text-sm mb-6">You must establish a verified session to access the CANID dashboard.</p>
          <Link href="/login" className="btn-primary w-full text-sm tracking-wide">AUTHENTICATE</Link>
        </div>
      </div>
    )
  }

  const recentLogs = logs.slice(0, 5)

  return (
    <div className="min-h-screen w-full max-w-7xl mx-auto px-6 lg:px-8 py-12 flex flex-col gap-12">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border"
      >
        <div>
          <h1 className="text-4xl md:text-5xl font-bold font-display tracking-tight text-text-primary uppercase">Dashboard</h1>
          <p className="font-mono text-text-muted mt-2 text-sm tracking-tight">SYS_REGISTRY_ACCESS // USER: {session.user.email}</p>
        </div>
        <Link href="/enroll" className="btn-primary py-3 px-6 shrink-0 uppercase tracking-wider text-xs">
          <Plus className="w-4 h-4" /> Register Subject
        </Link>
      </motion.div>

      {/* Quick Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="bg-surface border border-border p-6 flex flex-col gap-2">
          <p className="text-xs font-mono text-text-muted uppercase tracking-wider">Registered Subjects</p>
          <div className="flex items-end justify-between">
            <p className="text-4xl font-bold font-display text-text-primary leading-none">{dogs.length}</p>
            <PawPrint className="w-6 h-6 text-accent-blue" />
          </div>
        </div>
        <div className="bg-surface border border-border p-6 flex flex-col gap-2">
          <p className="text-xs font-mono text-text-muted uppercase tracking-wider">Total System Scans</p>
          <div className="flex items-end justify-between">
            <p className="text-4xl font-bold font-display text-text-primary leading-none">{logs.length}</p>
            <ScanFace className="w-6 h-6 text-accent-green" />
          </div>
        </div>
        <div className="bg-surface border border-border p-6 flex flex-col gap-2">
          <p className="text-xs font-mono text-text-muted uppercase tracking-wider">Last Activity</p>
          <div className="flex items-end justify-between">
            <p className="text-2xl font-mono font-bold text-text-primary leading-none">
              {recentLogs.length > 0 ? formatDate(recentLogs[0].scanned_at) : 'NO_DATA'}
            </p>
            <Clock className="w-6 h-6 text-text-muted" />
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Registered Dogs */}
        <section className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-xl font-display font-semibold uppercase tracking-wide text-text-primary flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-accent-blue" /> Registry
            </h2>
          </div>

          {dogs.length === 0 ? (
            <div className="bg-surface border border-border p-12 flex flex-col items-center text-center shadow-none">
              <div className="w-16 h-16 border border-border flex items-center justify-center mb-6 bg-background">
                <PawPrint className="w-8 h-8 text-text-muted" />
              </div>
              <h3 className="text-lg font-display font-bold uppercase tracking-wide mb-2 text-text-primary">No Subjects Found</h3>
              <p className="font-mono text-text-muted text-xs mb-8 max-w-sm leading-relaxed">The registry is currently empty. Initialize a new subject to begin biometric tracking.</p>
              <Link href="/enroll" className="btn-primary py-3 px-8 text-sm uppercase tracking-wide">Initialize Registration</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <AnimatePresence>
                {dogs.map(dog => (
                  <motion.div
                    key={dog.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="bg-surface border border-border rounded flex flex-col shadow-none hover:shadow-brutalist hover:border-text-secondary transition-all group"
                  >
                    {/* Dog Photo Container */}
                    <div className="h-48 bg-background border-b border-border flex items-center justify-center overflow-hidden relative">
                      {dog.profile_photo_url ? (
                        <img src={dog.profile_photo_url} alt={dog.name} className="w-full h-full object-cover grayscale opacity-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300" />
                      ) : (
                        <Camera className="w-8 h-8 text-border" />
                      )}
                      
                      {/* Action Overlay */}
                      <div className="absolute top-0 right-0 p-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/edit/${dog.id}`}
                          className="w-8 h-8 bg-background border border-border flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(dog.id, dog.name)}
                          disabled={isDeleting === dog.id}
                          className="w-8 h-8 bg-background border border-border flex items-center justify-center text-text-muted hover:text-accent-red hover:border-accent-red transition-colors"
                        >
                          {isDeleting === dog.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    
                    {/* Dog Meta */}
                    <div className="p-6 flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-display text-2xl font-semibold text-text-primary tracking-tight">{dog.name}</h3>
                          <p className="font-sans text-text-secondary text-sm">{dog.breed || 'UNDETERMINED'}</p>
                        </div>
                        <span className="font-mono text-accent-green text-xs border border-border px-2 py-1 bg-surface uppercase tracking-tight">ACTIVE</span>
                      </div>
                      <div className="flex flex-col gap-2 border-t border-border pt-4">
                        <div className="flex justify-between font-mono text-xs">
                          <span className="text-text-muted">ID</span>
                          <span className="text-text-primary">{dog.id.substring(0, 8).toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between font-mono text-xs">
                          <span className="text-text-muted">ENROLLED</span>
                          <span className="text-text-primary">{formatDate(dog.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Right Column: Scan Activity */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-xl font-display font-semibold uppercase tracking-wide text-text-primary flex items-center gap-2">
              <ScanFace className="w-5 h-5 text-text-muted" /> Scan Activity
            </h2>
          </div>

          {logs.length === 0 ? (
            <div className="bg-surface border border-border p-8 text-center flex flex-col items-center">
              <Clock className="w-6 h-6 text-border mb-4" />
              <p className="font-mono text-text-muted text-xs uppercase tracking-widest">No Activity Logs</p>
            </div>
          ) : (
            <div className="bg-surface border border-border flex flex-col divide-y divide-border">
              <AnimatePresence>
                {logs.map((log, idx) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="p-5 flex flex-col gap-2 hover:bg-background transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-sans font-semibold text-text-primary">{log.dog_name}</span>
                      {log.match_confidence && (
                        <span className="font-mono text-xs text-accent-green font-bold">
                          {(log.match_confidence * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between font-mono text-[10px] text-text-muted">
                      <span className="flex items-center gap-1.5"><ScanFace className="w-3 h-3" /> SCANNED</span>
                      <span>{formatDate(log.scanned_at)} {formatTime(log.scanned_at)}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
