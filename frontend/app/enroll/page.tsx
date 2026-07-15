'use client'
import React, { useState, useEffect } from 'react'
import CameraCapture from '../components/CameraCapture'
import { Loader2, AlertTriangle, CheckCircle2, Fingerprint, X, ChevronLeft, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { registerDog, enrollNose, ApiError } from '../../lib/api'
import NetworkError from '../components/NetworkError'

type EnrollStep = 'details' | 'capture' | 'uploading' | 'success' | 'error'

interface PhotoStatus {
  blob: Blob
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

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
  const [showOptional, setShowOptional] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [uploadIndex, setUploadIndex] = useState(0)
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
      const newPhotos = newBlobs.map(b => ({ blob: b, status: 'pending' as const }))
      setPhotos(prev => [...prev, ...newPhotos])
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (photos.length < 1 || !name) return

    setStep('uploading')
    setUploadIndex(0)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw { type: 'server', message: "Session expired. Please sign in again." }
      }
      const token = session.access_token

      const wakeTimer = setTimeout(() => setIsWakingUp(true), 3000)

      const dogData = await registerDog({
        name,
        breed: breed || null,
        age: age === '' ? null : Number(age),
        sex,
        color_markings: colorMarkings || null,
        owner_name: ownerName || null,
        owner_phone: ownerPhone || null,
        owner_email: ownerEmail || null,
        microchip_id: microchipId || null,
        notes: notes || null
      }, token)

      const blobs = photos.map(p => p.blob)
      try {
        await enrollNose(dogData.id, blobs, token)
        setPhotos(prev => prev.map(p => ({ ...p, status: 'success' })))
      } catch (enrollErr: any) {
        const detail = enrollErr?.message || enrollErr?.detail || 'Unknown error'
        if (detail.includes('No valid nose prints detected')) {
           setPhotos(prev => prev.map(p => ({ ...p, status: 'error', error: 'No nose found in any photo — retake' })))
           setStep('capture')
           return
        }
        throw enrollErr
      }

      setEnrolledDogName(name)
      setStep('success')
    } catch (err: any) {
      setError(err)
      setStep('error')
    } finally {
      setIsWakingUp(false)
    }
  }

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center w-full bg-[var(--color-bg)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center w-full z-10 relative bg-[var(--color-bg)]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] p-8 rounded-3xl text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-full flex items-center justify-center mb-6">
            <ShieldCheck className="text-[var(--color-accent)] w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold font-display text-[var(--color-text)] mb-3">Sign in Required</h2>
          <p className="text-[var(--color-muted)] mb-10 text-sm">You need an account to register a dog and manage their biometric identity securely.</p>
          <Link 
            href="/login"
            className="w-full py-4 text-center bg-[var(--color-text)] text-[var(--color-bg)] rounded-xl font-bold hover:bg-white transition"
          >
            Sign In to CANID
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 pt-8 flex flex-col items-center w-full z-10 relative">
      <div className="w-full max-w-md mb-8 flex items-center justify-center">
        <h1 className="text-2xl font-bold font-display tracking-wide text-[var(--color-text)]">Register Dog</h1>
      </div>
    
      <AnimatePresence mode="wait">
        {/* Step 1: Dog Details */}
        {step === 'details' && (
          <motion.div key="details" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <Link href="/" className="flex items-center text-[var(--color-muted)] hover:text-[var(--color-text)] transition">
                <ChevronLeft size={20} className="mr-1" />
                <span className="text-sm font-medium">Back to Home</span>
              </Link>
              <span className="text-xs text-[var(--color-muted)] font-mono px-3 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full">Step 1 of 2</span>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-3xl shadow-2xl">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">Dog Information</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Dog's Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition placeholder:text-zinc-600" 
                    placeholder="e.g. Max" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Breed *</label>
                  <input 
                    type="text" 
                    required
                    value={breed} 
                    onChange={e => setBreed(e.target.value)} 
                    className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition placeholder:text-zinc-600" 
                    placeholder="e.g. Labrador Retriever" 
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Age (Years) *</label>
                    <input 
                      type="number" 
                      required
                      step="0.1"
                      min="0"
                      value={age} 
                      onChange={e => setAge(e.target.value === '' ? '' : Number(e.target.value))} 
                      className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition placeholder:text-zinc-600" 
                      placeholder="e.g. 1.5" 
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Sex *</label>
                    <select 
                      value={sex}
                      onChange={e => setSex(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition appearance-none"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Color / Markings *</label>
                  <input 
                    type="text" 
                    required
                    value={colorMarkings} 
                    onChange={e => setColorMarkings(e.target.value)} 
                    className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition placeholder:text-zinc-600" 
                    placeholder="e.g. Golden with white chest patch" 
                  />
                </div>

                <div className="border-t border-[var(--color-border)] pt-4 mt-2">
                  <button 
                    onClick={() => setShowOptional(!showOptional)}
                    className="w-full flex items-center justify-between text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition"
                  >
                    <span className="font-medium">Add owner details (optional)</span>
                    <span className="text-xl leading-none">{showOptional ? '−' : '+'}</span>
                  </button>
                  
                  {showOptional && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-4 mt-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Owner Name</label>
                        <input 
                          type="text" 
                          value={ownerName} 
                          onChange={e => setOwnerName(e.target.value)} 
                          className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition" 
                        />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Phone</label>
                          <input 
                            type="tel" 
                            value={ownerPhone} 
                            onChange={e => setOwnerPhone(e.target.value)} 
                            className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition" 
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Email</label>
                          <input 
                            type="email" 
                            value={ownerEmail} 
                            onChange={e => setOwnerEmail(e.target.value)} 
                            className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition" 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Microchip ID</label>
                        <input 
                          type="text" 
                          value={microchipId} 
                          onChange={e => setMicrochipId(e.target.value)} 
                          className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Notes</label>
                        <textarea 
                          value={notes} 
                          onChange={e => setNotes(e.target.value)} 
                          rows={3}
                          className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition resize-none" 
                          placeholder="Special characteristics or identifying marks"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                <button 
                  onClick={() => { if (name.trim() && breed.trim() && age !== '' && colorMarkings.trim()) setStep('capture') }}
                  disabled={!name.trim() || !breed.trim() || age === '' || !colorMarkings.trim()}
                  className="w-full py-4 mt-4 bg-[var(--color-accent)] text-white rounded-xl font-bold hover:shadow-[0_0_20px_rgba(79,156,249,0.3)] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue to Photos
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Capture Photos */}
        {step === 'capture' && (
          <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setStep('details')} className="flex items-center text-[var(--color-muted)] hover:text-[var(--color-text)] transition">
                <ChevronLeft size={20} className="mr-1" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <span className="text-xs text-[var(--color-muted)] font-mono px-3 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full">Step 2 of 2</span>
            </div>

            {retakeIndex !== null && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>Retake photo {retakeIndex + 1} — no nose was detected in it</span>
              </div>
            )}

            <p className="text-center text-[var(--color-muted)] mb-6 text-sm">
              {retakeIndex !== null 
                ? `Capture a replacement for photo ${retakeIndex + 1}`
                : "Capture 1 or more clear photos of the dog's nose."
              }
            </p>
            
            <CameraCapture onCapture={handleCapture} remainingPhotos={retakeIndex !== null ? 1 : Infinity} />
            
            {photos.length > 0 && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-3xl">
                <div className="flex justify-between items-center mb-4 px-2">
                  <h3 className="text-[var(--color-text)] text-sm font-semibold">Captured Photos</h3>
                  <span className="text-xs font-mono px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)] rounded-full">{photos.length} Total</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="relative w-20 h-20 shrink-0 rounded-2xl overflow-hidden border border-[var(--color-border)] snap-center">
                      <img src={URL.createObjectURL(photo.blob)} className="w-full h-full object-cover" alt={`Photo ${idx + 1}`} />
                      {photo.status === 'error' && (
                        <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center backdrop-blur-[1px]">
                          <AlertTriangle size={20} className="text-white" />
                        </div>
                      )}
                      {photo.status === 'success' && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-[1px]">
                          <CheckCircle2 size={20} className="text-green-400" />
                        </div>
                      )}
                      <button 
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-600 transition shadow-sm"
                      >
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleSubmit}
                  disabled={photos.length < 1}
                  className="w-full py-4 mt-2 bg-[var(--color-accent)] text-white rounded-xl font-bold hover:shadow-[0_0_20px_rgba(79,156,249,0.3)] transition flex justify-center items-center gap-2 disabled:opacity-40"
                >
                  Submit {photos.length} Photo{photos.length !== 1 ? 's' : ''} <CheckCircle2 size={18} />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Step 3: Uploading */}
        {step === 'uploading' && (
          <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-32 w-full max-w-md">
            <Loader2 className="animate-spin text-[var(--color-accent)] mb-6" size={48} />
            <h2 className="text-xl font-semibold font-display text-[var(--color-text)]">
              {isWakingUp ? "Waking up system…" : "Enrolling Dog"}
            </h2>
            <p className="text-[var(--color-muted)] text-sm mt-2">
              {isWakingUp
                ? "(first request takes ~20s on free tier)"
                : uploadIndex > 0 
                  ? `Processing photo ${uploadIndex} of ${photos.length}…` 
                  : "Creating biometric profile…"}
            </p>
            <div className="w-64 h-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-full mt-8 overflow-hidden">
              <motion.div 
                className="h-full bg-[var(--color-accent)] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(uploadIndex / photos.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </motion.div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-20 w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] p-8 rounded-3xl text-center shadow-2xl">
            <div className="w-24 h-24 bg-[var(--color-bg)] border border-[var(--color-success)] rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
              <CheckCircle2 className="text-[var(--color-success)] w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold font-display text-[var(--color-text)] mb-2">Success!</h2>
            <p className="text-[var(--color-muted)] mb-10 text-sm">{enrolledDogName}'s biometric signature has been securely stored in the registry.</p>
            <div className="w-full space-y-3">
              <button
                onClick={() => {
                  setStep('details')
                  setName('')
                  setBreed('')
                  setAge('')
                  setSex('Unknown')
                  setColorMarkings('')
                  setOwnerName('')
                  setOwnerPhone('')
                  setOwnerEmail('')
                  setMicrochipId('')
                  setNotes('')
                  setShowOptional(false)
                  setPhotos([])
                  setEnrolledDogName('')
                }}
                className="w-full py-4 bg-transparent border border-[var(--color-border)] text-[var(--color-text)] rounded-xl font-semibold hover:bg-[var(--color-bg)] transition"
              >
                Enroll Another Dog
              </button>
              <Link href="/identify" className="block w-full py-4 bg-[var(--color-accent)] text-white rounded-xl font-bold hover:shadow-[0_0_20px_rgba(79,156,249,0.3)] transition text-center">
                Identify a Dog
              </Link>
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {step === 'error' && error && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex justify-center pb-20">
            <NetworkError 
              error={error} 
              onRetry={async () => {
                await handleSubmit()
              }} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
