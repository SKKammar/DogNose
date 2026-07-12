'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, ScanFace, AlertTriangle, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { listDogs } from '../lib/api'
import AppHeader from './components/AppHeader'

interface Dog {
  id: string;
  name: string;
  breed?: string;
  nose_print_count: number;
}

export default function HomePage() {
  const [session, setSession] = useState<any>(null)
  const [dogs, setDogs] = useState<Dog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchDogs(session.access_token)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchDogs(session.access_token)
      else {
        setDogs([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchDogs = async (token: string) => {
    try {
      const data = await listDogs(token)
      setDogs(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500">Loading...</div>
  }

  return (
    <>
      <AppHeader />
      <div className="flex flex-col items-center justify-center min-h-screen p-6 pt-24 max-w-2xl mx-auto w-full relative z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>

      {session ? (
        <div className="w-full flex flex-col pt-4 pb-24">
          <div className="flex justify-between items-center mb-10">
            <h1 className="text-3xl font-bold text-zinc-100">Your Dogs</h1>
          </div>
          
          <div className="grid grid-cols-1 gap-4 mb-8">
            {dogs.length === 0 ? (
              <div className="text-center p-8 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <p className="text-zinc-400 mb-4">No dogs registered yet.</p>
                <Link href="/enroll" className="text-blue-400 hover:text-blue-300 font-medium transition">
                  Enroll your first dog →
                </Link>
              </div>
            ) : (
              dogs.map(dog => (
                <div key={dog.id} className="bg-zinc-900/50 backdrop-blur-md p-6 rounded-[2rem] border border-zinc-800 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-zinc-200">{dog.name}</h2>
                    {dog.breed && <p className="text-zinc-500 text-sm">{dog.breed}</p>}
                    <p className="text-zinc-600 text-xs mt-1">
                      {dog.nose_print_count} nose print{dog.nose_print_count !== 1 ? 's' : ''} enrolled
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-auto">
            <Link href="/enroll" className="flex items-center justify-center gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition">
              <Camera size={20} className="text-blue-400" />
              <span className="font-medium text-zinc-200">Enroll New Dog</span>
            </Link>
            <Link href="/identify" className="flex items-center justify-center gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition">
              <ScanFace size={20} className="text-emerald-400" />
              <span className="font-medium text-zinc-200">Identify a Dog</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <h1 className="text-6xl font-extrabold mb-6 text-center tracking-tight bg-gradient-to-br from-zinc-100 to-zinc-500 bg-clip-text text-transparent">
            CANID
          </h1>
          <p className="text-lg text-zinc-400 mb-10 text-center font-light leading-relaxed">
            Just like a human fingerprint, every dog&apos;s nose print is completely unique. Our system identifies dogs instantly with a single scan.
          </p>

          <div className="bg-zinc-900/50 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-zinc-800/50 mb-12 w-full relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
            <h2 className="text-xl font-semibold mb-4 text-zinc-200">How it works</h2>
            <ol className="list-decimal list-inside space-y-3 text-zinc-400 font-light">
              <li><strong className="text-zinc-200 font-medium">Enroll:</strong> Capture a clear photo of your dog&apos;s nose to extract the biometric signature.</li>
              <li><strong className="text-zinc-200 font-medium">Identify:</strong> Scan a dog later to match against the secure database.</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mb-8">
            <Link 
              href="/enroll"
              className="group relative flex flex-col items-center justify-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl hover:border-blue-500/50 transition-all duration-500 overflow-hidden"
            >
              <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <Camera size={36} className="mb-4 text-blue-400 group-hover:scale-110 transition-transform duration-500" strokeWidth={1.5} />
              <span className="font-semibold text-lg text-zinc-200 tracking-wide">➕ Enroll Dog</span>
            </Link>
            <Link 
              href="/identify"
              className="group relative flex flex-col items-center justify-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl hover:border-emerald-500/50 transition-all duration-500 overflow-hidden"
            >
              <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <ScanFace size={36} className="mb-4 text-emerald-400 group-hover:scale-110 transition-transform duration-500" strokeWidth={1.5} />
              <span className="font-semibold text-lg text-zinc-200 tracking-wide">🔍 Identify Dog</span>
            </Link>
          </div>
        </>
      )}
    </div>
    </>
  )
}
