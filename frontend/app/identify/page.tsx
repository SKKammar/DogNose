'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Phone, Copy, AlertTriangle, PawPrint, ChevronDown,
  CheckCircle2, ScanLine,
} from 'lucide-react'
import { toast } from 'sonner'
import CameraCapture from '../components/CameraCapture'
import NetworkError from '../components/NetworkError'
import PipelineTerminal from '../components/PipelineTerminal'
import { identifyNose, callWithWakeUp, API_URL } from '../../lib/api'
import type { ApiError } from '../../lib/api'

type Status = 'idle' | 'processing' | 'match' | 'no_match' | 'validation_error' | 'error'

interface HealthAllergy { allergen: string; severity?: 'mild' | 'moderate' | 'severe' | null }
interface HealthInfo {
  allergies: HealthAllergy[]
  vaccination_status: 'up_to_date' | 'overdue' | 'unknown'
  last_weight_kg: number | null
}
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
  behaviour_notes?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  vet_name?: string
  vet_phone?: string
  similarity: number
}
interface Result {
  match: boolean
  matched?: boolean
  message: string
  confidence?: number
  dog?: MatchCandidate
  health?: HealthInfo
  error?: boolean
  code?: string
}

const ERRORS: Record<string, { icon: string; title: string; hint: string }> = {
  BLURRY: { icon: '📸', title: 'Too blurry', hint: 'Hold steady and wait for the camera to focus.' },
  DARK: { icon: '💡', title: 'Too dark', hint: 'Move somewhere with better light.' },
  NOT_A_DOG: { icon: '🐾', title: 'No dog in frame', hint: 'Make sure the dog is clearly visible.' },
  NO_NOSE: { icon: '👃', title: 'Nose not visible', hint: 'Point the camera at the nose from 15–25 cm away.' },
  NOSE_TOO_SMALL: { icon: '🔍', title: 'Too far away', hint: 'Get closer — the nose should fill most of the frame.' },
  BAD_INPUT: { icon: '⚠️', title: 'Invalid image', hint: 'Upload a JPEG, PNG, or WebP photo.' },
  MODELS_LOADING: { icon: '⏳', title: 'Starting up', hint: 'The server is waking up. Try again in a moment.' },
}

export default function IdentifyPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [vError, setVError] = useState<{ icon: string; title: string; hint: string } | null>(null)
  const [step, setStep] = useState(0)
  const [dogCount, setDogCount] = useState(0)

  useEffect(() => {
    fetch(`${API_URL}/stats`).then((r) => r.json()).then((d) => setDogCount(d.registered_dogs || 0)).catch(() => {})
  }, [])

  useEffect(() => {
    if (status !== 'processing') return
    setStep(0)
    const t = setInterval(() => setStep((s) => Math.min(s + 1, 2)), 1400)
    return () => clearInterval(t)
  }, [status])

  const onCapture = async (blob: Blob | Blob[]) => {
    const file = Array.isArray(blob) ? blob[0] : blob
    setResult(null)
    setError(null)
    setVError(null)
    setStatus('processing')
    try {
      const data = await callWithWakeUp(() => identifyNose(file), () => {})
      if (data.error) {
        setVError(ERRORS[data.code] ?? { icon: '⚠️', title: 'Something went wrong', hint: data.message })
        setStatus('validation_error')
        return
      }
      if (data.matched === false || data.match === false) {
        setStatus('no_match')
        return
      }
      setResult(data)
      setStatus('match')
    } catch (e: any) {
      setError(e)
      setStatus('error')
    }
  }

  const reset = () => {
    setStatus('idle')
    setResult(null)
    setError(null)
    setVError(null)
  }

  const copyAll = () => {
    if (!result?.dog) return
    const d = result.dog
    const h = result.health
    const lines = [
      `Dog: ${d.name}`,
      d.breed && `Breed: ${d.breed}`,
      d.age && `Age: ${d.age} yrs`,
      d.sex && `Sex: ${d.sex}`,
      h?.allergies?.length &&
        `Allergies: ${h.allergies.map((a) => `${a.allergen}${a.severity ? ` (${a.severity})` : ''}`).join(', ')}`,
      d.behaviour_notes && `Behaviour: ${d.behaviour_notes}`,
      `Owner: ${d.owner_name || 'Unknown'}`,
      `Phone: ${d.owner_phone || 'N/A'}`,
      d.emergency_contact_phone &&
        `Emergency: ${[d.emergency_contact_name, d.emergency_contact_phone].filter(Boolean).join(' ')}`,
      d.vet_phone && `Vet: ${[d.vet_name, d.vet_phone].filter(Boolean).join(' ')}`,
    ].filter(Boolean)
    navigator.clipboard.writeText(lines.join('\n'))
    toast.success('Copied')
  }

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      {/* Idle */}
      {status === 'idle' && (
        <>
          <div className="mb-8 text-center">
            <p className="font-mono text-xs uppercase tracking-wider text-text-muted mb-3">
              Scan a dog
            </p>
            <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
              Point at the nose
            </h1>
            <p className="text-sm text-text-secondary">
              Fill the oval. Hold steady for one second.
            </p>
          </div>

          <CameraCapture onCapture={onCapture} />

          <div className="mt-6 card p-4">
            <p className="text-xs font-mono uppercase tracking-wider text-text-muted mb-3">
              Tips
            </p>
            <ul className="text-sm text-text-secondary space-y-2">
              <li>· Hold the phone 15–25 cm from the nose</li>
              <li>· Face the nose toward the light</li>
              <li>· If the nose is dirty, wipe it gently</li>
            </ul>
          </div>
        </>
      )}

      {/* Processing */}
      {status === 'processing' && (
        <div className="py-24">
          <PipelineTerminal />
        </div>
      )}

      {/* Match */}
      {status === 'match' && result?.dog && (
        <div className="animate-fade-in w-full max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success animate-pulse-slow" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-success">
                Identity Confirmed
              </span>
            </div>
            <span className="text-[11px] sm:text-xs font-mono font-bold text-text-primary bg-surface-raised px-2 py-1 rounded-md border border-border shadow-sm">
              {Math.round(result.dog.similarity * 100)}% MATCH
            </span>
          </div>

          <div className="card overflow-hidden border-border-strong shadow-md">
            
            {/* --- HERO DOSSIER (Stagger 1) --- */}
            <div className="relative p-4 sm:p-5 flex gap-4 items-start border-b border-border bg-surface animate-slide-up overflow-hidden" style={{ animationDelay: '0ms' }}>
              <div className="absolute right-0 top-0 bottom-0 w-32 opacity-[0.04]" style={{
                  backgroundImage: `linear-gradient(to right, #0F172A 1px, transparent 1px), linear-gradient(to bottom, #0F172A 1px, transparent 1px)`,
                  backgroundSize: '12px 12px'
              }}/>
              
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 p-1 rounded-sm border border-border bg-background flex items-center justify-center shrink-0 z-10 shadow-sm">
                <div className="absolute -top-px -left-px w-2 h-2 border-t-2 border-l-2 border-text-muted" />
                <div className="absolute -bottom-px -right-px w-2 h-2 border-b-2 border-r-2 border-text-muted" />
                {result.dog.profile_photo_url ? (
                  <img src={result.dog.profile_photo_url} alt={result.dog.name} className="w-full h-full object-cover rounded-sm grayscale-[10%] contrast-125" />
                ) : (
                  <PawPrint className="w-8 h-8 text-text-muted" />
                )}
              </div>

              <div className="flex-1 min-w-0 z-10">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-text-primary leading-none tracking-tight break-words">
                    {result.dog.name}
                  </h2>
                  <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border border-accent text-accent bg-accent/5 rounded-sm">
                    ID:{result.dog.dog_id?.slice(0, 6) || 'VERIFIED'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mt-3">
                  {result.dog.breed && (
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-text-secondary">Breed</p>
                      <p className="text-sm text-text-primary font-semibold truncate">{result.dog.breed}</p>
                    </div>
                  )}
                  {result.dog.sex && (
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-text-secondary">Sex</p>
                      <p className="text-sm text-text-primary font-semibold truncate">{result.dog.sex}</p>
                    </div>
                  )}
                  {result.dog.age && (
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-text-secondary">Age</p>
                      <p className="text-sm text-text-primary font-semibold truncate">{result.dog.age} YRS</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* --- MEDICAL PROFILE (Stagger 2) --- */}
            {result.health && (
              (Array.isArray(result.health.allergies) && result.health.allergies.length > 0) || 
              (result.health.vaccination_status && result.health.vaccination_status !== 'unknown') || 
              (result.health.last_weight_kg !== null && result.health.last_weight_kg !== undefined)
            ) && (
              <div className="p-4 sm:p-5 border-b border-border space-y-4 animate-slide-up opacity-0" style={{ animationDelay: '100ms' }}>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-text-secondary">
                   Medical Profile
                </p>

                {result.health.allergies && result.health.allergies.length > 0 && (
                  <div className="space-y-2.5">
                    {result.health.allergies.map((a, i) => {
                      const isSevere = a.severity === 'severe';
                      const isMod = a.severity === 'moderate';
                      
                      // Stronger border opacity for higher contrast
                      const tone = isSevere 
                        ? 'bg-error/10 border-error/50 text-error' 
                        : isMod 
                          ? 'bg-warn/10 border-warn/50 text-warn-dark' // Assuming warn is amber
                          : 'bg-surface-raised border-border-strong text-text-secondary';
                      
                      return (
                        <div key={i} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-3 rounded-md border text-sm font-mono ${tone}`}>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span className="uppercase tracking-wider font-extrabold text-xs sm:text-sm">
                              {a.severity || 'Mild'} Allergy
                            </span>
                          </div>
                          
                          <div className="hidden sm:block flex-1 border-b border-dashed border-current opacity-30"></div>
                          
                          {/* Replaced truncate with break-words so long allergies wrap on phones */}
                          <span className="font-semibold sm:text-right text-text-primary break-words bg-white/50 px-2 py-0.5 rounded-sm">
                            {a.allergen}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="flex flex-wrap gap-2.5 pt-1">
                  {result.health.vaccination_status !== 'unknown' && (
                    <span className={`px-2.5 py-1.5 rounded-md font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider border ${result.health.vaccination_status === 'overdue' ? 'bg-warn/10 text-warn border-warn/30' : 'bg-success/10 text-success border-success/30'}`}>
                      {result.health.vaccination_status === 'overdue' ? 'Vaccines Overdue' : 'Vaccines Up to Date'}
                    </span>
                  )}
                  {result.health.last_weight_kg != null && (
                    <span className="px-2.5 py-1.5 rounded-md font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider border border-border bg-surface-raised shadow-sm text-text-primary">
                      <span className="text-text-secondary mr-1">WEIGHT:</span>
                      {result.health.last_weight_kg} KG
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* --- BEHAVIOUR (Stagger 3) --- */}
            {result.dog.behaviour_notes && (
              <div className="p-4 sm:p-5 border-b border-border animate-slide-up opacity-0" style={{ animationDelay: '200ms' }}>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-text-secondary mb-2.5">
                  Behaviour Notes
                </p>
                <p className="text-sm sm:text-base text-text-primary font-medium leading-relaxed bg-surface-raised p-3.5 rounded-md border border-border shadow-inner">
                  {result.dog.behaviour_notes}
                </p>
              </div>
            )}

            {/* --- OWNER & CONTACT (Stagger 4) --- */}
            <div className="p-4 sm:p-5 border-b border-border bg-surface-raised/50 animate-slide-up opacity-0" style={{ animationDelay: '300ms' }}>
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
                Emergency Contact
              </p>

              <div className="border border-border-strong rounded-md bg-surface overflow-hidden shadow-sm">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-text-primary truncate">
                      {result.dog.owner_name || 'Registered Owner'}
                    </p>
                    <p className="text-xs sm:text-sm text-text-secondary font-mono font-medium mt-1 truncate">
                      {result.dog.owner_phone || 'No primary phone'}
                    </p>
                  </div>
                  {result.dog.owner_phone ? (
                    <a href={`tel:${result.dog.owner_phone}`} className="btn-primary w-full sm:w-auto shrink-0 justify-center">
                      <Phone className="w-4 h-4" /> Call Owner
                    </a>
                  ) : result.dog.emergency_contact_phone ? (
                    <a href={`tel:${result.dog.emergency_contact_phone}`} className="btn-primary w-full sm:w-auto shrink-0 justify-center bg-warn hover:bg-warn/90 border-warn text-white">
                      <Phone className="w-4 h-4" /> Call Backup
                    </a>
                  ) : null}
                </div>
              </div>

              {(result.dog.emergency_contact_phone || result.dog.vet_phone) && (
                <details className="group mt-3 border border-border-strong rounded-md overflow-hidden bg-surface shadow-sm">
                  <summary className="px-4 py-3.5 cursor-pointer flex items-center justify-between list-none hover:bg-surface-raised transition-colors">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-text-primary font-bold">
                      View Backup Contacts
                    </span>
                    <ChevronDown className="w-4 h-4 text-text-primary group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="border-t border-border-strong divide-y divide-border bg-background">
                    {result.dog.emergency_contact_phone && (
                      <a href={`tel:${result.dog.emergency_contact_phone}`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-raised transition-colors">
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-[11px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">Emergency Contact</p>
                          <p className="text-sm font-bold text-text-primary truncate">{result.dog.emergency_contact_name || 'Backup'}</p>
                        </div>
                        <Phone className="w-4 h-4 text-text-primary shrink-0" />
                      </a>
                    )}
                    {result.dog.vet_phone && (
                      <a href={`tel:${result.dog.vet_phone}`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-raised transition-colors">
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-[11px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">Veterinarian</p>
                          <p className="text-sm font-bold text-text-primary truncate">{result.dog.vet_name || 'Vet Clinic'}</p>
                        </div>
                        <Phone className="w-4 h-4 text-text-primary shrink-0" />
                      </a>
                    )}
                  </div>
                </details>
              )}
            </div>

            {/* --- ACTIONS (Stagger 5) --- */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3 bg-surface animate-slide-up opacity-0" style={{ animationDelay: '400ms' }}>
              <button onClick={copyAll} className="btn-secondary flex-1 py-3.5">
                <Copy className="w-4 h-4" /> Copy details
              </button>
              <button onClick={reset} className="btn-primary flex-1 py-3.5 font-bold shadow-md">
                Scan another dog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No match */}
      {status === 'no_match' && (
        <div className="fade-in card">
          <div className="py-14 px-6 text-center">
            <div className="w-14 h-14 mx-auto mb-5 rounded-full border border-border bg-surface-raised flex items-center justify-center">
              <PawPrint className="w-6 h-6 text-text-muted" />
            </div>
            <h2 className="font-display text-xl font-bold text-text-primary mb-2">
              No match in the registry
            </h2>
            <p className="text-sm text-text-secondary max-w-xs mx-auto mb-6 leading-relaxed">
              This dog isn&apos;t registered yet. You can still help find their owner.
            </p>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <Link href="/enroll" className="btn-primary w-full">
                Register this dog
              </Link>
              <button onClick={reset} className="btn-secondary w-full">
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation error */}
      {status === 'validation_error' && vError && (
        <div className="fade-in card">
          <div className="py-14 px-6 text-center">
            <div className="text-4xl mb-5">{vError.icon}</div>
            <h2 className="font-display text-xl font-bold text-text-primary mb-2">
              {vError.title}
            </h2>
            <p className="text-sm text-text-secondary max-w-xs mx-auto mb-6 leading-relaxed">
              {vError.hint}
            </p>
            <button onClick={reset} className="btn-primary">
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Network error */}
      {status === 'error' && error && (
        <div className="fade-in flex justify-center">
          <NetworkError error={error} onRetry={reset} />
        </div>
      )}
    </div>
  )
}
