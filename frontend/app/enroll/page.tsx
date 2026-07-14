'use client'
import React, { useState, useEffect } from 'react'
import CameraCapture from '../components/CameraCapture'
import { Loader2, AlertTriangle, CheckCircle2, Fingerprint, X, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { registerDog, enrollNose, ApiError } from '../../lib/api'
import AppHeader from '../components/AppHeader'
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
      // Replacing a specific photo that failed
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

      // 1. Create dog profile
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

      // 2. Upload each nose print sequentially
      for (let i = 0; i < photos.length; i++) {
        setUploadIndex(i + 1)
        setPhotos(prev => {
          const updated = [...prev]
          updated[i] = { ...updated[i], status: 'uploading' }
          return updated
        })

        try {
          await enrollNose(dogData.id, photos[i].blob, token)
          setPhotos(prev => {
            const updated = [...prev]
            updated[i] = { ...updated[i], status: 'success' }
            return updated
          })
        } catch (enrollErr: any) {
          const detail = enrollErr?.message || enrollErr?.detail || 'Unknown error'
          if (detail === 'no_nose_detected') {
            setPhotos(prev => {
              const updated = [...prev]
              updated[i] = { ...updated[i], status: 'error', error: `No nose found in photo ${i + 1} — retake it` }
              return updated
            })
            // Jump back to capture mode for retake
            setRetakeIndex(i)
            setStep('capture')
            return
          }
          throw enrollErr
        }
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
      <>
        <AppHeader />
        <div className="min-h-screen p-6 pt-24 flex items-center justify-center w-full z-10 relative text-zinc-500">
          Loading...
        </div>
      </>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen p-6 pt-24 flex flex-col items-center justify-center w-full z-10 relative">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 w-full max-w-md bg-zinc-900/50 backdrop-blur-md p-8 rounded-[2rem] border border-zinc-800 text-center shadow-2xl"
          >
            <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6 ring-1 ring-white/5">
              <Fingerprint className="text-zinc-400" size={32} />
            </div>
            <h2 className="text-2xl font-semibold text-zinc-100 mb-3">Sign in Required</h2>
            <p className="text-zinc-400 mb-10 font-light">Sign in to register a dog and securely store their biometric identity.</p>
            <Link 
              href="/login"
              className="w-full py-4 text-center bg-zinc-100 text-zinc-950 rounded-2xl font-semibold hover:bg-white transition"
            >
              Sign In to CANID
            </Link>
          </motion.div>
        </div>
      </>
    )
  }

  return (
    <>
      <AppHeader />
      <div className="min-h-screen p-6 pt-24 flex flex-col items-center w-full z-10 relative">
        <div className="w-full max-w-md mb-8 flex items-center justify-center">
          <h1 className="text-2xl font-bold tracking-wide text-zinc-100">Enroll Identity</h1>
        </div>
      
      <AnimatePresence mode="wait">
        {/* Step 1: Dog Details */}
        {step === 'details' && (
          <motion.div key="details" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <Link href="/" className="flex items-center text-zinc-400 hover:text-white transition">
                <ChevronLeft size={20} className="mr-1" />
                <span className="text-sm font-medium">Back to Home</span>
              </Link>
              <span className="text-xs text-zinc-500 font-medium px-2 py-1 bg-zinc-800/50 rounded-full">Step 1 of 2</span>
            </div>
            <div className="bg-zinc-900/50 backdrop-blur-md p-8 rounded-[2rem] border border-zinc-800 shadow-2xl">
              <h2 className="text-xl font-semibold text-white mb-6">Dog Information</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Dog&apos;s Name <span className="text-red-400">*</span></label>
                  <input 
                    type="text" 
                    required 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 transition" 
                    placeholder="e.g. Max" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Breed <span className="text-red-400">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={breed} 
                    onChange={e => setBreed(e.target.value)} 
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 transition" 
                    placeholder="e.g. Labrador Retriever" 
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Age (Years) <span className="text-red-400">*</span></label>
                    <input 
                      type="number" 
                      required
                      step="0.1"
                      min="0"
                      value={age} 
                      onChange={e => setAge(e.target.value === '' ? '' : Number(e.target.value))} 
                      className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 transition" 
                      placeholder="e.g. 1.5" 
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Sex <span className="text-red-400">*</span></label>
                    <select 
                      value={sex}
                      onChange={e => setSex(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 transition"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Color / Markings <span className="text-red-400">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={colorMarkings} 
                    onChange={e => setColorMarkings(e.target.value)} 
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 transition" 
                    placeholder="e.g. Golden with white chest patch" 
                  />
                </div>

                <div className="border-t border-zinc-800 pt-4 mt-2">
                  <button 
                    onClick={() => setShowOptional(!showOptional)}
                    className="w-full flex items-center justify-between text-sm text-zinc-400 hover:text-zinc-200 transition"
                  >
                    <span>Add owner details (optional)</span>
                    <span className="text-xl leading-none">{showOptional ? '−' : '+'}</span>
                  </button>
                  
                  {showOptional && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Owner Name</label>
                        <input 
                          type="text" 
                          value={ownerName} 
                          onChange={e => setOwnerName(e.target.value)} 
                          className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 transition" 
                        />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-zinc-400 mb-1">Phone</label>
                          <input 
                            type="tel" 
                            value={ownerPhone} 
                            onChange={e => setOwnerPhone(e.target.value)} 
                            className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 transition" 
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
                          <input 
                            type="email" 
                            value={ownerEmail} 
                            onChange={e => setOwnerEmail(e.target.value)} 
                            className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 transition" 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Microchip ID</label>
                        <input 
                          type="text" 
                          value={microchipId} 
                          onChange={e => setMicrochipId(e.target.value)} 
                          className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 transition" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Notes</label>
                        <textarea 
                          value={notes} 
                          onChange={e => setNotes(e.target.value)} 
                          rows={3}
                          className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 transition resize-none" 
                          placeholder="Special characteristics or identifying marks"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                <button 
                  onClick={() => { if (name.trim() && breed.trim() && age !== '' && colorMarkings.trim()) setStep('capture') }}
                  disabled={!name.trim() || !breed.trim() || age === '' || !colorMarkings.trim()}
                  className="w-full py-4 mt-4 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next — Capture Photos
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Capture Photos */}
        {step === 'capture' && (
          <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setStep('details')} className="flex items-center text-zinc-400 hover:text-white transition">
                <ChevronLeft size={20} className="mr-1" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <span className="text-xs text-zinc-500 font-medium px-2 py-1 bg-zinc-800/50 rounded-full">Step 2 of 2</span>
            </div>

            {retakeIndex !== null && (
              <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400 text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>Retake photo {retakeIndex + 1} — no nose was detected in it</span>
              </div>
            )}

            <p className="text-center text-zinc-400 mb-6 font-light">
              {retakeIndex !== null 
                ? `Capture a replacement for photo ${retakeIndex + 1}`
                : "Capture clear photos of the dog's nose (unlimited allowed)."
              }
            </p>
            <CameraCapture onCapture={handleCapture} remainingPhotos={retakeIndex !== null ? 1 : Infinity} />
            
            {photos.length > 0 && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-zinc-300 text-sm font-medium">Captured Photos</h3>
                  <span className="text-xs font-medium px-2 py-1 bg-zinc-800 text-zinc-400 rounded-full">{photos.length} Total</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-zinc-700 snap-center shadow-lg">
                      <img src={URL.createObjectURL(photo.blob)} className="w-full h-full object-cover" alt={`Photo ${idx + 1}`} />
                      {photo.status === 'error' && (
                        <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                          <AlertTriangle size={20} className="text-white" />
                        </div>
                      )}
                      {photo.status === 'success' && (
                        <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle2 size={20} className="text-emerald-400" />
                        </div>
                      )}
                      <button 
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-500 transition"
                      >
                        <X size={14} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleSubmit}
                  disabled={photos.length < 1}
                  className="w-full py-4 mt-2 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition shadow-[0_0_15px_rgba(37,99,235,0.3)] flex justify-center items-center gap-2 disabled:opacity-40"
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
            <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
            <h2 className="text-xl font-light text-zinc-200">
              {isWakingUp ? "Waking up the matching engine…" : "ENROLLING"}
            </h2>
            <p className="text-zinc-500 text-sm mt-2">
              {isWakingUp
                ? "(first request takes ~20s on free tier)"
                : uploadIndex > 0 
                  ? `Enrolling photo ${uploadIndex} of ${photos.length}…` 
                  : "Creating dog profile…"}
            </p>
            <div className="w-48 h-1 bg-zinc-800 rounded-full mt-6 overflow-hidden">
              <motion.div 
                className="h-full bg-blue-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(uploadIndex / photos.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </motion.div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-20 w-full max-w-md bg-zinc-900/50 backdrop-blur-md p-8 rounded-[2rem] border border-zinc-800 text-center">
            <CheckCircle2 className="text-emerald-500 mb-6" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">Enrolled Successfully ✓</h2>
            <p className="text-zinc-400 mb-10">{enrolledDogName}&apos;s biometric signature has been securely stored.</p>
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
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition"
              >
                Enroll Another Dog
              </button>
              <Link href="/identify" className="block w-full py-4 bg-zinc-800 text-white rounded-2xl font-semibold hover:bg-zinc-700 transition text-center">
                Go Identify
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
    </>
  )
}
