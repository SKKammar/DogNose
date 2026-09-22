'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ScanFace, Camera, ShieldCheck, Smartphone, PawPrint } from 'lucide-react'
import { motion } from 'framer-motion'
import { API_URL } from '../lib/api'

interface Stats {
  registered_dogs: number
  matches_made: number
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 }
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({ registered_dogs: 0, matches_made: 0 })

  useEffect(() => {
    fetch(`${API_URL}/stats`)
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {})
  }, [])

  return (
    <div className="flex flex-col w-full">

      {/* HERO SECTION */}
      <section className="w-full min-h-[90vh] flex flex-col justify-center border-b border-border bg-background pt-16">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Hero Copy */}
          <motion.div
            initial="hidden"
            animate="visible"
            transition={{ staggerChildren: 0.1 }}
          >
            <motion.div variants={fadeUp} className="mb-6">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-accent-blue border border-accent-blue bg-accent-blue/5 px-3 py-1.5">
                SYS_REGISTRY // ONLINE
              </span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="font-display text-5xl md:text-7xl lg:text-[5rem] font-bold text-text-primary mb-8 leading-[1.05] tracking-tight uppercase">
              Absolute Biometric Certainty.
            </motion.h1>

            <motion.p variants={fadeUp} className="font-sans text-lg md:text-xl text-text-secondary leading-relaxed mb-10 max-w-xl">
              Ground truth canine identification powered by edge-to-edge metric analysis. No chips, no tags. Every nose is a unique identifier.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
              <Link href="/identify" className="btn-primary py-4 px-8 uppercase tracking-widest text-sm shadow-none hover:shadow-brutalist flex items-center justify-center gap-3">
                <ScanFace className="w-5 h-5" /> Initialize Scan
              </Link>
              <Link href="/enroll" className="btn-ghost py-4 px-8 uppercase tracking-widest text-sm hover:border-text-primary hover:bg-surface flex items-center justify-center gap-3">
                <Camera className="w-5 h-5" /> Register Subject
              </Link>
            </motion.div>

            {/* Quick System Stats */}
            <motion.div variants={fadeUp} className="flex gap-12 mt-16 pt-8 border-t border-border">
              <div className="flex flex-col gap-1">
                <span className="font-display text-4xl font-bold text-text-primary">{stats.registered_dogs}</span>
                <span className="font-mono text-xs text-text-muted uppercase tracking-widest">Active Subjects</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-display text-4xl font-bold text-text-primary">{stats.matches_made}</span>
                <span className="font-mono text-xs text-text-muted uppercase tracking-widest">Confirmed Matches</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Hero Visual Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full aspect-[4/3] bg-surface border border-border flex flex-col items-center justify-center relative overflow-hidden"
          >
            {/* Technical Grid Background */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#1E2736 1px, transparent 1px), linear-gradient(90deg, #1E2736 1px, transparent 1px)', backgroundSize: '48px 48px' }}></div>
            
            <ScanFace className="w-16 h-16 text-border mb-4" />
            <span className="font-mono text-xs text-text-muted tracking-widest uppercase">CAMERA_FEED_STANDBY</span>

            {/* Decorative Corner Brackets */}
            <div className="absolute top-8 left-8 w-8 h-8 border-t border-l border-border"></div>
            <div className="absolute top-8 right-8 w-8 h-8 border-t border-r border-border"></div>
            <div className="absolute bottom-8 left-8 w-8 h-8 border-b border-l border-border"></div>
            <div className="absolute bottom-8 right-8 w-8 h-8 border-b border-r border-border"></div>
          </motion.div>

        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="w-full py-32 px-6 bg-surface border-b border-border">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ staggerChildren: 0.1 }}
            className="mb-20 max-w-2xl"
          >
            <motion.p variants={fadeUp} className="text-xs font-mono font-bold uppercase tracking-widest text-accent-blue mb-4">Protocol Sequence</motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-display font-bold text-text-primary uppercase tracking-tight">Execution Pathway</motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ staggerChildren: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-border"
          >
            {[
              { icon: Camera, step: '01', title: 'Capture Data', desc: "Acquire a high-resolution image of the subject's nose from 15-20cm." },
              { icon: ScanFace, step: '02', title: 'Extract Signature', desc: 'System isolates the biometric topology and generates a 1536-D vector.' },
              { icon: PawPrint, step: '03', title: 'Query Registry', desc: "Vector is matched against the global database for positive identification." },
            ].map(({ icon: Icon, step, title, desc }, idx) => (
              <motion.div key={step} variants={fadeUp} className={`flex flex-col p-12 bg-background relative ${idx !== 2 ? 'border-b md:border-b-0 md:border-r border-border' : ''}`}>
                <div className="flex items-center justify-between mb-8">
                  <div className="w-12 h-12 bg-surface border border-border flex items-center justify-center">
                    <Icon className="w-5 h-5 text-accent-blue" />
                  </div>
                  <span className="font-mono text-sm font-bold text-text-muted">{step}</span>
                </div>
                <h3 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">{title}</h3>
                <p className="font-sans text-text-secondary leading-relaxed text-sm">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SYSTEM SPECS */}
      <section className="w-full py-32 px-6 bg-background">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-20">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ staggerChildren: 0.1 }}
          >
            <motion.p variants={fadeUp} className="text-xs font-mono font-bold uppercase tracking-widest text-text-muted mb-4">Architecture</motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-display font-bold text-text-primary uppercase tracking-tight mb-8">Built for Velocity & Precision</motion.h2>
            <motion.p variants={fadeUp} className="font-sans text-text-secondary leading-relaxed mb-8">
              CANID relies on a state-of-the-art CNN architecture to detect canine facial landmarks and extract unalterable nose print topologies.
            </motion.p>
            <motion.div variants={fadeUp}>
              <Link href="/identify" className="font-mono text-accent-blue text-sm uppercase tracking-widest hover:text-[#3B82F6] flex items-center gap-2">
                TEST SYSTEM <span className="text-lg">→</span>
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ staggerChildren: 0.12 }}
            className="flex flex-col gap-6"
          >
            {[
              { icon: Smartphone, title: 'Zero Friction', desc: 'No app download required. Universal browser access.' },
              { icon: ShieldCheck, title: 'Cryptographic Privacy', desc: "Owner coordinates remain opaque until a >95% biometric match is established." },
            ].map(({ icon: Icon, title, desc }) => (
              <motion.div key={title} variants={fadeUp} className="bg-surface border border-border p-8 flex gap-6 hover:border-text-secondary transition-colors">
                <div className="w-12 h-12 bg-background border border-border flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold uppercase tracking-wide text-text-primary mb-2">{title}</h3>
                  <p className="font-sans text-text-secondary text-sm leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full border-t border-border bg-surface py-12 px-6 mt-auto">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-background border border-border flex items-center justify-center">
              <PawPrint className="w-4 h-4 text-text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-sm tracking-wide text-text-primary uppercase">CANID</span>
              <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Biometric Registry</span>
            </div>
          </div>
          <div className="flex gap-8">
            {[
              { label: 'IDENTIFY', href: '/identify' },
              { label: 'REGISTER', href: '/enroll' },
              { label: 'DASHBOARD', href: '/dashboard' },
              { label: 'GITHUB', href: 'https://github.com/SKKammar/DogNose', external: true },
            ].map(l => (
              <a
                key={l.label}
                href={l.href}
                target={l.external ? '_blank' : undefined}
                rel={l.external ? 'noopener noreferrer' : undefined}
                className="font-mono text-xs text-text-muted hover:text-text-primary transition-colors uppercase tracking-widest"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
