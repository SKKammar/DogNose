'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { RefreshCcw, Upload, Focus } from 'lucide-react'

interface Props {
  onCapture: (blob: Blob | Blob[]) => void
  isScanning?: boolean
}

export default function CameraCapture({ onCapture, isScanning = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'camera' | 'upload'>('camera')
  const [flash, setFlash] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    stopStream()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1080 } },
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setError(null)
    } catch {
      setError('Camera unavailable')
      setMode('upload')
    }
  }, [stopStream])

  useEffect(() => {
    if (mode === 'camera') startCamera()
    return () => stopStream()
  }, [mode, startCamera, stopStream])

  // Listen for visibility changes (e.g. user minimizing the browser)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopStream()
      } else if (mode === 'camera' && !isScanning) {
        startCamera()
      }
    }
    
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [mode, isScanning, startCamera, stopStream])

  const capture = useCallback(() => {
    if (mode === 'upload' || isScanning) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // 1. Native Haptic Feedback (Sharp tick)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15) 
    }

    // 2. Smart Cropping (Extracting only the center where the HUD reticle is)
    // We assume the nose is centered. We crop a square from the center of the video feed.
    const cropSize = Math.min(video.videoWidth, video.videoHeight) * 0.7 // 70% of the smallest dimension
    const startX = (video.videoWidth - cropSize) / 2
    const startY = (video.videoHeight - cropSize) / 2

    canvas.width = cropSize
    canvas.height = cropSize
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Draw only the cropped center portion
    ctx.drawImage(
      video,
      startX, startY, cropSize, cropSize, // Source coordinates
      0, 0, cropSize, cropSize          // Destination coordinates
    )

    // Compress to 80% JPEG to keep payload under 500kb per image
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setFlash(true)
        setTimeout(() => setFlash(false), 150)
        onCapture(blob)
      },
      'image/jpeg',
      0.8
    )
  }, [mode, onCapture, isScanning])

  if (mode === 'upload' || error) {
    return (
      <div className="w-full max-w-md mx-auto card p-10 flex flex-col items-center text-center animate-fade-in">
        <Upload className="w-8 h-8 text-text-muted mb-4" strokeWidth={1.5} />
        <h3 className="text-base font-display font-bold text-text-primary mb-2">Upload a photo</h3>
        <p className="text-sm text-text-secondary mb-6">Camera isn&apos;t available. Choose a photo of the dog&apos;s nose.</p>
        <label className="btn-secondary btn-sm cursor-pointer">
          Choose files
          <input 
            type="file" 
            multiple
            accept="image/jpeg,image/png,image/webp" 
            onChange={(e) => {
              if (e.target.files?.length) onCapture(Array.from(e.target.files))
            }} 
            className="hidden" 
          />
        </label>
      </div>
    )
  }

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-black rounded-md overflow-hidden border border-border shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isScanning ? 'opacity-50 blur-sm' : 'opacity-100'}`}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Flash Overlay */}
      {flash && <div className="absolute inset-0 bg-white z-50 transition-opacity" />}

      {/* High-Precision Targeting Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-56 h-72">
          {/* Subtle Oval */}
          <div className="absolute inset-0 border border-white/20 rounded-[999px]" />
          
          {/* Computer Vision Reticles */}
          <div className="absolute -top-2 -left-2 w-6 h-6 border-t-2 border-l-2 border-accent/80 rounded-tl-sm" />
          <div className="absolute -top-2 -right-2 w-6 h-6 border-t-2 border-r-2 border-accent/80 rounded-tr-sm" />
          <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-2 border-l-2 border-accent/80 rounded-bl-sm" />
          <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2 border-accent/80 rounded-br-sm" />
          
          {isScanning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Focus className="w-8 h-8 text-accent animate-spin opacity-80" />
            </div>
          )}
        </div>
      </div>

      {/* Shutter Controls */}
      <div className="absolute bottom-8 inset-x-0 flex items-center justify-center gap-8">
        <button
          onClick={startCamera}
          className="btn-icon bg-black/50 text-white/80 hover:text-white border-white/10 hover:border-white/30 backdrop-blur-none"
          aria-label="Restart camera"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
        
        {/* Physical-feeling capture button */}
        <button
          onClick={capture}
          disabled={isScanning}
          aria-label="Capture"
          className="w-16 h-16 rounded-full border-2 border-white flex items-center justify-center disabled:opacity-40 transition-transform active:scale-90"
        >
          <span className={`w-12 h-12 rounded-full bg-white transition-all ${isScanning ? 'scale-75 bg-accent' : 'scale-100 hover:scale-95'}`} />
        </button>
        <span className="w-9 h-9" /> {/* Spacer for layout balance */}
      </div>
    </div>
  )
}
