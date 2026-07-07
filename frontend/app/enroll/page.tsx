'use client'
import React, { useState, useEffect } from 'react'
import CameraCapture from '../components/CameraCapture'
import { Loader2, AlertTriangle, CheckCircle2, Fingerprint, X, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { API_URL, fetchWithErrorHandling, ApiError } from '../../lib/api'
import AppHeader from '../components/AppHeader'
import NetworkError from '../components/NetworkError'

type EnrollStep = 'capture' | 'details' | 'uploading' | 'success' | 'error'

export default function EnrollPage() {
  const [step, setStep] = useState<EnrollStep>('capture')
  const [capturedBlobs, setCapturedBlobs] = useState<Blob[]>([])
  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session)
      setIsAuthChecking(false)
    })
  }, [])

  const handleCapture = (blob: Blob) => {
    if (capturedBlobs.length < 5) {
      setCapturedBlobs([...capturedBlobs, blob])
    }
  }

  const removeBlob = (index: number) => {
    setCapturedBlobs(capturedBlobs.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (capturedBlobs.length < 1 || !name) return
    
    setStep('uploading')
    setUploadProgress(0)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw { type: 'server', message: "Session expired. Please sign in again." }
      }

      // 1. Create dog profile
      const dogRes = await fetchWithErrorHandling(`${API_URL}/dogs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, breed })
      })
      
      const dogData = await dogRes.json()

      // 2. Upload nose print embedding for each blob
      for (let i = 0; i < capturedBlobs.length; i++) {
        setUploadProgress(i + 1)
        const formData = new FormData()
        formData.append('file', capturedBlobs[i], `nose_${i}.jpg`)

        await fetchWithErrorHandling(`${API_URL}/dogs/${dogData.id}/enroll`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData
        })
      }

      setStep('success')
    } catch (err: any) {
      setError(err)
      setStep('error')
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
        {step === 'capture' && (
          <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <Link href="/" className="flex items-center text-zinc-400 hover:text-white transition">
                <ChevronLeft size={20} className="mr-1" />
                <span className="text-sm font-medium">Back to Home</span>
              </Link>
            </div>
            <p className="text-center text-zinc-400 mb-8 font-light">Capture clear photos of the dog's nose (up to 5).</p>
            <CameraCapture onCapture={handleCapture} />
            
            {capturedBlobs.length > 0 && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-zinc-300 text-sm font-medium">Captured Photos</h3>
                  <span className="text-xs font-medium px-2 py-1 bg-zinc-800 text-zinc-400 rounded-full">{capturedBlobs.length} / 5</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
                  {capturedBlobs.map((blob, idx) => (
                    <div key={idx} className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-zinc-700 snap-center shadow-lg">
                      <img src={URL.createObjectURL(blob)} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => removeBlob(idx)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-500 transition"
                      >
                        <X size={14} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setStep('details')}
                  className="w-full py-4 mt-2 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition shadow-[0_0_15px_rgba(37,99,235,0.3)] flex justify-center items-center gap-2"
                >
                  Continue to Details <CheckCircle2 size={18} />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 'details' && (
          <motion.div key="details" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
            <div className="bg-zinc-900/50 backdrop-blur-md p-8 rounded-[2rem] border border-zinc-800 shadow-2xl">
              <h2 className="text-xl font-semibold text-white mb-6">Subject Details</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Dog's Name</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 transition" placeholder="e.g. Max" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Breed (Optional)</label>
                  <input type="text" value={breed} onChange={e => setBreed(e.target.value)} className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 transition" placeholder="e.g. Golden Retriever" />
                </div>
                <button type="submit" className="w-full py-4 mt-4 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                  Register Biometrics
                </button>
                <button type="button" onClick={() => { setStep('capture'); setCapturedBlobs([]) }} className="w-full py-3 text-zinc-400 hover:text-white transition">
                  Retake Photos
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {step === 'uploading' && (
          <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-32 w-full max-w-md">
            <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
            <h2 className="text-xl font-light text-zinc-200">SECURING DATA</h2>
            <p className="text-zinc-500 text-sm mt-2">
              {uploadProgress > 0 
                ? `Uploading photo ${uploadProgress} of ${capturedBlobs.length}...` 
                : "Encrypting embedding and saving profile..."}
            </p>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-20 w-full max-w-md bg-zinc-900/50 backdrop-blur-md p-8 rounded-[2rem] border border-zinc-800 text-center">
            <CheckCircle2 className="text-emerald-500 mb-6" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">Enrollment Complete</h2>
            <p className="text-zinc-400 mb-10">The biometric signature has been successfully linked to {name}.</p>
            <Link href="/" className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-semibold hover:bg-zinc-700 transition">
              Return to Dashboard
            </Link>
          </motion.div>
        )}

        {step === 'error' && error && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex justify-center pb-20">
            <NetworkError 
              error={error} 
              onRetry={async () => {
                const fakeEvent = { preventDefault: () => {} } as React.FormEvent
                await handleSubmit(fakeEvent)
              }} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  )
}
