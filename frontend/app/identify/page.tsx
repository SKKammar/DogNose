'use client'
import React, { useState, useEffect, useRef } from 'react'
import CameraCapture from '../components/CameraCapture'
import { Loader2, Phone, Mail, Copy, ScanFace, ArrowRight, Info, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { identifyNose, callWithWakeUp, API_URL } from '../../lib/api'
import type { ApiError } from '../../lib/api'
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

interface IdentifyHealth {
  allergies: { allergen: string; severity?: 'mild' | 'moderate' | 'severe' | null }[]
  vaccination_status: 'up_to_date' | 'overdue' | 'unknown'
  last_weight_kg: number | null
}

interface IdentifyResult {
  match: boolean
  matched?: boolean
  message: string
  confidence?: number
  confidence_pct?: string
  dog?: MatchCandidate
  health?: IdentifyHealth
  error?: boolean
  code?: string
}

const ERROR_MESSAGES: Record<string, { icon: string; title: string; hint: string }> = {
  BLURRY: { icon: 'BLUR_ERR', title: 'Image resolution insufficient', hint: 'Camera must be held steady. Wait for autofocus lock before capture.' },
  DARK: { icon: 'LUX_ERR', title: 'Ambient light insufficient', hint: 'Reposition subject into a brighter environment.' },
  NOT_A_DOG: { icon: 'SUB_ERR', title: 'Subject unidentifiable', hint: 'Target must be clearly framed.' },
  NO_NOSE: { icon: 'TGT_ERR', title: 'Biometric target lost', hint: 'Center the nose pattern inside the reticle.' },
  NOSE_TOO_SMALL: { icon: 'DIST_ERR', title: 'Proximity warning', hint: 'Reduce distance to target. Maintain 15–20cm.' },
  NO_MATCH: { icon: '404_ERR', title: 'Subject unknown', hint: 'Record not found in the central registry.' },
  BAD_INPUT: { icon: 'FMT_ERR', title: 'Data corruption', hint: 'Data stream rejected. Use standard JPEG/PNG payload.' },
  MODELS_LOADING: { icon: 'SYS_BOOT', title: 'Engine initializing', hint: 'Neural network cold-starting. Please hold.' },
}

const PROCESSING_STEPS_LABELS = ['ISOLATING BIOMETRIC TARGET', 'EXTRACTING SIGNATURE VECTORS', 'QUERYING GLOBAL REGISTRY']

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
        setValidationError(ERROR_MESSAGES[data.code] || { icon: 'ERR_UNKNOWN', title: 'System Exception', hint: data.message || 'Execution halted.' })
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
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} COPIED TO CLIPBOARD`))
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-4xl">

        {/* Header */}
        <div className="text-center mb-10 flex flex-col items-center border-b border-border pb-6">
          <ScanFace className="w-8 h-8 text-text-primary mb-4" />
          <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tight text-text-primary mb-2">Biometric Scan</h1>
          <p className="font-mono text-text-muted text-xs tracking-widest uppercase">
            {stats.registered_dogs > 0
              ? `LIVE REGISTRY: ${stats.registered_dogs} SUBJECTS`
              : 'SYSTEM ONLINE // READY'}
          </p>
        </div>

        <AnimatePresence mode="wait">

          {/* IDLE — Camera */}
          {status === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="w-full mb-6 relative">
                <CameraCapture onCapture={handleCapture} remainingPhotos={1} />
              </div>
              <div className="bg-surface border border-border p-4 flex items-start gap-4">
                <Info className="w-5 h-5 text-accent-blue shrink-0" />
                <p className="font-mono text-xs text-text-muted leading-relaxed uppercase tracking-wider">
                  Align target subject within reticle. Maintain 15–20cm distance. Ensure adequate lighting. System will auto-evaluate sharpness.
                </p>
              </div>
            </motion.div>
          )}

          {/* PROCESSING */}
          {status === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-32 text-center border border-border bg-surface shadow-brutalist">
              {isWaking ? (
                <>
                  <Loader2 className="w-12 h-12 animate-spin text-accent-blue mb-6" />
                  <h2 className="text-2xl font-display font-bold uppercase tracking-wide text-text-primary mb-2">Engine Boot Sequence</h2>
                  <p className="font-mono text-text-muted text-xs uppercase tracking-widest max-w-sm">Neural network cold-start in progress. Estimated time: 30s.</p>
                </>
              ) : (
                <>
                  <div className="relative w-24 h-24 mb-10">
                    <div className="absolute inset-0 rounded-none border border-accent-blue/30 animate-ping" />
                    <div className="w-24 h-24 bg-background border border-accent-blue flex items-center justify-center">
                      <ScanFace className="w-10 h-10 text-accent-blue" />
                    </div>
                  </div>
                  <div className="space-y-4 w-full max-w-md text-left px-8">
                    {PROCESSING_STEPS_LABELS.map((label, idx) => (
                      <div key={label} className={`flex items-center gap-4 py-2 border-b border-border ${idx === processingStep ? 'opacity-100' : idx < processingStep ? 'opacity-40' : 'opacity-20'}`}>
                        {idx < processingStep ? (
                          <span className="font-mono text-accent-green font-bold text-sm">[OK]</span>
                        ) : idx === processingStep ? (
                          <Loader2 className="w-4 h-4 animate-spin text-accent-blue shrink-0" />
                        ) : (
                          <span className="font-mono text-text-muted text-sm">[--]</span>
                        )}
                        <span className={`font-mono text-xs tracking-wider ${idx === processingStep ? 'text-text-primary' : 'text-text-muted'}`}>
                          {idx === 2 ? `QUERYING ${stats.registered_dogs || '...'} RECORDS` : label}
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
            <motion.div key="match" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="max-w-4xl mx-auto border border-border bg-surface flex flex-col md:flex-row shadow-brutalist overflow-hidden">
                {/* Status Banner */}
                <div className="bg-accent-green text-background p-8 flex flex-col justify-center items-start md:w-1/3">
                  <span className="font-mono text-sm tracking-widest font-bold mb-4 uppercase">System Status</span>
                  <h2 className="font-display text-4xl md:text-5xl font-bold leading-none tracking-tighter">POSITIVE MATCH</h2>
                </div>
                
                {/* Data Block */}
                <div className="p-8 md:w-2/3 flex flex-col gap-8 bg-background border-l border-border relative">
                  {/* Photo Thumbnail */}
                  {result.dog.profile_photo_url && (
                    <div className="absolute top-8 right-8 w-20 h-20 border border-border grayscale overflow-hidden hidden sm:block">
                      <img src={result.dog.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-x-8 gap-y-6 font-mono text-sm">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-text-muted text-xs uppercase tracking-widest">Similarity Index</span>
                      <span className="text-accent-green font-bold text-xl">
                        {result.confidence_pct || `${((result.confidence || 0) * 100).toFixed(2)}%`}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-text-muted text-xs uppercase tracking-widest">Subject ID</span>
                      <span className="text-text-primary">{result.dog.dog_id.substring(0, 12).toUpperCase()}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-text-muted text-xs uppercase tracking-widest">Subject Name</span>
                      <span className="text-text-primary font-sans text-lg font-semibold">{result.dog.name}</span>
                    </div>
                    {result.dog.breed && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-text-muted text-xs uppercase tracking-widest">Classification</span>
                        <span className="text-text-primary font-sans">{result.dog.breed}</span>
                      </div>
                    )}
                  </div>

                  {/* Health summary */}
                  {result.health && (
                    <div className="px-6 pb-6 border-b border-border">
                      <p className="text-sm font-semibold text-text-primary mb-3">
                        Health
                      </p>

                      {result.health.allergies.length > 0 && (
                        <div className="mb-3 space-y-1.5">
                          {result.health.allergies.map((a, i) => {
                            const tone =
                              a.severity === 'severe'
                                ? 'bg-accent-red/10 border-accent-red text-accent-red'
                                : a.severity === 'moderate'
                                ? 'bg-accent-amber/10 border-accent-amber text-accent-amber'
                                : 'bg-surface border-border text-text-secondary'
                            return (
                              <div
                                key={i}
                                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs ${tone}`}
                              >
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span className="font-medium">Allergic to:</span>
                                <span className="font-mono">{a.allergen}</span>
                                {a.severity && (
                                  <span className="ml-auto font-mono uppercase text-[10px] tracking-wider opacity-80">
                                    {a.severity}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {result.health.vaccination_status !== 'unknown' && (
                          <span
                            className={`badge-outline ${
                              result.health.vaccination_status === 'overdue'
                                ? 'text-accent-amber border-accent-amber'
                                : 'text-accent-green border-accent-green'
                            }`}
                          >
                            {result.health.vaccination_status === 'overdue'
                              ? 'Vaccinations overdue'
                              : 'Vaccinations up to date'}
                          </span>
                        )}

                        {result.health.last_weight_kg != null && (
                          <span className="badge-outline text-text-secondary border-border">
                            {result.health.last_weight_kg} kg
                          </span>
                        )}
                      </div>

                      {result.health.allergies.length === 0 &&
                       result.health.vaccination_status === 'unknown' &&
                       result.health.last_weight_kg == null && (
                        <p className="text-xs text-text-muted">
                          No health records on file.
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Owner Contact */}
                  {(result.dog.owner_name || result.dog.owner_phone || result.dog.owner_email) && (
                    <div className="border-t border-border pt-6 mt-2">
                      <span className="text-text-muted text-xs uppercase tracking-widest mb-4 block">Primary Contact</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans text-sm text-text-primary">
                        {result.dog.owner_name && <div>{result.dog.owner_name}</div>}
                        {result.dog.owner_phone && (
                          <div className="flex items-center justify-between border border-border bg-surface px-3 py-2">
                            <span className="flex items-center gap-2 font-mono"><Phone size={14} className="text-text-muted" /> {result.dog.owner_phone}</span>
                            <button onClick={() => copyToClipboard(result.dog!.owner_phone!, 'Phone')} className="text-accent-blue hover:text-[#3B82F6]"><Copy size={14} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-border pt-6 flex flex-col sm:flex-row gap-4 mt-auto">
                    <button onClick={reset} className="btn-ghost flex-1 py-3 text-sm tracking-wide">INITIALIZE NEW SCAN</button>
                    {/* Note: /dogs/[id] is currently unimplemented on the backend per earlier logs, so we will not display a broken link */}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* NO MATCH */}
          {status === 'no_match' && (
            <motion.div key="no_match" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-2xl mx-auto bg-surface border border-border shadow-brutalist">
              <div className="p-8 border-b border-border flex items-center gap-4 bg-background">
                <div className="w-12 h-12 bg-surface border border-text-muted flex items-center justify-center shrink-0">
                  <span className="font-mono text-text-muted font-bold text-xl">!</span>
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold text-text-primary tracking-tight uppercase">No Subject Found</h2>
                  <p className="font-mono text-xs text-text-muted tracking-widest mt-1">ERR_CODE: NO_MATCH</p>
                </div>
              </div>
              <div className="p-8 flex flex-col gap-8">
                <p className="font-sans text-text-secondary leading-relaxed">
                  The biometric signature extracted from the image does not match any record in the current CANID registry.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 border-t border-border pt-8">
                  <Link href="/enroll" className="btn-primary flex-1 py-3 justify-center text-sm tracking-wide">REGISTER SUBJECT</Link>
                  <button onClick={reset} className="btn-ghost flex-1 py-3 justify-center text-sm tracking-wide">RETRY SCAN</button>
                </div>
              </div>
            </motion.div>
          )}

          {/* VALIDATION ERROR */}
          {status === 'validation_error' && validationError && (
            <motion.div key="val_error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-2xl mx-auto bg-surface border border-accent-red shadow-brutalist">
              <div className="p-8 border-b border-border flex items-start gap-4">
                <div className="w-12 h-12 bg-background border border-accent-red flex items-center justify-center shrink-0">
                  <span className="font-mono text-accent-red font-bold text-xs uppercase">{validationError.icon.substring(0, 4)}</span>
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold text-text-primary tracking-tight uppercase">{validationError.title}</h2>
                  <p className="font-mono text-xs text-accent-red tracking-widest mt-1 uppercase">ERR_CODE: {validationError.icon}</p>
                </div>
              </div>
              <div className="p-8 flex flex-col gap-8">
                <p className="font-sans text-text-secondary">{validationError.hint}</p>
                <div className="border-t border-border pt-8">
                  <button onClick={reset} className="w-full btn-ghost border-accent-red text-accent-red hover:bg-background py-3 justify-center text-sm tracking-wide">ACKNOWLEDGE & RETRY</button>
                </div>
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
