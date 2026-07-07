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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg mx-auto bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[2rem] border border-zinc-800 shadow-2xl relative overflow-hidden mt-8"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500"></div>
      
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 shrink-0 bg-red-500/10 rounded-2xl flex items-center justify-center ring-1 ring-red-500/20">
          {error.type === 'network' || error.type === 'cors' ? (
            <WifiOff className="text-red-400" size={28} />
          ) : (
            <AlertTriangle className="text-red-400" size={28} />
          )}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-wide mb-1">Connection Error</h2>
          <p className="text-red-400 font-medium text-sm">{error.message}</p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider flex items-center gap-2">
            <Settings size={16} className="text-zinc-500" /> Troubleshooting Guide
          </h3>
          <ol className="space-y-4 text-sm text-zinc-400">
            <li className="flex gap-3">
              <span className="w-5 h-5 shrink-0 flex items-center justify-center bg-zinc-800 rounded-full text-xs font-bold text-zinc-300">1</span>
              <div>
                <strong className="text-zinc-200 block mb-1">Verify API URL</strong>
                <p>Ensure <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">NEXT_PUBLIC_API_URL</code> in Vercel is correct.</p>
                <div className="mt-2 p-2 bg-zinc-900 rounded-lg text-xs font-mono break-all text-blue-400 border border-zinc-800">
                  Current: {process.env.NEXT_PUBLIC_API_URL || 'Not Set (using defaults)'}
                </div>
              </div>
            </li>
            
            <li className="flex gap-3">
              <span className="w-5 h-5 shrink-0 flex items-center justify-center bg-zinc-800 rounded-full text-xs font-bold text-zinc-300">2</span>
              <div>
                <strong className="text-zinc-200 block mb-1">Check CORS Configurations</strong>
                <p>On Render, verify the <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">ALLOWED_ORIGINS</code> environment variable matches the current Vercel URL exactly.</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="w-5 h-5 shrink-0 flex items-center justify-center bg-zinc-800 rounded-full text-xs font-bold text-zinc-300">3</span>
              <div>
                <strong className="text-zinc-200 block mb-1">Backend Cold Start</strong>
                <p className="flex items-start gap-2">
                  <Clock size={14} className="text-orange-400 mt-0.5 shrink-0" />
                  Render free tiers spin down after inactivity. Wait 60 seconds and retry while the server wakes up.
                </p>
              </div>
            </li>
            
            <li className="flex gap-3">
              <span className="w-5 h-5 shrink-0 flex items-center justify-center bg-zinc-800 rounded-full text-xs font-bold text-zinc-300">4</span>
              <div>
                <strong className="text-zinc-200 block mb-1">Clear Cache</strong>
                <p className="flex items-center gap-2">
                  <RefreshCcw size={14} className="text-blue-400" />
                  Try a hard refresh (Ctrl+F5 or Cmd+Shift+R) to clear browser caching.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button 
          onClick={handleRetry}
          disabled={isRetrying}
          className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRetrying ? (
            <><RefreshCw className="animate-spin" size={20} /> Retrying...</>
          ) : (
            <><RefreshCw size={20} /> Try Again</>
          )}
        </button>
        <a 
          href="https://github.com/SKKammar/DogNose/issues" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex-1 py-3 px-6 bg-zinc-800 text-zinc-300 rounded-xl font-medium hover:bg-zinc-700 transition flex items-center justify-center gap-2"
        >
          <ExternalLink size={18} /> Get Support
        </a>
      </div>
    </motion.div>
  )
}
