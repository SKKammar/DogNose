'use client'
import React, { useState } from 'react'
import CameraCapture from '../components/CameraCapture'
import { Loader2, AlertTriangle, Fingerprint, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { API_URL } from '../../lib/api'

type IdentifyStatus = 'idle' | 'processing' | 'match' | 'no_match' | 'error'

interface MatchResult {
  confidence: number;
  candidates: { dog_id: string; confidence: number; name: string; breed?: string }[];
}

export default function IdentifyPage() {
  const [status, setStatus] = useState<IdentifyStatus>('idle')
  const [result, setResult] = useState<MatchResult | null>(null)
  const [error, setError] = useState<string>('')
  const [isWaking, setIsWaking] = useState(false)

  const router = useRouter()

  const handleCapture = async (blob: Blob) => {
    setStatus('processing')
    setIsWaking(false)
    const wakeTimer = setTimeout(() => setIsWaking(true), 3000)

    try {
      const formData = new FormData()
      formData.append('file', blob, 'nose.jpg')

      const res = await fetch(`${API_URL}/dogs/identify`, {
        method: 'POST',
        body: formData
      })
      
      clearTimeout(wakeTimer)
      
      if (!res.ok) {
        if (res.status === 503) {
          throw new Error("Server cold-start: waking up the matching engine, one moment...")
        }
        
        // Attempt to parse explicit validation errors (e.g. from the detector)
        const errorData = await res.json().catch(() => null)
        if (errorData && errorData.detail) {
          throw new Error(errorData.detail)
        }
        throw new Error('Failed to identify')
      }
      
      const data = await res.json()
      
      if (data.status === 'match') {
        setResult(data)
        setStatus('match')
      } else {
        setStatus('no_match')
      }
    } catch (err: any) {
      clearTimeout(wakeTimer)
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center w-full z-10 relative">
      <div className="w-full max-w-md mb-8 flex items-center">
        <Link href="/" className="p-2 -ml-2 text-zinc-500 hover:text-zinc-300 transition">
          <ChevronLeft size={28} strokeWidth={1.5} />
        </Link>
        <h1 className="text-2xl font-bold ml-2 tracking-wide text-zinc-100">Identify</h1>
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div 
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full"
          >
            <p className="text-center text-zinc-400 mb-8 font-light">Align the nose securely within the targeting frame.</p>
            <CameraCapture onCapture={handleCapture} />
          </motion.div>
        )}

        {status === 'processing' && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-32 w-full max-w-md"
          >
            {/* Cinematic processing spinner */}
            <div className="relative w-32 h-32 mb-8">
              <div className="absolute inset-0 border-t-2 border-blue-500 rounded-full animate-spin"></div>
              <div className="absolute inset-2 border-r-2 border-emerald-500 rounded-full animate-[spin_2s_reverse_infinite]"></div>
              <div className="absolute inset-0 flex items-center justify-center text-blue-400">
                <Fingerprint size={48} strokeWidth={1} />
              </div>
            </div>
            <h2 className="text-2xl font-light tracking-widest text-zinc-200 mb-2">ANALYZING</h2>
            <p className="text-zinc-500 text-sm tracking-wide text-center">
              {isWaking ? "Waking up the matching engine, this can take up to 30 seconds..." : "Extracting biometric embedding..."}
            </p>
          </motion.div>
        )}

        {status === 'no_match' && (
          <motion.div 
            key="no_match"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 w-full max-w-md bg-zinc-900/50 backdrop-blur-md p-8 rounded-[2rem] border border-zinc-800 text-center shadow-2xl"
          >
            <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6 ring-1 ring-white/5">
              <AlertTriangle className="text-zinc-400" size={32} />
            </div>
            <h2 className="text-2xl font-semibold text-zinc-100 mb-3">Identity Unknown</h2>
            <p className="text-zinc-400 mb-10 font-light">The extracted nose print signature does not match any registered profiles.</p>
            <button 
              onClick={() => setStatus('idle')}
              className="w-full py-4 bg-zinc-100 text-zinc-950 rounded-2xl font-semibold hover:bg-white transition"
            >
              Scan Again
            </button>
          </motion.div>
        )}

        {status === 'match' && result && (
          <motion.div 
            key="match"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center py-6 w-full max-w-md"
          >
            <div className="relative mb-6">
              <div className="w-28 h-28 bg-emerald-500/10 rounded-full flex items-center justify-center ring-1 ring-emerald-500/30">
                <Fingerprint className="text-emerald-400" size={56} strokeWidth={1} />
              </div>
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }}
                className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-zinc-950"
              >
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </motion.div>
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Match Confirmed</h2>
            
            {/* Animated Confidence Meter */}
            <div className="w-full bg-zinc-900 h-2 rounded-full mb-2 overflow-hidden border border-zinc-800">
              <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${result.confidence * 100}%` }} 
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-emerald-500"
              />
            </div>
            <p className="text-emerald-400 font-medium tracking-wide mb-10 text-sm">{Math.round(result.confidence * 100)}% Match Confidence</p>
            
            <div className="w-full bg-zinc-900/50 backdrop-blur-sm rounded-[2rem] border border-zinc-800 overflow-hidden mb-8">
              <div className="p-5 border-b border-zinc-800/50 bg-white/5">
                <h3 className="font-medium text-zinc-300 text-sm tracking-wider uppercase">Database Results</h3>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {result.candidates.map((cand, i) => (
                  <div key={cand.dog_id} className="p-5 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-zinc-200 text-lg">{cand.name}</span>
                        {cand.breed && <span className="block text-zinc-500 text-sm">{cand.breed}</span>}
                      </div>
                      <span className={`text-sm px-3 py-1 rounded-full font-medium ${i === 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'}`}>
                        {(cand.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetch(`${API_URL}/dogs/${cand.dog_id}/notify-owner`, { method: 'POST' });
                          if (res.ok) alert("Owner has been notified!");
                          else alert("Failed to notify owner.");
                        } catch(e) {
                          alert("Error notifying owner.");
                        }
                      }}
                      className="w-full py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg text-sm font-medium transition"
                    >
                      Notify Owner
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => setStatus('idle')}
              className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-medium hover:bg-zinc-700 transition border border-white/5"
            >
              Close Profile
            </button>
          </motion.div>
        )}
        
        {status === 'error' && (
          <motion.div 
            key="error"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-20 w-full max-w-md bg-red-500/10 border border-red-500/20 rounded-3xl p-8"
          >
            <AlertTriangle size={48} className="mx-auto mb-4 text-red-500" strokeWidth={1.5} />
            <p className="text-zinc-300 mb-6 font-light leading-relaxed">{error}</p>
            <button 
              onClick={() => setStatus('idle')} 
              className="py-3 px-8 bg-zinc-900 text-white rounded-full font-medium hover:bg-zinc-800 border border-white/10"
            >
              Reset System
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
