'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { PawPrint, Menu, X, ScanFace, LayoutDashboard, LogIn, UserPlus, LogOut, ChevronDown } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Navbar() {
  const pathname = usePathname()
  const [session, setSession] = useState<any>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [pathname])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href)

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[var(--color-bg)]/95 backdrop-blur-md border-b border-[var(--color-border)]'
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center group-hover:bg-[var(--color-accent)]/20 transition-colors">
              <PawPrint className="w-4 h-4 text-[var(--color-accent)]" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-[var(--color-text)]">
              CANID
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink href="/identify" active={isActive('/identify')} icon={<ScanFace className="w-4 h-4" />}>
              Scan
            </NavLink>
            {session && (
              <NavLink href="/dashboard" active={isActive('/dashboard')} icon={<LayoutDashboard className="w-4 h-4" />}>
                Dashboard
              </NavLink>
            )}
          </div>

          {/* Desktop Right */}
          <div className="hidden md:flex items-center gap-3">
            {session ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-hover)] bg-[var(--color-surface)] transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent)] text-xs font-bold">
                    {session.user.email?.[0].toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm text-[var(--color-text-secondary)] max-w-[120px] truncate">
                    {session.user.email}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[var(--color-muted)] transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 mt-2 w-52 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl z-20 overflow-hidden">
                      <div className="px-4 py-3 border-b border-[var(--color-border)]">
                        <p className="text-xs text-[var(--color-muted)] truncate">{session.user.email}</p>
                      </div>
                      <Link
                        href="/dashboard"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                      </Link>
                      <Link
                        href="/enroll"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                      >
                        <UserPlus className="w-4 h-4" /> Register Dog
                      </Link>
                      <div className="border-t border-[var(--color-border)] mt-1">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-[var(--color-error)] hover:bg-[var(--color-error)]/5 transition-colors"
                        >
                          <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" className="btn-ghost text-sm py-2 px-4">
                  Sign In
                </Link>
                <Link href="/login" className="btn-primary text-sm py-2 px-4">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] rounded-lg hover:bg-[var(--color-surface)] transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-0 right-0 bottom-0 w-72 bg-[var(--color-surface)] border-l border-[var(--color-border)] flex flex-col p-6 pt-20">
            <div className="flex flex-col gap-1 flex-1">
              <MobileNavLink href="/identify" icon={<ScanFace className="w-4 h-4" />} active={isActive('/identify')}>Scan a Dog</MobileNavLink>
              {session && (
                <MobileNavLink href="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} active={isActive('/dashboard')}>Dashboard</MobileNavLink>
              )}
              {session && (
                <MobileNavLink href="/enroll" icon={<UserPlus className="w-4 h-4" />} active={isActive('/enroll')}>Register Dog</MobileNavLink>
              )}
            </div>

            <div className="border-t border-[var(--color-border)] pt-4">
              {session ? (
                <>
                  <p className="text-xs text-[var(--color-muted)] mb-3 truncate">{session.user.email}</p>
                  <button onClick={handleSignOut} className="btn-ghost w-full text-[var(--color-error)] border-[var(--color-error)]/20 hover:bg-[var(--color-error)]/5">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href="/login" className="btn-ghost w-full justify-center"><LogIn className="w-4 h-4" /> Sign In</Link>
                  <Link href="/login" className="btn-primary w-full justify-center">Get Started</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spacer so content doesn't hide under fixed nav */}
      <div className="h-16" />
    </>
  )
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]'
      }`}
    >
      {icon}{children}
    </Link>
  )
}

function MobileNavLink({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
        active
          ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
      }`}
    >
      {icon}{children}
    </Link>
  )
}
