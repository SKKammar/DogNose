import './globals.css'
import type { Metadata } from 'next'
import { Inter, Syne, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import Navbar from '@/app/components/Navbar'

const inter = Inter({ subsets: ['latin'], variable: '--font-body' })
const syne = Syne({ subsets: ['latin'], variable: '--font-display' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'DogNose',
  description: 'DogNose — biometric dog identification by nose print.',
  manifest: '/manifest.json',
  themeColor: '#0A0E14',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${inter.variable} ${syne.variable} ${jetbrains.variable}`}>
        <Navbar />
        <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col items-center">
          {children}
        </main>
        <Toaster position="bottom-right" theme="dark" toastOptions={{
          style: {
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)'
          }
        }} />
      </body>
    </html>
  )
}
