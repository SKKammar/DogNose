'use client'
import React, { useState } from 'react'
import { WifiOff, AlertTriangle, RefreshCw, ExternalLink, Settings, Clock, RefreshCcw } from 'lucide-react'
import { ApiError } from '../../lib/api'
import { motion } from 'framer-motion'

interface NetworkErrorProps {
  error: ApiError
  onRetry: () => Promise<void>
}

export default function NetworkError({ error, onRetry }: NetworkErrorProps) {
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await onRetry()
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto bg-surface border border-accent-red shadow-brutalist relative mt-8"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-accent-red"></div>
      
      <div className="p-8 pb-6 border-b border-border flex items-start gap-5">
        <div className="w-12 h-12 shrink-0 bg-background border border-accent-red flex items-center justify-center">
          {error.type === 'network' || error.type === 'cors' ? (
            <WifiOff className="text-accent-red" size={24} />
          ) : (
            <AlertTriangle className="text-accent-red" size={24} />
          )}
        </div>
        <div>
          <span className="font-mono text-[10px] text-accent-red uppercase tracking-widest mb-1 block">SYS_ERR_NET</span>
          <h2 className="text-2xl font-display font-bold text-text-primary mb-1 uppercase tracking-tight">Connection Fault</h2>
          <p className="font-mono text-text-secondary text-sm">{error.message}</p>
        </div>
      </div>

      <div className="p-8 space-y-6">
        <div className="bg-background border border-border p-5">
          <h3 className="text-xs font-mono font-bold text-text-muted mb-4 uppercase tracking-wider flex items-center gap-2">
            <Settings size={14} /> Diagnostic Checklist
          </h3>
          <ul className="space-y-4 font-mono text-sm text-text-secondary">
            <li className="flex gap-4">
              <span className="text-accent-blue font-bold">01</span>
              <div>
                <strong className="text-text-primary block mb-0.5">Verify API URL</strong>
                <p className="text-xs text-text-muted">Ensure <code className="bg-surface border border-border px-1 py-0.5 text-text-primary">NEXT_PUBLIC_API_URL</code> is correct.</p>
                <div className="mt-2 p-2 bg-surface border border-border text-xs text-text-primary">
                  TARGET: {process.env.NEXT_PUBLIC_API_URL || 'DEFAULT'}
                </div>
              </div>
            </li>
            
            <li className="flex gap-4">
              <span className="text-accent-blue font-bold">02</span>
              <div>
                <strong className="text-text-primary block mb-0.5">Check CORS Policy</strong>
                <p className="text-xs text-text-muted">Verify backend allows origins.</p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="text-accent-blue font-bold">03</span>
              <div>
                <strong className="text-text-primary block mb-0.5">Server Health</strong>
                <p className="text-xs text-text-muted flex items-center gap-2">
                  <Clock size={12} className="text-text-muted" /> Check Uvicorn backend status.
                </p>
              </div>
            </li>
            
            <li className="flex gap-4">
              <span className="text-accent-blue font-bold">04</span>
              <div>
                <strong className="text-text-primary block mb-0.5">Hard Refresh</strong>
                <p className="text-xs text-text-muted flex items-center gap-2">
                  <RefreshCcw size={12} /> Clear browser cache (Ctrl+F5).
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div className="px-8 pb-8 flex flex-col sm:flex-row gap-4">
        <button 
          onClick={handleRetry}
          disabled={isRetrying}
          className="flex-1 py-3 px-6 bg-accent-red text-background font-sans font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 border border-transparent"
        >
          {isRetrying ? (
            <><RefreshCw className="animate-spin" size={18} /> RETRYING...</>
          ) : (
            <><RefreshCw size={18} /> INITIATE RETRY</>
          )}
        </button>
        <a 
          href="https://github.com/SKKammar/DogNose/issues" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex-1 py-3 px-6 bg-transparent text-text-primary font-sans font-semibold border border-border hover:border-text-secondary hover:bg-background transition-colors flex items-center justify-center gap-2"
        >
          <ExternalLink size={18} /> VIEW LOGS
        </a>
      </div>
    </motion.div>
  )
}
