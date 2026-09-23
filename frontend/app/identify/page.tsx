'use client'
import React, { useState, useEffect, useRef } from 'react'
import CameraCapture from '../components/CameraCapture'
import { Loader2, Phone, Mail, Copy, ScanFace, ArrowRight, Info, AlertTriangle, ChevronDown, PawPrint, Camera } from 'lucide-react'
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
  behaviour_notes?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  vet_name?: string
  vet_phone?: string
  similarity: number
  is_match: boolean
}

interface HealthAllergy {
  allergen: string
  severity?: 'mild' | 'moderate' | 'severe' | null
}

interface HealthInfo {
  allergies: HealthAllergy[]
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
  health?: HealthInfo
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
  const [showReportModal, setShowReportModal] = useState(false)
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

  const handleCopy = () => {
    if (!result?.dog) return
    const d = result.dog
    const h = result.health
    const allergyLine = h?.allergies?.length
      ? h.allergies
          .map(a => `${a.allergen}${a.severity ? ` (${a.severity})` : ''}`)
          .join(', ')
      : null
    const lines = [
      `Dog: ${d.name}`,
      d.breed && `Breed: ${d.breed}`,
      d.age && `Age: ${d.age} yrs`,
      d.sex && `Sex: ${d.sex}`,
      d.color_markings && `Colour: ${d.color_markings}`,
      allergyLine && `Allergies: ${allergyLine}`,
      d.behaviour_notes && `Behaviour: ${d.behaviour_notes}`,
      `Owner: ${d.owner_name || 'Unknown'}`,
      `Phone: ${d.owner_phone || 'N/A'}`,
      d.emergency_contact_phone &&
        `Emergency: ${[d.emergency_contact_name, d.emergency_contact_phone]
          .filter(Boolean)
          .join(' ')}`,
      d.vet_phone &&
        `Vet: ${[d.vet_name, d.vet_phone].filter(Boolean).join(' ')}`,
    ].filter(Boolean)
    navigator.clipboard.writeText(lines.join('\n'))
    toast.success('Copied all details')
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
  <motion.div
    key="match"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="w-full max-w-md mx-auto relative z-10"
  >
    {/* Top status bar */}
    <div className="flex items-center justify-between mb-4 px-1">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-accent-green" />
        <span className="text-xs font-mono uppercase tracking-wider text-accent-green font-bold">
          Match found
        </span>
      </div>
      {typeof result.dog.similarity === 'number' && (
        <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
          {Math.round(result.dog.similarity * 100)}%
        </span>
      )}
    </div>

    <div className="bg-surface border border-border rounded overflow-hidden">
      {/* Hero — photo + basics */}
      <div className="p-6 flex gap-5 items-start border-b border-border">
        <div className="w-24 h-24 rounded overflow-hidden bg-background border border-border shrink-0 flex items-center justify-center">
          {result.dog.profile_photo_url ? (
            <img
              src={result.dog.profile_photo_url}
              alt={result.dog.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <PawPrint className="w-8 h-8 text-text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-3xl font-display font-bold text-text-primary leading-none mb-2">
            {result.dog.name}
          </h2>
          <p className="text-sm text-text-secondary mb-1">
            {[result.dog.breed, result.dog.age && `${result.dog.age} yrs`, result.dog.sex]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {result.dog.color_markings && (
            <p className="text-xs text-text-muted">{result.dog.color_markings}</p>
          )}
        </div>
      </div>

      {/* Health flags */}
      {result.health &&
        (result.health.allergies.length > 0 ||
          result.health.vaccination_status !== 'unknown' ||
          result.health.last_weight_kg != null) && (
          <div className="p-6 border-b border-border space-y-3">
            <p className="field-label">Take care</p>

            {result.health.allergies.map((a, i) => {
              const severe = a.severity === 'severe'
              const moderate = a.severity === 'moderate'
              const tone = severe
                ? 'bg-accent-red text-background border-accent-red'
                : moderate
                ? 'bg-[#FBBF24] text-background border-[#FBBF24]'
                : 'bg-surface text-text-secondary border-border'
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-3 rounded border font-mono text-xs font-bold uppercase tracking-tight overflow-hidden ${tone}`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="shrink-0">
                    {severe ? 'Severe allergy' : moderate ? 'Allergy' : 'Mild allergy'}
                  </span>
                  <span className="ml-auto truncate">{a.allergen}</span>
                </div>
              )
            })}

            <div className="flex flex-wrap gap-2">
              {result.health.vaccination_status !== 'unknown' && (
                <span
                  className={`badge ${
                    result.health.vaccination_status === 'overdue'
                      ? 'bg-[#FBBF24] text-background'
                      : 'bg-accent-green text-background'
                  }`}
                >
                  {result.health.vaccination_status === 'overdue'
                    ? 'Vaccines overdue'
                    : 'Vaccines up to date'}
                </span>
              )}
              {result.health.last_weight_kg != null && (
                <span className="badge bg-surface text-text-secondary border border-border px-2 py-1">
                  {result.health.last_weight_kg} kg
                </span>
              )}
            </div>
          </div>
        )}

      {/* Behaviour */}
      {result.dog.behaviour_notes && (
        <div className="p-6 border-b border-border">
          <p className="field-label">Behaviour</p>
          <p className="text-sm text-text-secondary leading-relaxed line-clamp-3">
            {result.dog.behaviour_notes}
          </p>
        </div>
      )}

      {/* Contact */}
      <div className="p-6 border-b border-border">
        <p className="field-label">Contact the owner</p>

        <div className="border border-border rounded overflow-hidden mb-3">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-background">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">
                {result.dog.owner_name || 'Owner'}
              </p>
              <p className="text-xs text-text-muted font-mono mt-0.5">
                {result.dog.owner_phone || 'No phone on file'}
              </p>
            </div>
            {result.dog.owner_phone ? (
              <a
                href={`tel:${result.dog.owner_phone}`}
                className="btn-primary text-xs px-4 py-2 shrink-0 flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" />
                Call
              </a>
            ) : result.dog.emergency_contact_phone ? (
              <a
                href={`tel:${result.dog.emergency_contact_phone}`}
                className="btn-primary text-xs px-4 py-2 shrink-0 flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" />
                Emergency
              </a>
            ) : null}
          </div>
        </div>

        {(result.dog.emergency_contact_phone || result.dog.vet_phone) && (
          <details className="group border border-border rounded overflow-hidden">
            <summary className="px-4 py-3 cursor-pointer text-xs font-mono uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors flex items-center justify-between list-none">
              <span>Backup contacts</span>
              <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="border-t border-border divide-y divide-border">
              {result.dog.emergency_contact_phone && (
                <a
                  href={`tel:${result.dog.emergency_contact_phone}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-background transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-text-muted font-mono mb-0.5">
                      Emergency
                    </p>
                    <p className="text-sm text-text-primary truncate">
                      {result.dog.emergency_contact_name || 'Emergency contact'}
                    </p>
                    <p className="text-xs text-text-muted font-mono">
                      {result.dog.emergency_contact_phone}
                    </p>
                  </div>
                  <Phone className="w-4 h-4 text-text-muted shrink-0" />
                </a>
              )}
              {result.dog.vet_phone && (
                <a
                  href={`tel:${result.dog.vet_phone}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-background transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-text-muted font-mono mb-0.5">
                      Vet
                    </p>
                    <p className="text-sm text-text-primary truncate">
                      {result.dog.vet_name || 'Veterinarian'}
                    </p>
                    <p className="text-xs text-text-muted font-mono">
                      {result.dog.vet_phone}
                    </p>
                  </div>
                  <Phone className="w-4 h-4 text-text-muted shrink-0" />
                </a>
              )}
            </div>
          </details>
        )}
      </div>

      {/* Actions */}
      <div className="p-6 flex flex-col gap-3 bg-background">
        <button
          onClick={handleCopy}
          className="btn-ghost w-full justify-center flex items-center gap-2"
        >
          <Copy className="w-4 h-4" />
          Copy all details
        </button>
        <button
          onClick={reset}
          className="btn-primary w-full justify-center flex items-center gap-2"
        >
          <Camera className="w-4 h-4" />
          Scan another dog
        </button>
      </div>
    </div>

    <button
      onClick={() => setShowReportModal(true)}
      className="mt-4 w-full text-center text-xs text-text-muted underline hover:text-text-secondary transition-colors"
    >
      Report this match as incorrect
    </button>
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
