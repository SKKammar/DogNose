'use client'

import { useState, useEffect } from 'react'
import { Hexagon } from 'lucide-react'

const PIPELINE_STEPS = [
  "Initializing inference engine...",
  "Isolating nasal ridge ROI...",
  "Extracting biometric tensor embeddings...",
  "Querying ChromaDB vector space...",
  "Computing cosine similarity distances...",
  "Resolving nearest neighbor identity..."
]

export default function PipelineTerminal() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Progress through steps to simulate the PyTorch/ChromaDB pipeline
    const interval = setInterval(() => {
      setStep((s) => Math.min(s + 1, PIPELINE_STEPS.length - 1))
    }, 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full max-w-md mx-auto card p-6 bg-surface border-border/80 shadow-lg animate-fade-in relative overflow-hidden">
      {/* Background terminal grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(to right, #0F172A 1px, transparent 1px), linear-gradient(to bottom, #0F172A 1px, transparent 1px)`,
          backgroundSize: '16px 16px'
        }}
      />
      
      <div className="flex items-center gap-4 mb-6 relative z-10 border-b border-border pb-4">
        <div className="relative flex items-center justify-center w-10 h-10 rounded bg-background border border-border">
          <Hexagon className="w-5 h-5 text-accent animate-[spin_4s_linear_infinite]" />
          <div className="absolute inset-0 border border-accent/20 rounded animate-pulse-slow" />
        </div>
        <div>
          <h3 className="font-display font-bold text-text-primary leading-none">
            Vector Inference
          </h3>
          <p className="text-[10px] font-mono text-text-muted mt-1 uppercase tracking-widest">
            Processing Biometrics
          </p>
        </div>
      </div>

      <div className="space-y-2.5 font-mono text-xs relative z-10">
        {PIPELINE_STEPS.map((text, i) => (
          <div key={i} className={`flex items-start gap-3 transition-opacity duration-300 ${i > step ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
            <span className={i === step ? 'text-accent animate-pulse' : 'text-success'}>
              {i === step ? '>' : '✓'}
            </span>
            <span className={i === step ? 'text-text-primary' : 'text-text-muted'}>
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
