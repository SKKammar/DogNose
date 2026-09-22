'use client'
import React, { useState, useEffect } from 'react'
import CameraCapture from '../components/CameraCapture'
import { Loader2, AlertTriangle, CheckCircle2, X, ChevronLeft, ShieldCheck, Plus, PawPrint } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { registerDog, enrollNose, callWithWakeUp, ApiError } from '../../lib/api'
import NetworkError from '../components/NetworkError'
import { toast } from 'sonner'

type EnrollStep = 'details' | 'capture' | 'uploading' | 'success' | 'error'

interface PhotoStatus {
  blob: Blob
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

const STEPS = ['Dog Details', 'Nose Photos']

export default function EnrollPage() {
  const [step, setStep] = useState<EnrollStep>('details')
  const [photos, setPhotos] = useState<PhotoStatus[]>([])
  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [age, setAge] = useState<number | ''>('')
  const [sex, setSex] = useState('Unknown')
  const [colorMarkings, setColorMarkings] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [microchipId, setMicrochipId] = useState('')
  const [notes, setNotes] = useState('')
  const [showOwner, setShowOwner] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [enrolledDogName, setEnrolledDogName] = useState('')
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null)
  const [isWakingUp, setIsWakingUp] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session)
      setIsAuthChecking(false)
    })
  }, [])

  const handleCapture = (blobs: Blob | Blob[]) => {
    const newBlobs = Array.isArray(blobs) ? blobs : [blobs]
    if (retakeIndex !== null) {
      setPhotos(prev => {
        const updated = [...prev]
        updated[retakeIndex] = { blob: newBlobs[0], status: 'pending' }
        return updated
      })
      setRetakeIndex(null)
    } else {
      setPhotos(prev => [...prev, ...newBlobs.map(b => ({ blob: b, status: 'pending' as const }))])
    }
  }

  const removePhoto = (index: number) => setPhotos(photos.filter((_, i) => i !== index))

  const handleSubmit = async () => {
    if (photos.length < 1 || !name) return
    setStep('uploading')
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw { type: 'server', message: 'Session expired. Please sign in again.' }
      const token = session.access_token

      const dogData = await callWithWakeUp(() => registerDog({
        name, breed: breed || null, age: age === '' ? null : Number(age), sex,
        color_markings: colorMarkings || null, owner_name: ownerName || null,
        owner_phone: ownerPhone || null, owner_email: ownerEmail || null,
        microchip_id: microchipId || null, notes: notes || null
      }, token), setIsWakingUp)

      const enrollResult = await callWithWakeUp(() => enrollNose(dogData.id, photos.map(p => p.blob), token), setIsWakingUp)

      if (enrollResult.error) {
        const errorCode = enrollResult.code || 'UNKNOWN'
        const photoErrors = enrollResult.photo_errors || []
        if (errorCode === 'NO_VALID_PHOTOS') {
          setPhotos(prev => prev.map((p, idx) => {
            const photoErr = photoErrors.find((e: any) => e.photo === idx + 1)
            return { ...p, status: 'error', error: photoErr ? `${photoErr.code}: ${photoErr.message}` : 'No nose detected — retake' }
          }))
          setStep('capture')
          return
        }
        throw { type: 'validation', message: enrollResult.message || 'Enrollment failed' }
      }

      setPhotos(prev => prev.map(p => ({ ...p, status: 'success' })))
      setEnrolledDogName(name)
      setStep('success')
    } catch (err: any) {
      setError(err)
      setStep('error')
    } finally {
      setIsWakingUp(false)
    }
  }

  const resetForm = () => {
    setStep('details'); setName(''); setBreed(''); setAge(''); setSex('Unknown')
    setColorMarkings(''); setOwnerName(''); setOwnerPhone(''); setOwnerEmail('')
    setMicrochipId(''); setNotes(''); setShowOwner(false); setPhotos([]); setEnrolledDogName('')
  }

  if (isAuthChecking) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-10 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center mx-auto mb-5">
            <ShieldCheck className="w-7 h-7 text-[var(--color-accent)]" />
          </div>
          <h2 className="text-xl font-bold mb-2">Sign in required</h2>
          <p className="text-[var(--color-muted)] text-sm mb-6">You need an account to register a dog.</p>
          <Link href="/login" className="btn-primary w-full justify-center py-3 rounded-xl">Sign In to CANID</Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg">

        {/* Page Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold font-display mb-1">Register a Dog</h1>
          <p className="text-[var(--color-muted)] text-sm">Enroll your dog&apos;s biometric nose print into the registry.</p>
        </div>

        {/* Step Indicator */}
        {(step === 'details' || step === 'capture') && (
          <div className="flex items-center justify-center gap-3 mb-8">
            {STEPS.map((s, i) => {
              const active = (step === 'details' && i === 0) || (step === 'capture' && i === 1)
              const done = step === 'capture' && i === 0
              return (
                <React.Fragment key={s}>
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      done ? 'bg-[var(--color-success)] text-white' :
                      active ? 'bg-[var(--color-accent)] text-white' :
                      'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
                    }`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className={`text-sm font-medium ${active ? 'text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}>{s}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className="flex-1 h-px bg-[var(--color-border)] max-w-[60px]" />}
                </React.Fragment>
              )
            })}
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* STEP 1: Details */}
          {step === 'details' && (
            <motion.div key="details" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="card p-6 space-y-5">
                <h2 className="text-lg font-bold border-b border-[var(--color-border)] pb-3">Dog Information</h2>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="field-label">Dog&apos;s Name *</label>
                    <input type="text" required value={name} onChange={e => setName(e.target.value)} className="input-base" placeholder="e.g. Max" />
                  </div>
                  <div>
                    <label className="field-label">Breed *</label>
                    <input type="text" required value={breed} onChange={e => setBreed(e.target.value)} className="input-base" placeholder="e.g. Labrador Retriever" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Age (years) *</label>
                      <input type="number" required step="0.1" min="0" value={age} onChange={e => setAge(e.target.value === '' ? '' : Number(e.target.value))} className="input-base" placeholder="e.g. 2" />
                    </div>
                    <div>
                      <label className="field-label">Sex *</label>
                      <select value={sex} onChange={e => setSex(e.target.value)} className="input-base appearance-none">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Unknown">Unknown</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Color & Markings *</label>
                    <input type="text" required value={colorMarkings} onChange={e => setColorMarkings(e.target.value)} className="input-base" placeholder="e.g. Golden with white chest patch" />
                  </div>
                </div>

                {/* Owner details toggle */}
                <div className="border-t border-[var(--color-border)] pt-4">
                  <button onClick={() => setShowOwner(!showOwner)} className="w-full flex items-center justify-between text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors">
                    <span className="font-medium">Owner details <span className="text-xs">(optional but recommended)</span></span>
                    <Plus className={`w-4 h-4 transition-transform ${showOwner ? 'rotate-45' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showOwner && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="space-y-4 mt-4">
                          <div>
                            <label className="field-label">Owner Name</label>
                            <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} className="input-base" placeholder="e.g. Jane Doe" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="field-label">Phone</label>
                              <input type="tel" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} className="input-base" placeholder="+1 555-1234" />
                            </div>
                            <div>
                              <label className="field-label">Email</label>
                              <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} className="input-base" placeholder="jane@example.com" />
                            </div>
                          </div>
                          <div>
                            <label className="field-label">Microchip ID</label>
                            <input type="text" value={microchipId} onChange={e => setMicrochipId(e.target.value)} className="input-base" placeholder="e.g. 985141002345678" />
                          </div>
                          <div>
                            <label className="field-label">Notes</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-base resize-none" placeholder="Special characteristics, medical needs, etc." />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => { if (name.trim() && breed.trim() && age !== '' && colorMarkings.trim()) setStep('capture') }}
                  disabled={!name.trim() || !breed.trim() || age === '' || !colorMarkings.trim()}
                  className="btn-primary w-full py-3.5 rounded-xl mt-2"
                >
                  Continue to Photos
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Capture */}
          {step === 'capture' && (
            <motion.div key="capture" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <button onClick={() => setStep('details')} className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors mb-6">
                <ChevronLeft className="w-4 h-4" /> Back to details
              </button>

              {retakeIndex !== null && (
                <div className="flex items-center gap-2 p-3.5 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-xl text-[var(--color-error)] text-sm mb-5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Retake photo {retakeIndex + 1} — no nose was detected
                </div>
              )}

              <p className="text-[var(--color-muted)] text-sm text-center mb-5">
                {retakeIndex !== null ? `Capture a replacement for photo ${retakeIndex + 1}` : "Capture 1 or more clear photos of the dog's nose from 15–20 cm away."}
              </p>

              <div className="w-full aspect-[3/4] mb-6">
                <CameraCapture onCapture={handleCapture} remainingPhotos={retakeIndex !== null ? 1 : Infinity} />
              </div>

              {photos.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-4 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">{photos.length} photo{photos.length !== 1 ? 's' : ''} captured</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {photos.map((photo, idx) => (
                      <div key={idx} className={`relative rounded-xl overflow-hidden aspect-square border ${photo.status === 'error' ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'}`}>
                        <img src={URL.createObjectURL(photo.blob)} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                        {photo.status === 'error' && (
                          <div className="absolute inset-0 bg-[var(--color-error)]/20 flex items-end">
                            <button onClick={() => { setRetakeIndex(idx) }} className="w-full text-center text-[10px] text-white bg-[var(--color-error)] py-1">Retake</button>
                          </div>
                        )}
                        {photo.status !== 'error' && (
                          <button onClick={() => removePhoto(idx)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black transition-colors">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {photos.some(p => p.status !== 'error') && (
                    <button onClick={handleSubmit} className="btn-primary w-full py-3.5 rounded-xl mt-5">
                      Enroll {name} →
                    </button>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Uploading */}
          {step === 'uploading' && (
            <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-[var(--color-accent)] mb-5" />
              <h2 className="text-xl font-bold mb-2">{isWakingUp ? 'Waking up the engine...' : 'Enrolling nose print...'}</h2>
              <p className="text-[var(--color-muted)] text-sm max-w-xs">
                {isWakingUp ? 'The ML models are loading. This takes 30–60 seconds the first time.' : "We're extracting and storing the biometric signature. Hang tight."}
              </p>
            </motion.div>
          )}

          {/* Success */}
          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card p-10 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-[var(--color-success)]" />
              </div>
              <h2 className="text-2xl font-bold font-display mb-2">{enrolledDogName} is enrolled!</h2>
              <p className="text-[var(--color-muted)] text-sm mb-8">{enrolledDogName}&apos;s biometric signature is now securely stored in the registry.</p>
              <div className="space-y-3">
                <button onClick={resetForm} className="btn-ghost w-full py-3 rounded-xl">Enroll Another Dog</button>
                <Link href="/identify" className="btn-primary w-full justify-center py-3 rounded-xl">Try Identifying a Dog</Link>
                <Link href="/dashboard" className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors pt-1">Go to Dashboard →</Link>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {step === 'error' && error && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center pb-20">
              <NetworkError error={error} onRetry={handleSubmit} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
