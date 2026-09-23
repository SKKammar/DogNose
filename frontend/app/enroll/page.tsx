'use client'
import React, { useState, useEffect } from 'react'
import CameraCapture from '../components/CameraCapture'
import { Loader2, AlertTriangle, CheckCircle2, X, ChevronLeft, ShieldCheck, Plus, PawPrint } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { registerDog, enrollNose, callWithWakeUp } from '../../lib/api'
import type { ApiError } from '../../lib/api'
import NetworkError from '../components/NetworkError'
import { toast } from 'sonner'

type EnrollStep = 'details' | 'capture' | 'uploading' | 'success' | 'error'

interface PhotoStatus {
  blob: Blob
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

const STEPS = ['DATA_ENTRY', 'BIOMETRIC_CAPTURE']

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
  const [behaviourNotes, setBehaviourNotes] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [vetName, setVetName] = useState('')
  const [vetPhone, setVetPhone] = useState('')
  const [showOwner, setShowOwner] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [enrolledDogName, setEnrolledDogName] = useState('')
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null)
  const [isWakingUp, setIsWakingUp] = useState(false)
  const [dogId, setDogId] = useState<string | null>(null)

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

      let id = dogId
      if (!id) {
        const dogData = await callWithWakeUp(() => registerDog({
          name, breed: breed || null, age: age === '' ? null : Number(age), sex,
          color_markings: colorMarkings || null, owner_name: ownerName || null,
          owner_phone: ownerPhone || null, owner_email: ownerEmail || null,
          microchip_id: microchipId || null, notes: notes || null,
          behaviour_notes: behaviourNotes || null,
          emergency_contact_name: emergencyName || null,
          emergency_contact_phone: emergencyPhone || null,
          vet_name: vetName || null,
          vet_phone: vetPhone || null,
        }, token), setIsWakingUp)
        id = dogData.id
        setDogId(id)
      }

      const enrollResult = await callWithWakeUp(() => enrollNose(id!, photos.map(p => p.blob), token), setIsWakingUp)

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
    setBehaviourNotes(''); setEmergencyName(''); setEmergencyPhone(''); setVetName(''); setVetPhone('')
    setDogId(null)
  }

  if (isAuthChecking) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent-blue" /></div>
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface border border-border p-10 max-w-sm w-full text-center shadow-brutalist">
          <div className="w-14 h-14 bg-background border border-border flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-6 h-6 text-accent-blue" />
          </div>
          <h2 className="text-xl font-display font-bold mb-2 uppercase tracking-wide">Authentication Required</h2>
          <p className="text-text-muted font-mono text-xs mb-8">SYS_ERR: UNAUTHORIZED_ACCESS</p>
          <Link href="/login" className="btn-primary w-full justify-center py-3 text-sm tracking-widest uppercase">AUTHENTICATE</Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl">

        {/* Page Header */}
        <div className="mb-10 border-b border-border pb-6 flex flex-col items-center text-center">
          <h1 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-tight text-text-primary mb-2">Subject Registration</h1>
          <p className="font-mono text-xs text-text-muted uppercase tracking-widest">Initialize New Biometric Profile</p>
        </div>

        {/* Step Indicator */}
        {(step === 'details' || step === 'capture') && (
          <div className="flex items-center justify-center gap-4 mb-10 font-mono text-xs uppercase tracking-widest">
            {STEPS.map((s, i) => {
              const active = (step === 'details' && i === 0) || (step === 'capture' && i === 1)
              const done = step === 'capture' && i === 0
              return (
                <React.Fragment key={s}>
                  <div className={`flex items-center gap-2 ${active ? 'text-accent-blue font-bold' : done ? 'text-accent-green' : 'text-text-muted'}`}>
                    <span className="opacity-50">[{i + 1}]</span>
                    <span>{s}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className="text-text-muted mx-2">/</div>}
                </React.Fragment>
              )
            })}
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* STEP 1: Details */}
          {step === 'details' && (
            <motion.div key="details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-surface border border-border p-8 shadow-brutalist space-y-6">
                <h2 className="text-sm font-mono font-bold text-text-muted border-b border-border pb-4 uppercase tracking-widest">Subject Metadata</h2>

                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="field-label">Primary Identifier (Name) *</label>
                    <input type="text" required value={name} onChange={e => setName(e.target.value)} className="input-base" placeholder="e.g. Max" />
                  </div>
                  <div>
                    <label className="field-label">Morphological Class (Breed) *</label>
                    <input type="text" required value={breed} onChange={e => setBreed(e.target.value)} className="input-base" placeholder="e.g. Labrador Retriever" />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="field-label">Age (Years) *</label>
                      <input type="number" required step="0.1" min="0" value={age} onChange={e => setAge(e.target.value === '' ? '' : Number(e.target.value))} className="input-base" placeholder="e.g. 2" />
                    </div>
                    <div>
                      <label className="field-label">Biological Sex *</label>
                      <select value={sex} onChange={e => setSex(e.target.value)} className="input-base appearance-none">
                        <option value="Male">MALE</option>
                        <option value="Female">FEMALE</option>
                        <option value="Unknown">UNKNOWN</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Phenotype (Color/Markings) *</label>
                    <input type="text" required value={colorMarkings} onChange={e => setColorMarkings(e.target.value)} className="input-base" placeholder="e.g. Fawn with black mask" />
                  </div>
                </div>

                {/* Owner details toggle */}
                <div className="border-t border-border pt-6 mt-4">
                  <button onClick={() => setShowOwner(!showOwner)} className="w-full flex items-center justify-between text-xs font-mono font-bold uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors">
                    <span>Associated Contact (Optional)</span>
                    <Plus className={`w-4 h-4 transition-transform ${showOwner ? 'rotate-45 text-accent-red' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showOwner && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="space-y-5 mt-6 border-l border-border pl-4">
                          <div>
                            <label className="field-label">Full Name</label>
                            <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} className="input-base" placeholder="e.g. Jane Doe" />
                          </div>
                          <div className="grid grid-cols-2 gap-5">
                            <div>
                              <label className="field-label">Phone Coordinates</label>
                              <input type="tel" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} className="input-base" placeholder="+1 555-1234" />
                            </div>
                            <div>
                              <label className="field-label">Email Coordinates</label>
                              <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} className="input-base" placeholder="jane@example.com" />
                            </div>
                          </div>
                          <div>
                            <label className="field-label">External Hardware ID (Microchip)</label>
                            <input type="text" value={microchipId} onChange={e => setMicrochipId(e.target.value)} className="input-base" placeholder="e.g. 985141002345678" />
                          </div>
                          <div>
                            <label className="field-label">Supplementary Data</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-base resize-none" placeholder="Medical conditions, distinct behavior..." />
                          </div>
                          <div>
                            <label className="field-label">Behaviour Notes (shown to finders)</label>
                            <textarea
                              value={behaviourNotes}
                              onChange={e => setBehaviourNotes(e.target.value)}
                              rows={2}
                              className="input-base resize-none"
                              placeholder="e.g. Friendly, but nervous around loud noises"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="field-label">Emergency Name</label>
                              <input
                                type="text"
                                value={emergencyName}
                                onChange={e => setEmergencyName(e.target.value)}
                                className="input-base"
                              />
                            </div>
                            <div>
                              <label className="field-label">Emergency Phone</label>
                              <input
                                type="tel"
                                value={emergencyPhone}
                                onChange={e => setEmergencyPhone(e.target.value)}
                                className="input-base"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="field-label">Vet Name</label>
                              <input
                                type="text"
                                value={vetName}
                                onChange={e => setVetName(e.target.value)}
                                className="input-base"
                              />
                            </div>
                            <div>
                              <label className="field-label">Vet Phone</label>
                              <input
                                type="tel"
                                value={vetPhone}
                                onChange={e => setVetPhone(e.target.value)}
                                className="input-base"
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="pt-4 border-t border-border">
                  <button
                    onClick={() => { if (name.trim() && breed.trim() && age !== '' && colorMarkings.trim()) setStep('capture') }}
                    disabled={!name.trim() || !breed.trim() || age === '' || !colorMarkings.trim()}
                    className="btn-primary w-full py-4 text-sm tracking-widest uppercase disabled:bg-surface disabled:border-border disabled:text-text-muted"
                  >
                    PROCEED TO CAPTURE_PHASE
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Capture */}
          {step === 'capture' && (
            <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex justify-between items-center mb-6">
                <button onClick={() => setStep('details')} className="font-mono text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-2 uppercase tracking-widest">
                  <ChevronLeft className="w-3 h-3" /> ABORT CAPTURE
                </button>
              </div>

              {retakeIndex !== null && (
                <div className="flex items-center gap-3 p-4 bg-background border border-accent-red text-accent-red text-sm mb-6 font-mono uppercase tracking-widest">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  ERR: TGT_NOT_FOUND (IDX {retakeIndex + 1}) — RECAPTURE REQUIRED
                </div>
              )}

              <div className="w-full relative mb-6">
                <CameraCapture onCapture={handleCapture} remainingPhotos={retakeIndex !== null ? 1 : Infinity} />
              </div>

              {photos.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-surface border border-border p-6 shadow-brutalist mb-6">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                    <h3 className="font-mono text-xs font-bold text-text-primary uppercase tracking-widest">ACQUIRED BUFFERS: {photos.length}</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {photos.map((photo, idx) => (
                      <div key={idx} className={`relative border ${photo.status === 'error' ? 'border-accent-red' : 'border-border'} bg-background aspect-square`}>
                        <img src={URL.createObjectURL(photo.blob)} alt={`Buffer ${idx}`} className="w-full h-full object-cover grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all" />
                        {photo.status === 'error' && (
                          <div className="absolute inset-x-0 bottom-0 flex">
                            <button onClick={() => { setRetakeIndex(idx) }} className="w-full bg-accent-red text-background font-mono text-[10px] py-1 font-bold">RECAPTURE</button>
                          </div>
                        )}
                        {photo.status !== 'error' && (
                          <button onClick={() => removePhoto(idx)} className="absolute top-1 right-1 w-6 h-6 bg-background border border-border flex items-center justify-center text-text-muted hover:text-accent-red hover:border-accent-red transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {photos.some(p => p.status !== 'error') && (
                    <button onClick={handleSubmit} className="btn-primary w-full py-4 mt-8 text-sm tracking-widest uppercase">
                      COMMIT TO REGISTRY
                    </button>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Uploading */}
          {step === 'uploading' && (
            <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 text-center bg-surface border border-border shadow-brutalist">
              <Loader2 className="w-10 h-10 animate-spin text-accent-blue mb-6" />
              <h2 className="text-xl font-display font-bold uppercase tracking-widest text-text-primary mb-2">
                {isWakingUp ? 'SYS_BOOT_SEQUENCE' : 'UPLOADING_VECTORS'}
              </h2>
              <p className="font-mono text-text-muted text-xs uppercase tracking-widest max-w-sm">
                {isWakingUp ? 'Neural engine initializing (30s delay expected)' : 'Committing biometric data to central registry'}
              </p>
            </motion.div>
          )}

          {/* Success */}
          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-surface border border-accent-green p-12 text-center shadow-brutalist">
              <div className="w-16 h-16 bg-background border border-accent-green flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 className="w-8 h-8 text-accent-green" />
              </div>
              <h2 className="text-3xl font-display font-bold uppercase tracking-tight text-text-primary mb-2">Registration Complete</h2>
              <p className="font-mono text-text-muted text-xs uppercase tracking-widest mb-10">SUBJECT: {enrolledDogName} — DATA WRITTEN SECURELY</p>
              
              <div className="flex flex-col gap-4 border-t border-border pt-8">
                <button onClick={resetForm} className="btn-ghost w-full py-3 text-sm tracking-widest uppercase">REGISTER NEW SUBJECT</button>
                <Link href="/identify" className="btn-primary w-full py-3 justify-center text-sm tracking-widest uppercase">TEST IDENTIFICATION</Link>
                <Link href="/dashboard" className="mt-4 font-mono text-xs text-text-muted hover:text-text-primary uppercase tracking-widest">RETURN TO SYS_DASHBOARD</Link>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {step === 'error' && error && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
              <NetworkError error={error} onRetry={handleSubmit} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
