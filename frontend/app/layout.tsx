import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CANID',
  description: 'CANID — biometric dog identification by nose print.',
  manifest: '/manifest.json',
  themeColor: '#09090b',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className={inter.className}>
        <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center">
          {children}
        </main>
      </body>
    </html>
  )
}
