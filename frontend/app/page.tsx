'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, ScanFace, CheckCircle, Smartphone, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'

interface Stats {
  registered_dogs: number;
  matches_made: number;
  owners_reunited: number;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({ registered_dogs: 0, matches_made: 0, owners_reunited: 0 })

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error(err))
  }, [])

  return (
    <div className="flex flex-col items-center min-h-screen w-full relative overflow-hidden">
      
      {/* Animated signature noseprint scan ring ambient background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] min-w-[300px] min-h-[300px] rounded-full border border-[var(--color-accent)] opacity-30 animate-pulse-slow pointer-events-none blur-xl"></div>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[30vw] h-[30vw] max-w-[450px] max-h-[450px] min-w-[200px] min-h-[200px] rounded-full border-2 border-[var(--color-accent)] opacity-20 animate-pulse-slow pointer-events-none delay-75"></div>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center pt-32 pb-20 px-4 text-center z-10 w-full max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-bold font-display text-[var(--color-text)] mb-6 tracking-tight">
          Every Nose.<br/>
          <span className="text-[var(--color-accent)]">One Identity.</span>
        </h1>
        <p className="text-lg md:text-xl text-[var(--color-muted)] mb-12 max-w-2xl font-light">
          The world's first open biometric registry for dogs. Find lost pets in seconds.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center mb-16">
          <Link href="/identify" className="bg-[var(--color-accent)] hover:bg-blue-600 text-white font-semibold py-4 px-8 rounded-xl shadow-[0_0_20px_rgba(79,156,249,0.25)] hover:shadow-[0_0_30px_rgba(79,156,249,0.4)] transition-all flex items-center justify-center gap-2 text-lg">
            <ScanFace className="w-5 h-5" />
            Scan a Dog
          </Link>
          <Link href="/enroll" className="bg-transparent border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white font-semibold py-4 px-8 rounded-xl transition-all flex items-center justify-center gap-2 text-lg">
            <Camera className="w-5 h-5" />
            Register Your Dog
          </Link>
        </div>

        {/* Live Stats */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl border-t border-[var(--color-border)] pt-8"
        >
          <div className="flex flex-col items-center">
            <span className="text-3xl font-display font-bold text-[var(--color-text)] mb-1">{stats.registered_dogs}</span>
            <span className="text-sm text-[var(--color-muted)]">Dogs Registered</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-display font-bold text-[var(--color-text)] mb-1">{stats.matches_made}</span>
            <span className="text-sm text-[var(--color-muted)]">Matches Made</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-display font-bold text-[var(--color-text)] mb-1">{stats.owners_reunited}</span>
            <span className="text-sm text-[var(--color-muted)]">Owners Reunited</span>
          </div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="w-full bg-[var(--color-surface)] border-y border-[var(--color-border)] py-20 px-4 z-10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-center mb-16">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            
            {/* Desktop connecting line */}
            <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-0.5 bg-[var(--color-border)] z-0"></div>

            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-16 h-16 rounded-full bg-[var(--color-bg)] border-2 border-[var(--color-accent)] flex items-center justify-center mb-6 shadow-lg">
                <Camera className="w-7 h-7 text-[var(--color-accent)]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">1. Snap</h3>
              <p className="text-[var(--color-muted)]">Take a photo of any dog's nose</p>
            </div>
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-16 h-16 rounded-full bg-[var(--color-bg)] border-2 border-[var(--color-accent)] flex items-center justify-center mb-6 shadow-lg">
                <ScanFace className="w-7 h-7 text-[var(--color-accent)]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">2. Match</h3>
              <p className="text-[var(--color-muted)]">Our AI searches the entire registry instantly</p>
            </div>
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-16 h-16 rounded-full bg-[var(--color-bg)] border-2 border-[var(--color-accent)] flex items-center justify-center mb-6 shadow-lg">
                <CheckCircle className="w-7 h-7 text-[var(--color-accent)]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">3. Reunite</h3>
              <p className="text-[var(--color-muted)]">Contact the owner directly — no middleman</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust / Social Proof */}
      <section className="py-20 px-4 w-full max-w-5xl mx-auto z-10 text-center">
        <h2 className="text-3xl font-bold font-display mb-12">Built for real emergencies</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-8 flex flex-col items-center">
            <Smartphone className="w-10 h-10 text-[var(--color-accent)] mb-4" />
            <h3 className="text-xl font-semibold mb-2">Works anywhere</h3>
            <p className="text-[var(--color-muted)]">Identify requires no account, works on any smartphone browser, and returns results in under 3 seconds.</p>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-8 flex flex-col items-center">
            <ShieldCheck className="w-10 h-10 text-[var(--color-accent)] mb-4" />
            <h3 className="text-xl font-semibold mb-2">Privacy first</h3>
            <p className="text-[var(--color-muted)]">Owner contact info is only revealed when a positive biometric match is made. Your data is secure.</p>
          </div>
        </div>

        <div className="inline-block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-6 py-3 shadow-[0_0_15px_rgba(167,139,250,0.15)]">
          <p className="text-[var(--color-accent-2)] font-mono font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse"></span>
            98.4% identification accuracy on matched dogs
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-[var(--color-border)] bg-[var(--color-surface)] py-8 mt-auto z-10">
        <div className="max-w-5xl mx-auto px-4 flex flex-col items-center">
          <div className="flex gap-6 mb-6">
            <Link href="/" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]">Home</Link>
            <Link href="/identify" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]">Identify</Link>
            <Link href="/enroll" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]">Enroll</Link>
            <a href="https://github./SKKammar/DogNose" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]">GitHub</a>
            <Link href="/privacy" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]">Privacy</Link>
          </div>
          <p className="text-xs text-[var(--color-muted)] text-center max-w-2xl">
            DogNose uses ArcFace biometric technology — the same family of algorithms used in human facial recognition systems.
          </p>
        </div>
      </footer>
    </div>
  )
}
