'use client'
import React, { useState, useEffect, useRef } from 'react'
import CameraCapture from '../components/CameraCapture'
import { Loader2, Fingerprint, ChevronLeft, Camera, Phone, Mail, Copy, AlertTriangle, PawPrint } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { identifyNose, ApiError } from '../../lib/api'
import NetworkError from '../components/NetworkError'
import { toast } from 'sonner'

type IdentifyStatus = 'idle' | 'processing' | 'match' | 'no_match' | 'error'

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
  similarity: number
  is_match: boolean
}

interface IdentifyResult {
  match: boolean
  message: string
  confidence?: number
  dog?: MatchCandidate
}

export default function IdentifyPage() {
  const [status, setStatus] = useState<IdentifyStatus>('idle')
  const [result, setResult] = useState<IdentifyResult | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [processingStep, setProcessingStep] = useState(0)
  const [isWaking, setIsWaking] = useState(false)
  const [stats, setStats] = useState({ registered_dogs: 0 })
  const [showTips, setShowTips] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportNote, setReportNote] = useState('')
  
  const wakeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(() => {})
  }, [])

  const PROCESSING_STEPS = [
    { icon: <ScanBox />, label: 'Locating nose...' },
    { icon: <Waveform />, label: 'Extracting biometric signature...' },
    { icon: <Loader2 className="animate-spin text-[var(--color-accent)]" />, label: `Searching ${stats.registered_dogs || '...'} registered dogs...` },
  ]

  useEffect(() => {
    if (status === 'processing') {
      setProcessingStep(0)
      let step = 0
      stepTimerRef.current = setInterval(() => {
        step++
        if (step < PROCESSING_STEPS.length) {
          setProcessingStep(step)
        }
      }, 1500)

      wakeTimerRef.current = setTimeout(() => setIsWaking(true), 8000)
    }
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current)
      if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current)
    }
  }, [status, stats.registered_dogs])

  const handleCapture = async (blobData: Blob | Blob[]) => {
    const blob = Array.isArray(blobData) ? blobData[0] : blobData
    setStatus('processing')
    setIsWaking(false)

    try {
      const data = await identifyNose(blob)
      if (data.match && data.dog) {
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

  const handleCopy = () => {
    if (!result?.dog) return
    const d = result.dog
    const text = `Name: ${d.name}\nPhone: ${d.owner_phone || 'N/A'}\nEmail: ${d.owner_email || 'N/A'}`
    navigator.clipboard.writeText(text)
    toast.success('Copied contact details to clipboard!')
  }

  const submitReport = async () => {
    if (!result?.dog?.dog_id) return
    try {
      await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dog_id: result.dog.dog_id, note: reportNote })
      })
      toast.success('Report submitted. Thank you for your feedback.')
      setShowReportModal(false)
      setReportNote('')
    } catch (err) {
      toast.error('Failed to submit report. Please try again.')
    }
  }

  const getConfidenceColor = (similarity: number) => {
    if (similarity >= 0.80) return 'bg-[var(--color-success)]'
    if (similarity >= 0.62) return 'bg-[var(--color-accent)]'
    return 'bg-[var(--color-warn)]'
  }

  return (
    <div className="h-[calc(100vh-64px)] overflow-hidden p-4 pt-8 flex flex-col items-center w-full relative z-10">
      
      {/* Ambient background only for identify page */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60vw] h-[60vw] rounded-full border border-[var(--color-accent)] opacity-10 animate-pulse-slow pointer-events-none blur-3xl z-0"></div>

      <AnimatePresence mode="wait">
        {/* Idle — Camera */}
        {status === 'idle' && (
          <motion.div 
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full h-full max-w-md relative z-10 flex flex-col pb-4"
          >
            <div className="flex flex-col items-center mb-6 shrink-0">
              <Camera className="w-10 h-10 text-[var(--color-accent)] mb-2" />
              <h2 className="text-xl font-bold font-display text-[var(--color-text)]">Point at any dog's nose</h2>
            </div>
            
            <div className="flex-1 min-h-0 w-full relative">
              <CameraCapture onCapture={handleCapture} />
            </div>

            <div className="mt-4 shrink-0">
              <button 
                onClick={() => setShowTips(!showTips)}
                className="w-full text-center text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors py-2"
              >
                Tips for a good scan {showTips ? '▲' : '▼'}
              </button>
              <AnimatePresence>
                {showTips && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <ul className="text-sm text-[var(--color-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-2 mt-2">
                      <li className="flex items-center gap-2"><span>•</span> Get within 30cm of the nose</li>
                      <li className="flex items-center gap-2"><span>•</span> Face the nose toward light</li>
                      <li className="flex items-center gap-2"><span>•</span> Keep the dog still for 1 second</li>
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Processing State */}
        {status === 'processing' && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 w-full max-w-md relative z-10"
          >
            <div className="w-32 h-32 mb-12 relative flex items-center justify-center">
              {PROCESSING_STEPS[processingStep]?.icon}
            </div>

            {!isWaking ? (
              <div className="space-y-6 w-full px-8">
                {PROCESSING_STEPS.map((pStep, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ 
                      opacity: i <= processingStep ? 1 : 0.3,
                      x: 0,
                    }}
                    className={`text-center transition-colors duration-300 ${
                      i === processingStep ? 'text-[var(--color-text)] font-semibold text-lg' : 'text-[var(--color-muted)] text-sm'
                    }`}
                  >
                    {pStep.label}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center animate-pulse">
                <h2 className="text-lg font-medium text-[var(--color-text)] mb-2">Waking up secure environment...</h2>
                <p className="text-[var(--color-muted)] text-sm">Takes a few extra seconds</p>
              </div>
            )}
          </motion.div>
        )}

        {/* No Match State */}
        {status === 'no_match' && (
          <motion.div 
            key="no_match"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center w-full max-w-md relative z-10"
          >
            <div className="w-24 h-24 rounded-full bg-[var(--color-surface)] border-2 border-[var(--color-warn)] flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-[var(--color-warn)]" />
            </div>
            <h2 className="text-3xl font-bold font-display text-[var(--color-text)] mb-3">No match found</h2>
            <p className="text-[var(--color-muted)] mb-10 text-center">We couldn't find a dog with this nose print in our registry.</p>
            
            <div className="w-full flex flex-col sm:flex-row gap-4">
              <Link href="/enroll" className="flex-1 py-4 bg-[var(--color-accent)] text-white text-center rounded-xl font-semibold hover:bg-blue-600 transition shadow-[0_0_15px_rgba(79,156,249,0.2)]">
                Register this dog
              </Link>
              <button 
                onClick={() => setStatus('idle')}
                className="flex-1 py-4 bg-transparent border border-[var(--color-border)] text-[var(--color-text)] rounded-xl font-semibold hover:bg-[var(--color-surface)] transition"
              >
                Try again
              </button>
            </div>
          </motion.div>
        )}

        {/* Match Found State */}
        {status === 'match' && result?.dog && (
          <motion.div 
            key="match"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md relative z-10"
          >
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-[var(--color-border)] flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-2 border-[var(--color-success)] bg-[var(--color-bg)] flex items-center justify-center relative">
                  {result.dog.profile_photo_url ? (
                    <img src={result.dog.profile_photo_url} alt="Dog" className="w-full h-full object-cover" />
                  ) : (
                    <PawPrint className="w-10 h-10 text-[var(--color-muted)]" />
                  )}
                  <div className="absolute inset-0 ring-inset ring-2 ring-black/10 rounded-full"></div>
                </div>
                <h2 className="text-3xl font-display font-bold text-[var(--color-text)] mb-1">{result.dog.name}</h2>
                {result.dog.breed && <p className="text-[var(--color-muted)]">{result.dog.breed}</p>}
                
                {/* Confidence Meter */}
                <div className="w-full mt-6 flex flex-col items-center">
                  <div className="flex justify-between w-full text-xs font-mono text-[var(--color-muted)] mb-2 px-2">
                    <span>Similarity</span>
                    <span className="text-[var(--color-text)]">{(result.dog.similarity * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-[var(--color-bg)] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${result.dog.similarity * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full rounded-full ${getConfidenceColor(result.dog.similarity)}`}
                    />
                  </div>
                </div>
                
                {result.dog.microchip_id && (
                  <div className="mt-4 inline-flex items-center bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1 rounded-md text-xs font-mono text-[var(--color-muted)]">
                    Microchip: {result.dog.microchip_id}
                  </div>
                )}
              </div>

              {/* Contact Block */}
              <div className="p-6 bg-[var(--color-bg)]/50">
                <p className="text-sm font-semibold text-[var(--color-text)] mb-4">Owner Contact</p>
                <motion.div 
                  initial="hidden"
                  animate="visible"
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  <motion.a variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} href={`tel:${result.dog.owner_phone || ''}`} className="flex flex-col items-center justify-center p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-[0_0_15px_rgba(79,156,249,0.1)] text-[var(--color-text)] transition-all duration-300 hover:-translate-y-1 group">
                    <Phone className="w-5 h-5 mb-2 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                    <span className="text-xs font-medium">Call</span>
                  </motion.a>
                  <motion.a variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} href={`mailto:${result.dog.owner_email || ''}`} className="flex flex-col items-center justify-center p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-[0_0_15px_rgba(79,156,249,0.1)] text-[var(--color-text)] transition-all duration-300 hover:-translate-y-1 group">
                    <Mail className="w-5 h-5 mb-2 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                    <span className="text-xs font-medium">Email</span>
                  </motion.a>
                  <motion.button variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} onClick={handleCopy} className="flex flex-col items-center justify-center p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-[0_0_15px_rgba(79,156,249,0.1)] text-[var(--color-text)] transition-all duration-300 hover:-translate-y-1 group">
                    <Copy className="w-5 h-5 mb-2 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                    <span className="text-xs font-medium">Copy Details</span>
                  </motion.button>
                </motion.div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              <button 
                onClick={() => { setStatus('idle'); setResult(null) }}
                className="w-full py-4 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-xl font-semibold hover:bg-[var(--color-border)] transition"
              >
                Scan Another Dog
              </button>
              
              <button 
                onClick={() => setShowReportModal(true)}
                className="text-xs text-[var(--color-muted)] underline text-center hover:text-[var(--color-text)]"
              >
                Report this match as incorrect
              </button>
            </div>
          </motion.div>
        )}

        {/* Error */}
        {status === 'error' && error && (
          <motion.div 
            key="error"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="w-full flex justify-center pb-20 relative z-10"
          >
            <NetworkError 
              error={error} 
              onRetry={async () => setStatus('idle')} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6"
            >
              <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">Report Match</h3>
              <p className="text-sm text-[var(--color-muted)] mb-4">Please provide details on why you believe this match is incorrect.</p>
              <textarea 
                value={reportNote}
                onChange={e => setReportNote(e.target.value)}
                className="w-full h-24 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 text-sm text-[var(--color-text)] mb-4 focus:outline-none focus:border-[var(--color-accent)]"
                placeholder="E.g., The dog in the photo looks different from the scan..."
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-bg)]"
                >
                  Cancel
                </button>
                <button 
                  onClick={submitReport}
                  className="flex-1 py-2 rounded-lg bg-[var(--color-error)] text-white font-medium hover:bg-red-600"
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Mini components for processing animations
function ScanBox() {
  return (
    <div className="w-20 h-20 border-2 border-dashed border-[var(--color-accent)] rounded-2xl relative overflow-hidden flex items-center justify-center shadow-[0_0_20px_rgba(79,156,249,0.3)]">
      <PawPrint className="w-8 h-8 text-[var(--color-accent)] opacity-50" />
      <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--color-accent)] animate-scan shadow-[0_0_10px_rgba(79,156,249,1)]"></div>
    </div>
  )
}

function Waveform() {
  return (
    <div className="flex gap-1 h-12 items-center justify-center">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <motion.div 
          key={i}
          animate={{ height: ['20%', '100%', '20%'] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
          className="w-1.5 bg-[var(--color-accent-2)] rounded-full shadow-[0_0_10px_rgba(167,139,250,0.5)]"
        />
      ))}
    </div>
  )
}
