'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

export default function AppHeader() {
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <header className="w-full flex justify-between items-center p-6 max-w-2xl mx-auto absolute top-0 left-0 right-0 z-50">
      <Link href="/" className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
        CANID
      </Link>
      {session ? (
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 hidden sm:inline truncate max-w-[160px]">
            {session.user?.email}
          </span>
          <button 
            onClick={() => supabase.auth.signOut()} 
            className="text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <Link 
          href="/login" 
          className="text-sm font-medium px-4 py-1.5 rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          Sign In
        </Link>
      )}
    </header>
  )
}
