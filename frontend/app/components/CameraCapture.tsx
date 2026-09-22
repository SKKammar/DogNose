'use client'
import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Camera, RefreshCcw, Upload, ScanLine } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (blob: Blob | Blob[]) => void
  isScanning?: boolean
  remainingPhotos?: number
}

export default function CameraCapture({ onCapture, isScanning = false, remainingPhotos = Infinity }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [stream, setStream] = useState<MediaStream | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'camera' | 'upload'>('camera')
  const [flash, setFlash] = useState(false)
  
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', 
          width: { ideal: 1080 },
          aspectRatio: { ideal: 0.75 } 
        }
      })
      streamRef.current = newStream
      setStream(newStream)
      if (videoRef.current) {
        videoRef.current.srcObject = newStream
      }
      setError(null)
    } catch (err: any) {
      setError("Camera access denied.")
      setMode('upload')
    }
  }, [])

  useEffect(() => {
    if (mode === 'camera') {
      startCamera()
    }
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [mode, startCamera])

  const capture = useCallback(() => {
    if (mode === 'upload' || isScanning) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const width = video.videoWidth
    const height = video.videoHeight
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, width, height)
    
    canvas.toBlob((blob) => {
      if (blob) {
        setFlash(true)
        setTimeout(() => setFlash(false), 150)
        onCapture(blob)
      }
    }, 'image/jpeg', 0.9)
  }, [mode, onCapture, isScanning])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'))
      onCapture(files)
    }
  }

  const [isDragging, setIsDragging] = useState(false)
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
      onCapture(files)
    }
  }

  if (mode === 'upload') {
    return (
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-10 border w-full h-[600px] max-w-lg mx-auto relative transition-colors ${
          isDragging ? 'border-accent-blue bg-surface' : 'border-border bg-background'
        }`}
      >
        <Upload className={`${isDragging ? 'text-accent-blue' : 'text-text-muted'} mb-4`} size={48} strokeWidth={1.5} />
        <p className="text-text-secondary mb-6 text-center font-sans font-medium text-sm">
          {isDragging ? 'Drop photos to process' : "Camera unavailable. Upload high-res JPEG/PNG."}
        </p>
        <input 
          type="file" 
          multiple
          accept="image/jpeg,image/png,image/webp" 
          onChange={handleFileUpload}
          className="block w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-mono file:font-semibold file:bg-surface file:border file:border-border file:text-text-primary hover:file:bg-border transition cursor-pointer"
        />
      </div>
    )
  }

  return (
    <div className="relative w-full h-[70vh] min-h-[500px] max-h-[800px] max-w-2xl mx-auto bg-background border border-border overflow-hidden">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-text-muted bg-surface">
          {error.toUpperCase()}
        </div>
      ) : (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Flash Effect */}
      {flash && (
        <div className="absolute inset-0 bg-text-primary z-40 transition-opacity duration-150"></div>
      )}
      
      {/* Strict Technical HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
        <div className="relative w-[280px] h-[360px]">
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-accent-blue"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-accent-blue"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-accent-blue"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-accent-blue"></div>
          
          {/* Reticle crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
             <div className="w-full h-[1px] bg-accent-blue/50"></div>
             <div className="absolute h-full w-[1px] bg-accent-blue/50"></div>
          </div>

          {/* Scan line animation */}
          {isScanning && (
            <div className="absolute left-0 right-0 h-[2px] bg-accent-blue animate-scan"></div>
          )}
        </div>
      </div>

      {/* Technical Data HUD layer */}
      <div className="absolute top-4 left-4 font-mono text-[10px] text-accent-blue uppercase tracking-widest bg-background/80 px-2 py-1">
        SYS_CAM_LIVE
      </div>
      
      {remainingPhotos < Infinity && (
        <div className="absolute top-4 right-4 font-mono text-[10px] text-text-primary bg-background/80 px-2 py-1 border border-border">
          REMAINING: {remainingPhotos}
        </div>
      )}

      {/* Action Bar */}
      <div className="absolute bottom-0 inset-x-0 h-24 bg-background/90 border-t border-border flex justify-center items-center gap-8">
        <button onClick={startCamera} className="w-12 h-12 flex items-center justify-center text-text-muted hover:text-text-primary bg-surface border border-border transition-colors">
          <RefreshCcw size={20} />
        </button>
        <button 
          onClick={capture} 
          disabled={isScanning}
          className={`w-16 h-16 flex items-center justify-center transition-colors ${
            isScanning ? 'bg-surface border border-border cursor-not-allowed' : 'bg-accent-blue hover:bg-[#3B82F6] active:scale-95'
          }`}
        >
          {isScanning ? (
            <div className="w-6 h-6 border-2 border-border border-t-text-muted rounded-full animate-spin"></div>
          ) : (
            <Camera size={24} className="text-background" />
          )}
        </button>
        <div className="w-12 h-12"></div> {/* Balance spacer */}
      </div>
    </div>
  )
}
