'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const links = session
    ? [
        { href: '/', label: 'Home' },
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/identify', label: 'Scan' },
        { href: '/enroll', label: 'Register' },
      ]
    : [
        { href: '/', label: 'Home' },
        { href: '/identify', label: 'Scan' },
        { href: '/enroll', label: 'Register' },
        { href: '/login', label: 'Log in' },
      ]

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href)

  return (
    <nav className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-display font-bold text-base tracking-tight text-text-primary"
        >
          CANID
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors duration-150 border-b-2 pb-0.5 ${
                isActive(l.href)
                  ? 'text-text-primary border-accent'
                  : 'text-text-muted border-transparent hover:text-text-primary'
              }`}
            >
              {l.label}
            </Link>
          ))}
          {session && (
            <button
              onClick={signOut}
              className="text-sm font-medium text-text-muted hover:text-text-primary transition-colors duration-150"
            >
              Log out
            </button>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden btn-icon"
          aria-label="Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            {mobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`py-3 text-sm font-medium border-b border-border last:border-0 ${
                  isActive(l.href) ? 'text-text-primary' : 'text-text-muted'
                }`}
              >
                {l.label}
              </Link>
            ))}
            {session && (
              <button
                onClick={signOut}
                className="py-3 text-sm font-medium text-left text-text-muted border-t border-border"
              >
                Log out
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
