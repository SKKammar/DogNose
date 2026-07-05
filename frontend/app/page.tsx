import Link from 'next/link'
import { Camera, ScanFace } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-2xl mx-auto w-full relative z-10">
      
      {/* Cinematic glow effect behind the text */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>

      <h1 className="text-5xl font-extrabold mb-6 text-center tracking-tight bg-gradient-to-br from-zinc-100 to-zinc-500 bg-clip-text text-transparent">
        Biometric Identity
      </h1>
      <p className="text-lg text-zinc-400 mb-10 text-center font-light leading-relaxed">
        Just like a human fingerprint, every dog's nose print is completely unique. Our system identifies dogs instantly with a single scan.
      </p>

      <div className="bg-zinc-900/50 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-zinc-800/50 mb-12 w-full relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
        <h2 className="text-xl font-semibold mb-4 text-zinc-200">How it works</h2>
        <ol className="list-decimal list-inside space-y-3 text-zinc-400 font-light">
          <li><strong className="text-zinc-200 font-medium">Enroll:</strong> Capture a clear photo of your dog's nose to extract the biometric signature.</li>
          <li><strong className="text-zinc-200 font-medium">Identify:</strong> Scan a dog later to match against the secure database.</li>
        </ol>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
        <Link 
          href="/enroll"
          className="group relative flex flex-col items-center justify-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl hover:border-blue-500/50 transition-all duration-500 overflow-hidden"
        >
          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <Camera size={36} className="mb-4 text-blue-400 group-hover:scale-110 transition-transform duration-500" strokeWidth={1.5} />
          <span className="font-semibold text-lg text-zinc-200 tracking-wide">Enroll Dog</span>
        </Link>
        <Link 
          href="/identify"
          className="group relative flex flex-col items-center justify-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl hover:border-emerald-500/50 transition-all duration-500 overflow-hidden"
        >
          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <ScanFace size={36} className="mb-4 text-emerald-400 group-hover:scale-110 transition-transform duration-500" strokeWidth={1.5} />
          <span className="font-semibold text-lg text-zinc-200 tracking-wide">Identify Dog</span>
        </Link>
      </div>
    </div>
  )
}
