'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { PawPrint, Menu, X, ScanFace, LayoutDashboard, LogIn, UserPlus, LogOut, ChevronDown } from 'lucide-react'

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
          ? 'bg-background border-b border-border'
          : 'bg-background border-b border-border md:border-transparent md:bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-8 h-8 bg-surface border border-border flex items-center justify-center group-hover:border-accent-blue transition-colors">
              <PawPrint className="w-4 h-4 text-text-primary" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-text-primary uppercase">
              CANID
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
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
          <div className="hidden md:flex items-center gap-4">
            {session ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-3 px-4 py-2 border border-border hover:border-text-secondary bg-surface transition-colors"
                >
                  <div className="w-5 h-5 bg-accent-blue flex items-center justify-center text-background text-xs font-bold font-mono">
                    {session.user.email?.[0].toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm font-mono text-text-primary max-w-[140px] truncate">
                    {session.user.email}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-surface border border-border shadow-brutalist z-20 flex flex-col">
                      <div className="px-4 py-3 border-b border-border bg-background">
                        <p className="text-xs font-mono text-text-muted truncate">{session.user.email}</p>
                      </div>
                      <Link
                        href="/dashboard"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                      </Link>
                      <Link
                        href="/enroll"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                      >
                        <UserPlus className="w-4 h-4" /> Register Dog
                      </Link>
                      <div className="border-t border-border">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm text-accent-red hover:bg-background transition-colors"
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
                <Link href="/login" className="text-sm font-sans font-semibold text-text-secondary hover:text-text-primary px-2 transition-colors">
                  Sign In
                </Link>
                <Link href="/login" className="btn-primary text-sm px-5 py-2">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-text-primary border border-transparent hover:border-border transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex justify-end">
          <div className="absolute inset-0 bg-background/90" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 bg-surface border-l border-border flex flex-col pt-20 h-full shadow-brutalist">
            <div className="flex flex-col flex-1 px-4 gap-2">
              <MobileNavLink href="/identify" icon={<ScanFace className="w-4 h-4" />} active={isActive('/identify')}>Scan a Dog</MobileNavLink>
              {session && (
                <MobileNavLink href="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} active={isActive('/dashboard')}>Dashboard</MobileNavLink>
              )}
              {session && (
                <MobileNavLink href="/enroll" icon={<UserPlus className="w-4 h-4" />} active={isActive('/enroll')}>Register Dog</MobileNavLink>
              )}
            </div>

            <div className="border-t border-border p-4 mt-auto">
              {session ? (
                <>
                  <p className="text-xs font-mono text-text-muted mb-4 truncate">{session.user.email}</p>
                  <button onClick={handleSignOut} className="w-full flex items-center justify-center gap-2 border border-border text-accent-red py-3 hover:bg-background transition-colors font-sans font-semibold">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <Link href="/login" className="w-full flex items-center justify-center gap-2 border border-border text-text-primary py-3 hover:bg-background transition-colors font-sans font-semibold"><LogIn className="w-4 h-4" /> Sign In</Link>
                  <Link href="/login" className="btn-primary w-full py-3">Get Started</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="h-16" />
    </>
  )
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 text-sm font-sans font-medium transition-all border-b-2 py-5 ${
        active
          ? 'text-accent-blue border-accent-blue'
          : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border'
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
      className={`flex items-center gap-3 px-4 py-3 text-sm font-sans font-medium transition-colors border-l-2 ${
        active
          ? 'text-accent-blue border-accent-blue bg-background'
          : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-background'
      }`}
    >
      {icon}{children}
    </Link>
  )
}
