'use client'
import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { PawPrint, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccess('Check your email to confirm your account.')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[90vh] w-full flex flex-col items-center justify-center px-4 relative bg-background">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-10 text-center">
          <Link href="/" className="flex items-center gap-3 mb-8 group">
            <div className="w-12 h-12 bg-surface border border-border flex items-center justify-center group-hover:border-accent-blue transition-colors">
              <PawPrint className="w-6 h-6 text-text-primary" />
            </div>
            <span className="font-display font-bold text-2xl text-text-primary uppercase tracking-tight">CANID</span>
          </Link>
          <h1 className="text-3xl font-bold font-display uppercase tracking-tight mb-2">
            {isLogin ? 'Authentication' : 'Initialize Account'}
          </h1>
          <p className="font-mono text-text-muted text-xs uppercase tracking-widest">
            {isLogin ? 'Establish Verified Session' : 'Create Access Credentials'}
          </p>
        </div>

        <div className="bg-surface border border-border p-10 shadow-brutalist">
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 p-4 bg-background border border-accent-red text-accent-red text-xs font-mono uppercase tracking-widest mb-8"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 p-4 bg-background border border-accent-green text-accent-green text-xs font-mono uppercase tracking-widest mb-8"
            >
              <span>{success}</span>
            </motion.div>
          )}

          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label className="field-label">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="input-base"
                placeholder="USER@DOMAIN.COM"
              />
            </div>

            <div>
              <label className="field-label">Access Token</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input-base pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 mt-4 text-sm tracking-widest uppercase disabled:opacity-50"
            >
              {loading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : (isLogin ? 'EXECUTE LOGIN' : 'PROVISION ACCOUNT')
              }
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess('') }}
              className="font-mono text-xs text-text-muted hover:text-text-primary transition-colors uppercase tracking-widest"
            >
              {isLogin ? "REQUIRE CREDENTIALS? SIGN UP" : 'RETURN TO LOGIN'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
