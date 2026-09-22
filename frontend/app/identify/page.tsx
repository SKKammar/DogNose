'use client'
import React, { useState, useEffect, useRef } from 'react'
import CameraCapture from '../components/CameraCapture'
import { Loader2, ChevronLeft, Phone, Mail, Copy, AlertTriangle, PawPrint, ScanFace, ArrowRight, Info } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { identifyNose, callWithWakeUp, ApiError, API_URL } from '../../lib/api'
import NetworkError from '../components/NetworkError'
import { toast } from 'sonner'

type IdentifyStatus = 'idle' | 'processing' | 'match' | 'no_match' | 'validation_error' | 'error'

interface MatchCandidate {
  dog_id: string
  name: string
  breed?: string
  age?: number
  sex?: string
  color_markings?: string
  owner_name?: string
  owner_phone?: string
  owner_email?: string
  profile_photo_url?: string
  microchip_id?: string
  similarity: number
  is_match: boolean
}

interface IdentifyResult {
  match: boolean
  matched?: boolean
  message: string
  confidence?: number
  confidence_pct?: string
  dog?: MatchCandidate
  error?: boolean
  code?: string
}

const ERROR_MESSAGES: Record<string, { icon: string; title: string; hint: string }> = {
  BLURRY: { icon: '📸', title: 'Image too blurry', hint: 'Hold the camera steady and wait for it to focus before capturing.' },
  DARK: { icon: '💡', title: 'Too dark', hint: 'Move to a brighter area or turn on a light above the dog.' },
  NOT_A_DOG: { icon: '🐾', title: 'No dog detected', hint: 'Make sure your dog is clearly visible in the photo.' },
  NO_NOSE: { icon: '👃', title: 'Nose not visible', hint: 'Point the camera directly at the nose from about 15–20 cm away.' },
  NOSE_TOO_SMALL: { icon: '🔍', title: 'Too far away', hint: 'Get closer — the nose should fill most of the frame.' },
  NO_MATCH: { icon: '❓', title: 'Dog not recognized', hint: "This dog isn't enrolled yet. Use the Enroll option to register them first." },
  BAD_INPUT: { icon: '⚠️', title: 'Invalid image', hint: 'Please upload a JPEG or PNG photo.' },
  MODELS_LOADING: { icon: '⏳', title: 'System starting up', hint: 'The ML models are still loading. Please wait a moment and try again.' },
}

const PROCESSING_STEPS_LABELS = ['Locating nose...', 'Extracting biometric signature...', 'Searching registry...']

export default function IdentifyPage() {
  const [status, setStatus] = useState<IdentifyStatus>('idle')
  const [result, setResult] = useState<IdentifyResult | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [validationError, setValidationError] = useState<{ icon: string; title: string; hint: string } | null>(null)
  const [processingStep, setProcessingStep] = useState(0)
  const [isWaking, setIsWaking] = useState(false)
  const [stats, setStats] = useState({ registered_dogs: 0 })
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/stats`).then(r => r.json()).then(d => setStats(d)).catch(() => {})
    return () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current) }
  }, [])

  const handleCapture = async (blob: Blob | Blob[]) => {
    const imageBlob = Array.isArray(blob) ? blob[0] : blob
    setStatus('processing')
    setProcessingStep(0)
    setResult(null)
    setError(null)
    setValidationError(null)

    stepTimerRef.current = setInterval(() => {
      setProcessingStep(prev => Math.min(prev + 1, PROCESSING_STEPS_LABELS.length - 1))
    }, 1800)

    try {
      const data = await callWithWakeUp(() => identifyNose(imageBlob), setIsWaking)
      if (stepTimerRef.current) clearInterval(stepTimerRef.current)

      if (data.error && data.code) {
        setValidationError(ERROR_MESSAGES[data.code] || { icon: '⚠️', title: 'Unknown error', hint: data.message || 'Please try again.' })
        setStatus('validation_error')
        return
      }

      setResult(data)
      setStatus(data.match || data.matched ? 'match' : 'no_match')
    } catch (err: any) {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current)
      setError(err)
      setStatus('error')
    } finally {
      setIsWaking(false)
    }
  }

  const reset = async () => {
    setStatus('idle'); setResult(null); setError(null); setValidationError(null); setProcessingStep(0); setIsWaking(false)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`))
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-display mb-1">Identify a Dog</h1>
          <p className="text-[var(--color-muted)] text-sm">
            {stats.registered_dogs > 0
              ? `Searching across ${stats.registered_dogs} registered dogs.`
              : 'No account required — scan any dog to identify them.'}
          </p>
        </div>

        <AnimatePresence mode="wait">

          {/* IDLE — Camera */}
          {status === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="w-full aspect-[3/4] mb-5">
                <CameraCapture onCapture={handleCapture} remainingPhotos={1} />
              </div>
              <div className="card p-4 flex items-start gap-3">
                <Info className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  Point the camera directly at the dog&apos;s nose from 15–20 cm away. Ensure good lighting and hold steady.
                </p>
              </div>
            </motion.div>
          )}

          {/* PROCESSING */}
          {status === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-24 text-center">
              {isWaking ? (
                <>
                  <Loader2 className="w-12 h-12 animate-spin text-[var(--color-accent)] mb-5" />
                  <h2 className="text-xl font-bold mb-2">Waking up the engine...</h2>
                  <p className="text-[var(--color-muted)] text-sm max-w-xs">The ML models are loading. This takes 30–60 seconds the first time.</p>
                </>
              ) : (
                <>
                  <div className="relative w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-full border-2 border-[var(--color-accent)]/20 animate-ping" />
                    <div className="w-20 h-20 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 flex items-center justify-center">
                      <ScanFace className="w-8 h-8 text-[var(--color-accent)]" />
                    </div>
                  </div>
                  <div className="space-y-2 w-full max-w-xs">
                    {PROCESSING_STEPS_LABELS.map((label, idx) => (
                      <div key={label} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${idx === processingStep ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20' : idx < processingStep ? 'opacity-40' : 'opacity-20'}`}>
                        {idx < processingStep ? (
                          <span className="w-4 h-4 text-[var(--color-success)] text-xs">✓</span>
                        ) : idx === processingStep ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)] shrink-0" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-[var(--color-muted)] shrink-0" />
                        )}
                        <span className={`text-sm ${idx === processingStep ? 'text-[var(--color-text)] font-medium' : 'text-[var(--color-muted)]'}`}>
                          {idx === 2 ? `Searching ${stats.registered_dogs || '...'} registered dogs...` : label}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* MATCH */}
          {status === 'match' && result?.dog && (
            <motion.div key="match" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="card overflow-hidden">
                {/* Match header */}
                <div className="bg-[var(--color-success)]/10 border-b border-[var(--color-success)]/20 px-6 py-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center">
                    <span className="text-[var(--color-success)] text-sm">✓</span>
                  </div>
                  <div>
                    <p className="text-[var(--color-success)] font-semibold text-sm">Match Found</p>
                    <p className="text-[var(--color-success)]/70 text-xs font-mono">
                      {result.confidence_pct || `${((result.confidence || 0) * 100).toFixed(1)}%`} confidence
                    </p>
                  </div>
                </div>

                {/* Dog photo + info */}
                <div className="flex gap-5 p-6">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[var(--color-surface-2)] border border-[var(--color-border)] shrink-0">
                    {result.dog.profile_photo_url ? (
                      <img src={result.dog.profile_photo_url} alt={result.dog.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PawPrint className="w-8 h-8 text-[var(--color-muted)] opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold font-display mb-1">{result.dog.name}</h2>
                    {result.dog.breed && <p className="text-[var(--color-muted)] text-sm mb-2">{result.dog.breed}</p>}
                    <div className="flex flex-wrap gap-2">
                      {result.dog.age && <span className="badge badge-accent">{result.dog.age} yrs</span>}
                      {result.dog.sex && <span className="badge badge-accent">{result.dog.sex}</span>}
                      {result.dog.color_markings && <span className="badge badge-accent">{result.dog.color_markings}</span>}
                    </div>
                  </div>
                </div>

                {/* Owner contact */}
                {(result.dog.owner_name || result.dog.owner_phone || result.dog.owner_email) && (
                  <div className="border-t border-[var(--color-border)] px-6 py-5">
                    <p className="text-xs text-[var(--color-muted)] uppercase tracking-wider font-semibold mb-4">Owner Contact</p>
                    <div className="space-y-3">
                      {result.dog.owner_name && (
                        <p className="text-sm font-medium">{result.dog.owner_name}</p>
                      )}
                      {result.dog.owner_phone && (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                            <Phone className="w-4 h-4 text-[var(--color-accent)]" />
                            {result.dog.owner_phone}
                          </div>
                          <button onClick={() => copyToClipboard(result.dog!.owner_phone!, 'Phone')} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)] flex items-center gap-1 transition-colors">
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                        </div>
                      )}
                      {result.dog.owner_email && (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                            <Mail className="w-4 h-4 text-[var(--color-accent)]" />
                            {result.dog.owner_email}
                          </div>
                          <button onClick={() => copyToClipboard(result.dog!.owner_email!, 'Email')} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)] flex items-center gap-1 transition-colors">
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* View full profile */}
                <div className="border-t border-[var(--color-border)] px-6 py-4">
                  <Link href={`/dogs/${result.dog.dog_id}`} className="btn-primary w-full justify-center py-3 rounded-xl">
                    View Full Profile <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              <button onClick={reset} className="btn-ghost w-full py-3 rounded-xl">Scan Again</button>
            </motion.div>
          )}

          {/* NO MATCH */}
          {status === 'no_match' && (
            <motion.div key="no_match" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="card p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-[var(--color-warn)]/10 border border-[var(--color-warn)]/20 flex items-center justify-center mx-auto mb-5">
                  <PawPrint className="w-8 h-8 text-[var(--color-warn)]" />
                </div>
                <h2 className="text-xl font-bold mb-2">No match found</h2>
                <p className="text-[var(--color-muted)] text-sm mb-6">This dog doesn&apos;t appear to be enrolled in the registry yet.</p>
                <div className="space-y-3">
                  <Link href="/enroll" className="btn-primary w-full justify-center py-3 rounded-xl">Register This Dog</Link>
                  <button onClick={reset} className="btn-ghost w-full py-3 rounded-xl">Try Again</button>
                </div>
              </div>
            </motion.div>
          )}

          {/* VALIDATION ERROR */}
          {status === 'validation_error' && validationError && (
            <motion.div key="val_error" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="card p-8 text-center">
                <div className="text-4xl mb-4">{validationError.icon}</div>
                <h2 className="text-xl font-bold mb-2">{validationError.title}</h2>
                <p className="text-[var(--color-muted)] text-sm mb-6">{validationError.hint}</p>
                <button onClick={reset} className="btn-primary w-full justify-center py-3 rounded-xl">Try Again</button>
              </div>
            </motion.div>
          )}

          {/* NETWORK ERROR */}
          {status === 'error' && error && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <NetworkError error={error} onRetry={reset} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
