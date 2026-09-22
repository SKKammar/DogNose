'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ScanFace, Camera, ShieldCheck, Smartphone, ArrowRight, PawPrint } from 'lucide-react'
import { motion } from 'framer-motion'
import { API_URL } from '../lib/api'

interface Stats {
  registered_dogs: number
  matches_made: number
  owners_reunited: number
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 }
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({ registered_dogs: 0, matches_made: 0, owners_reunited: 0 })

  useEffect(() => {
    fetch(`${API_URL}/stats`)
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {})
  }, [])

  return (
    <div className="flex flex-col w-full">

      {/* HERO */}
      <section className="relative w-full min-h-[92vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[var(--color-accent)]/5 blur-[120px]" />
          <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] rounded-full bg-[var(--color-accent-2)]/5 blur-[80px]" />
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.15 }}
          className="relative z-10 max-w-4xl mx-auto"
        >
          <motion.div variants={fadeUp} className="mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs font-semibold uppercase tracking-wider font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
              Biometric Dog Registry
            </span>
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-bold font-display tracking-tight mb-6 leading-[1.05]">
            Every Nose.<br />
            <span className="text-[var(--color-accent)]">One Identity.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-lg md:text-xl text-[var(--color-muted)] mb-10 max-w-2xl mx-auto font-light leading-relaxed">
            A biometric registry for dogs. Just like a human fingerprint, every dog&apos;s nose pattern is completely unique.
            Enroll once. Identify anywhere.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/identify" className="btn-primary text-base py-3.5 px-8 rounded-xl shadow-[var(--shadow-accent)]">
              <ScanFace className="w-5 h-5" />
              Scan a Dog
            </Link>
            <Link href="/enroll" className="btn-ghost text-base py-3.5 px-8 rounded-xl">
              <Camera className="w-5 h-5" />
              Register Your Dog
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div variants={fadeUp} className="grid grid-cols-3 gap-6 max-w-lg mx-auto pt-8 border-t border-[var(--color-border)]">
            {[
              { value: stats.registered_dogs, label: 'Dogs Registered' },
              { value: stats.matches_made, label: 'Matches Made' },
              { value: stats.owners_reunited, label: 'Owners Reunited' },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center gap-1">
                <span className="text-3xl font-display font-bold text-[var(--color-text)]">{s.value}</span>
                <span className="text-xs text-[var(--color-muted)] text-center">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <section className="w-full py-24 px-6 bg-[var(--color-surface)] border-y border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ staggerChildren: 0.1 }}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} className="text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-accent)] mb-3">How It Works</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold font-display">Three steps to identify any dog</motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            transition={{ staggerChildren: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 relative"
          >
            <div className="hidden md:block absolute top-10 left-[18%] right-[18%] h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
            {[
              { icon: Camera, step: '01', title: 'Snap', desc: "Take a clear photo of the dog's nose from 15–20 cm away." },
              { icon: ScanFace, step: '02', title: 'Match', desc: 'Our AI extracts a biometric signature and searches the entire registry instantly.' },
              { icon: PawPrint, step: '03', title: 'Reunite', desc: "Get the owner's contact details directly — no middleman, no delay." },
            ].map(({ icon: Icon, step, title, desc }) => (
              <motion.div key={step} variants={fadeUp} className="flex flex-col items-center text-center group">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center group-hover:border-[var(--color-accent)] group-hover:shadow-[var(--shadow-accent)] transition-all duration-300">
                    <Icon className="w-8 h-8 text-[var(--color-accent)]" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-mono font-bold flex items-center justify-center">{step}</span>
                </div>
                <h3 className="text-xl font-bold mb-2">{title}</h3>
                <p className="text-[var(--color-muted)] text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="w-full py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ staggerChildren: 0.1 }}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} className="text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-accent)] mb-3">Built for real emergencies</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold font-display">Designed for speed when it matters most</motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            transition={{ staggerChildren: 0.12 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {[
              { icon: Smartphone, title: 'Works anywhere', desc: 'Identify requires no account, works on any smartphone browser, and returns results in under 3 seconds.' },
              { icon: ShieldCheck, title: 'Privacy first', desc: "Owner contact info is only revealed when a positive biometric match is made. Your data is secure." },
            ].map(({ icon: Icon, title, desc }) => (
              <motion.div key={title} variants={fadeUp} className="card card-lift p-8 flex gap-5">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2">{title}</h3>
                  <p className="text-[var(--color-muted)] text-sm leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="w-full py-20 px-6 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ staggerChildren: 0.1 }}
          className="max-w-2xl mx-auto text-center"
        >
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold font-display mb-4">Ready to secure your dog&apos;s identity?</motion.h2>
          <motion.p variants={fadeUp} className="text-[var(--color-muted)] mb-8">Enrollment takes under 2 minutes. Your dog&apos;s nose print is stored securely and matched in seconds.</motion.p>
          <motion.div variants={fadeUp}>
            <Link href="/enroll" className="btn-primary text-base py-3.5 px-8 rounded-xl inline-flex">
              Register Your Dog <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="w-full border-t border-[var(--color-border)] py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <PawPrint className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="font-display font-bold text-sm text-[var(--color-text)]">CANID</span>
            <span className="text-xs text-[var(--color-muted)] ml-2">Biometric Dog Registry</span>
          </div>
          <div className="flex gap-6">
            {[
              { label: 'Identify', href: '/identify' },
              { label: 'Register', href: '/enroll' },
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'GitHub', href: 'https://github.com/SKKammar/DogNose', external: true },
            ].map(l => (
              <a
                key={l.label}
                href={l.href}
                target={l.external ? '_blank' : undefined}
                rel={l.external ? 'noopener noreferrer' : undefined}
                className="text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>
          <p className="text-xs text-[var(--color-muted)]">© 2026 CANID. For learning purposes only.</p>
        </div>
      </footer>
    </div>
  )
}
