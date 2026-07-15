'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Menu, X, PawPrint } from 'lucide-react'

// Lightweight supabase client just for auth state
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function Navbar() {
  const pathname = usePathname()
  const [session, setSession] = useState<any>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const navLinks = session
    ? [
        { name: 'Scan', href: '/identify' },
        { name: 'Dashboard', href: '/dashboard' },
      ]
    : [
        { name: 'Scan', href: '/identify' },
        { name: 'Register', href: '/enroll' },
        { name: 'Sign In', href: '/login' },
      ]

  return (
    <nav className="w-full bg-[var(--color-bg)] border-b border-[var(--color-border)] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <PawPrint className="w-6 h-6 text-[var(--color-accent)] group-hover:scale-110 transition-transform" />
              <span className="font-display font-bold text-xl tracking-tight text-[var(--color-accent)]">
                DogNose
              </span>
            </Link>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex space-x-8 items-center">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)] py-1'
                    : 'text-[var(--color-text)] hover:text-[var(--color-accent)]'
                }`}
              >
                {link.name}
              </Link>
            ))}
            {session && (
              <div className="relative group">
                <button className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors">
                  {session.user.email?.[0].toUpperCase() || 'U'}
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-lg py-1 hidden group-hover:block">
                  <div className="px-4 py-2 text-xs text-[var(--color-muted)] border-b border-[var(--color-border)] truncate">
                    {session.user.email}
                  </div>
                  <Link href="/dashboard" className="block px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg)] hover:text-[var(--color-accent)]">Dashboard</Link>
                  <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 text-sm text-[var(--color-error)] hover:bg-[var(--color-bg)]">Sign Out</button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-[var(--color-text)] hover:text-[var(--color-accent)] focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[var(--color-surface)] border-b border-[var(--color-border)] absolute w-full left-0 shadow-xl">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === link.href
                    ? 'text-[var(--color-accent)] bg-[var(--color-bg)]'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-bg)]'
                }`}
              >
                {link.name}
              </Link>
            ))}
            {session && (
              <button
                onClick={handleSignOut}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-[var(--color-error)] hover:bg-[var(--color-bg)]"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
