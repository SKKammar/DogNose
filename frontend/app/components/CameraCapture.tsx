'use client'
import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Camera, RefreshCcw, Upload, ScanLine } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void
  isScanning?: boolean
}

export default function CameraCapture({ onCapture, isScanning = false }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'camera' | 'upload'>('camera')
  
  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1080 } }
      })
      setStream(newStream)
      if (videoRef.current) {
        videoRef.current.srcObject = newStream
      }
      setError(null)
    } catch (err: any) {
      setError("Camera access denied.")
      setMode('upload')
    }
  }, [stream])

  useEffect(() => {
    if (mode === 'camera') {
      startCamera()
    }
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [mode])

  const assessFrame = (ctx: CanvasRenderingContext2D, width: number, height: number): boolean => {
    // Sharpness gate placeholder
    return true
  }

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
    
    if (!assessFrame(ctx, width, height)) {
      alert("Image too blurry, hold still!")
      return
    }

    canvas.toBlob((blob) => {
      if (blob) onCapture(blob)
    }, 'image/jpeg', 0.9)
  }, [mode, onCapture, isScanning])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onCapture(e.target.files[0])
    }
  }

  if (mode === 'upload') {
    return (
      <div className="flex flex-col items-center justify-center p-10 border border-zinc-800 rounded-3xl bg-zinc-900/50 w-full max-w-md mx-auto backdrop-blur-sm relative overflow-hidden">
        <Upload className="text-zinc-500 mb-4" size={48} strokeWidth={1} />
        <p className="text-zinc-400 mb-6 text-center font-light">Camera unavailable. Upload a clear photo of the dog's nose.</p>
        <input 
          type="file" 
          accept="image/jpeg,image/png,image/webp" 
          onChange={handleFileUpload}
          className="block w-full text-sm text-zinc-400 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 transition"
        />
      </div>
    )
  }

  return (
    <div className="relative w-full max-w-md mx-auto bg-black rounded-3xl overflow-hidden aspect-[3/4] shadow-2xl ring-1 ring-white/10">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-center p-6 bg-zinc-900">
          {error}
        </div>
      ) : (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover opacity-90"
        />
      )}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Cinematic HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-56 h-56 border border-white/20 rounded-2xl relative overflow-hidden bg-white/5 backdrop-blur-[1px]">
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400 rounded-tl-xl"></div>
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400 rounded-tr-xl"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400 rounded-bl-xl"></div>
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400 rounded-br-xl"></div>
          
          {/* Scan line animation */}
          {isScanning && (
            <div className="absolute left-0 right-0 h-1 bg-blue-500/80 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan"></div>
          )}
        </div>
      </div>

      <div className="absolute bottom-8 inset-x-0 flex justify-center items-center gap-8">
        <button onClick={startCamera} className="p-3 bg-zinc-900/40 backdrop-blur-md rounded-full text-zinc-300 hover:bg-zinc-900/60 transition border border-white/10">
          <RefreshCcw size={24} />
        </button>
        <button 
          onClick={capture} 
          disabled={isScanning}
          className={`w-20 h-20 rounded-full border-2 p-1 transition duration-300 ${isScanning ? 'border-zinc-600' : 'border-blue-400'}`}
        >
          <div className={`w-full h-full rounded-full transition-all duration-300 ${isScanning ? 'bg-zinc-700' : 'bg-white hover:bg-zinc-200 active:scale-90'}`}></div>
        </button>
        <div className="w-12 h-12"></div>
      </div>
    </div>
  )
}
