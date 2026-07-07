'use client'
import React, { useState } from 'react'
import CameraCapture from '../components/CameraCapture'
import { ChevronLeft, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { API_URL } from '../../lib/api'

type EnrollStep = 'capture' | 'details' | 'uploading' | 'success' | 'error'

export default function EnrollPage() {
  const [step, setStep] = useState<EnrollStep>('capture')
  const [capturedBlobs, setCapturedBlobs] = useState<Blob[]>([])
  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleCapture = (blob: Blob) => {
    const newBlobs = [...capturedBlobs, blob]
    setCapturedBlobs(newBlobs)
    if (newBlobs.length === 3) {
      setStep('details')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (capturedBlobs.length < 3 || !name) return
    
    setStep('uploading')
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // 1. Create dog profile
      const dogRes = await fetch(`${API_URL}/dogs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, breed })
      })
      
      if (!dogRes.ok) throw new Error("Failed to register dog profile")
      const dogData = await dogRes.json()

      // 2. Upload nose print embedding for each blob
      for (let i = 0; i < capturedBlobs.length; i++) {
        const formData = new FormData()
        formData.append('file', capturedBlobs[i], `nose_${i}.jpg`)

        const enrollRes = await fetch(`${API_URL}/dogs/${dogData.id}/enroll`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData
        })

        if (!enrollRes.ok) {
          const errData = await enrollRes.json().catch(() => null)
          throw new Error(errData?.detail || `Failed to extract and store nose print (photo ${i+1})`)
        }
      }

      setStep('success')
    } catch (err: any) {
      setError(err.message)
      setStep('error')
    }
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center w-full z-10 relative">
      <div className="w-full max-w-md mb-8 flex items-center">
        <Link href="/" className="p-2 -ml-2 text-zinc-500 hover:text-zinc-300 transition">
          <ChevronLeft size={28} strokeWidth={1.5} />
        </Link>
        <h1 className="text-2xl font-bold ml-2 tracking-wide text-zinc-100">Enroll Identity</h1>
      </div>
      
      <AnimatePresence mode="wait">
        {step === 'capture' && (
          <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
            <p className="text-center text-zinc-400 mb-8 font-light">Capture a sharp, well-lit photo of the dog's nose to register their biometric signature. ({capturedBlobs.length + 1} of 3)</p>
            <CameraCapture onCapture={handleCapture} />
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
            <p className="text-zinc-500 text-sm mt-2">Encrypting embedding and saving profile...</p>
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

        {step === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 w-full max-w-md bg-red-500/10 border border-red-500/20 rounded-3xl p-8">
            <AlertTriangle size={48} className="mx-auto mb-4 text-red-500" strokeWidth={1.5} />
            <p className="text-zinc-300 mb-6 font-light">{error}</p>
            <button onClick={() => { setStep('capture'); setCapturedBlobs([]) }} className="py-3 px-8 bg-zinc-900 text-white rounded-full font-medium border border-white/10 hover:bg-zinc-800">
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
