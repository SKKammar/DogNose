'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, ScanLine, Heart } from 'lucide-react'
import { API_URL } from '../lib/api'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const [stats, setStats] = useState({ registered_dogs: 0, matches_made: 0 })
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    fetch(`${API_URL}/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-6">
      {/* Hero */}
      <section className="py-24 md:py-32">
        <p className="font-mono text-xs uppercase tracking-wider text-text-muted mb-6">
          A nose print registry for dogs
        </p>
        <h1 className="font-display text-5xl md:text-6xl font-bold text-text-primary leading-[1.05] tracking-tight max-w-3xl mb-8">
          Every dog has a nose print.
          <br />
          <span className="text-text-secondary">Now they have an identity.</span>
        </h1>
        <p className="text-base text-text-secondary max-w-xl mb-10 leading-relaxed">
          Register your dog&apos;s nose print once. If they ever go missing, anyone
          who finds them can scan their nose and reach you in seconds.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/identify" className="btn-primary">
            Scan a dog
          </Link>
          <Link href="/enroll" className="btn-secondary">
            Register your dog
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-b border-border py-8 grid grid-cols-2 gap-8">
        <div>
          <p className="font-display text-3xl font-bold text-text-primary tabular-nums">
            {stats.registered_dogs.toLocaleString()}
          </p>
          <p className="text-xs font-mono uppercase tracking-wider text-text-muted mt-1">
            Dogs registered
          </p>
        </div>
        <div>
          <p className="font-display text-3xl font-bold text-text-primary tabular-nums">
            {stats.matches_made.toLocaleString()}
          </p>
          <p className="text-xs font-mono uppercase tracking-wider text-text-muted mt-1">
            Times matched
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <h2 className="font-display text-2xl font-bold text-text-primary mb-12">
          How it works
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              n: '01',
              icon: Camera,
              title: 'Scan the nose',
              body: 'Take one clear photo of the dog\'s nose. Works on any phone.',
            },
            {
              n: '02',
              icon: ScanLine,
              title: 'We find the match',
              body: 'The nose print is compared against every registered dog in the registry.',
            },
            {
              n: '03',
              icon: Heart,
              title: 'Reach the owner',
              body: 'Get the owner\'s phone, health flags, and care notes — instantly.',
            },
          ].map((s) => (
            <div key={s.n}>
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-xs text-text-muted">{s.n}</span>
                <s.icon className="w-4 h-4 text-accent" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-base font-bold text-text-primary mb-2">
                {s.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What you get */}
      <section className="border-t border-border py-20">
        <h2 className="font-display text-2xl font-bold text-text-primary mb-12">
          What a finder sees
        </h2>
        <div className="grid md:grid-cols-3 gap-px bg-border border border-border rounded-md overflow-hidden">
          {[
            {
              title: 'Health alerts',
              body: 'Severe allergies and overdue vaccines surface before anything else.',
            },
            {
              title: 'Care notes',
              body: 'Whether the dog is friendly, nervous, or shouldn\'t be approached.',
            },
            {
              title: 'Direct contact',
              body: 'The owner\'s phone with a single tap to call, plus backup contacts.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-surface p-8">
              <h3 className="font-display text-base font-bold text-text-primary mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <p className="font-display font-bold text-text-primary mb-1">CANID</p>
          <p className="text-xs text-text-muted max-w-xs leading-relaxed">
            A learning project. Not a substitute for a microchip or a collar tag.
          </p>
        </div>
        <nav className="flex flex-wrap gap-6 text-xs text-text-muted">
          <Link href="/identify" className="hover:text-text-primary transition-colors">Scan</Link>
          <Link href="/enroll" className="hover:text-text-primary transition-colors">Register</Link>
          {session ? (
            <Link href="/dashboard" className="hover:text-text-primary transition-colors">Dashboard</Link>
          ) : (
            <Link href="/login" className="hover:text-text-primary transition-colors">Log in</Link>
          )}
          <a
            href="https://github.com/SKKammar/DogNose"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-primary transition-colors"
          >
            GitHub
          </a>
        </nav>
      </footer>
    </div>
  )
}
