'use client'
import React, { useState, useEffect, useRef } from 'react'
import CameraCapture from '../components/CameraCapture'
import { Loader2, Fingerprint, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { identifyNose, ApiError } from '../../lib/api'
import AppHeader from '../components/AppHeader'
import NetworkError from '../components/NetworkError'

type IdentifyStatus = 'idle' | 'processing' | 'match' | 'no_match' | 'error'

interface MatchCandidate {
  dog_id: string
  name: string
  breed?: string
  similarity: number
  is_match: boolean
}

interface IdentifyResult {
  result: string
  matches: MatchCandidate[]
}

const PROCESSING_STEPS = [
  { icon: '🔍', label: 'Detecting nose...' },
  { icon: '🧬', label: 'Extracting features...' },
  { icon: '🔎', label: 'Matching against database...' },
]

export default function IdentifyPage() {
  const [status, setStatus] = useState<IdentifyStatus>('idle')
  const [result, setResult] = useState<IdentifyResult | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [processingStep, setProcessingStep] = useState(0)
  const [isWaking, setIsWaking] = useState(false)
  const wakeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Animated processing step sequence
  useEffect(() => {
    if (status === 'processing') {
      setProcessingStep(0)
      let step = 0
      stepTimerRef.current = setInterval(() => {
        step++
        if (step < PROCESSING_STEPS.length) {
          setProcessingStep(step)
        }
      }, 1000)

      wakeTimerRef.current = setTimeout(() => setIsWaking(true), 8000)
    }
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current)
      if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current)
    }
  }, [status])

  const handleCapture = async (blobData: Blob | Blob[]) => {
    const blob = Array.isArray(blobData) ? blobData[0] : blobData
    setStatus('processing')
    setIsWaking(false)

    try {
      const data = await identifyNose(blob)

      if (data.result === 'match' && data.matches?.length > 0) {
        setResult(data)
        setStatus('match')
      } else {
        setStatus('no_match')
      }
    } catch (err: any) {
      setError(err)
      setStatus('error')
    }
  }

  const getConfidenceColor = (similarity: number): string => {
    if (similarity >= 0.85) return 'bg-emerald-500'
    if (similarity >= 0.75) return 'bg-yellow-500'
    return 'bg-zinc-600'
  }

  const getConfidenceTextColor = (similarity: number): string => {
    if (similarity >= 0.85) return 'text-emerald-400'
    if (similarity >= 0.75) return 'text-yellow-400'
    return 'text-zinc-400'
  }

  return (
    <>
      <AppHeader />
      <div className="min-h-screen p-6 pt-24 flex flex-col items-center w-full z-10 relative">
        <div className="w-full max-w-md mb-8 flex items-center justify-center">
          <h1 className="text-2xl font-bold tracking-wide text-zinc-100">Identify</h1>
        </div>

      <AnimatePresence mode="wait">
        {/* Idle — Camera */}
        {status === 'idle' && (
          <motion.div 
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md"
          >
            <div className="flex justify-between items-center mb-6">
              <Link href="/" className="flex items-center text-zinc-400 hover:text-white transition">
                <ChevronLeft size={20} className="mr-1" />
                <span className="text-sm font-medium">Back to Home</span>
              </Link>
            </div>
            <p className="text-center text-zinc-400 mb-8 font-light">Point at the dog&apos;s nose and capture a clear photo.</p>
            <CameraCapture onCapture={handleCapture} />
          </motion.div>
        )}

        {/* Processing — Animated 3-step sequence */}
        {status === 'processing' && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 w-full max-w-md"
          >
            {/* Cinematic spinner */}
            <div className="relative w-32 h-32 mb-10">
              <div className="absolute inset-0 border-t-2 border-blue-500 rounded-full animate-spin"></div>
              <div className="absolute inset-2 border-r-2 border-emerald-500 rounded-full animate-[spin_2s_reverse_infinite]"></div>
              <div className="absolute inset-0 flex items-center justify-center text-blue-400">
                <Fingerprint size={48} strokeWidth={1} />
              </div>
            </div>

            {/* Animated step labels */}
            {!isWaking ? (
              <div className="space-y-4 w-full max-w-xs">
                {PROCESSING_STEPS.map((pStep, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ 
                      opacity: i <= processingStep ? 1 : 0.3,
                      x: 0,
                    }}
                    transition={{ delay: i * 0.2, duration: 0.3 }}
                    className={`flex items-center gap-3 text-sm transition-colors duration-300 ${
                      i === processingStep ? 'text-zinc-100' : i < processingStep ? 'text-zinc-500' : 'text-zinc-700'
                    }`}
                  >
                    <span className="text-lg">{pStep.icon}</span>
                    <span className="font-medium">{pStep.label}</span>
                    {i < processingStep && (
                      <motion.span 
                        initial={{ scale: 0 }} 
                        animate={{ scale: 1 }} 
                        className="ml-auto text-emerald-400 text-xs"
                      >
                        ✓
                      </motion.span>
                    )}
                    {i === processingStep && (
                      <Loader2 className="ml-auto animate-spin text-blue-400" size={14} />
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <h2 className="text-lg font-light text-zinc-200 mb-2">Waking up the matching engine…</h2>
                <p className="text-zinc-500 text-sm">(first request takes ~20s on free tier)</p>
              </div>
            )}
          </motion.div>
        )}

        {/* No Match */}
        {status === 'no_match' && (
          <motion.div 
            key="no_match"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 w-full max-w-md bg-zinc-900/50 backdrop-blur-md p-8 rounded-[2rem] border border-zinc-800 text-center shadow-2xl"
          >
            <div className="text-6xl mb-6">🐾</div>
            <h2 className="text-2xl font-semibold text-zinc-100 mb-3">Dog Not Enrolled</h2>
            <p className="text-zinc-400 mb-10 font-light">This nose print doesn&apos;t match any dogs in the database.</p>
            <div className="w-full space-y-3">
              <button 
                onClick={() => setStatus('idle')}
                className="w-full py-4 bg-zinc-100 text-zinc-950 rounded-2xl font-semibold hover:bg-white transition"
              >
                Try Another Photo
              </button>
              <Link href="/enroll" className="block w-full py-4 bg-zinc-800 text-white rounded-2xl font-medium hover:bg-zinc-700 transition text-center">
                Enroll This Dog
              </Link>
            </div>
          </motion.div>
        )}

        {/* Match Results */}
        {status === 'match' && result && (
          <motion.div 
            key="match"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center py-6 w-full max-w-md"
          >
            {/* Header */}
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
            
            <h2 className="text-3xl font-bold text-white mb-8 tracking-tight">Match Found</h2>

            {/* Top-3 Match Cards */}
            <div className="w-full space-y-4 mb-8">
              {result.matches.map((match, i) => (
                <motion.div 
                  key={match.dog_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className={`bg-zinc-900/50 backdrop-blur-sm rounded-2xl border overflow-hidden ${
                    i === 0 ? 'border-emerald-500/30 ring-1 ring-emerald-500/10' : 'border-zinc-800'
                  }`}
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-zinc-200 text-lg">{match.name}</span>
                          {i === 0 && (
                            <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 font-medium">
                              ✓ Best Match
                            </span>
                          )}
                        </div>
                        {match.breed && <span className="text-zinc-500 text-sm">{match.breed}</span>}
                      </div>
                      <span className={`text-lg font-bold ${getConfidenceTextColor(match.similarity)}`}>
                        {(match.similarity * 100).toFixed(1)}%
                      </span>
                    </div>
                    {/* Confidence bar */}
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${match.similarity * 100}%` }}
                        transition={{ duration: 1, delay: 0.3 + i * 0.15, ease: "easeOut" }}
                        className={`h-full rounded-full ${getConfidenceColor(match.similarity)}`}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Action buttons */}
            <button 
              onClick={() => { setStatus('idle'); setResult(null) }}
              className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-medium hover:bg-zinc-700 transition border border-white/5"
            >
              Try Another Photo
            </button>
          </motion.div>
        )}
        
        {/* Error */}
        {status === 'error' && error && (
          <motion.div 
            key="error"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="w-full flex justify-center pb-20"
          >
            <NetworkError 
              error={error} 
              onRetry={async () => setStatus('idle')} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  )
}
