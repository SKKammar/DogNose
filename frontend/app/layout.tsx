import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter, Syne, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import Navbar from './components/Navbar'

const inter = Inter({ subsets: ['latin'], variable: '--font-body' })
const syne = Syne({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700'] })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'CANID',
  description: 'A nose print registry for dogs.',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#F8FAFC',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Prevents input zoom on iOS which breaks the UI
  userScalable: false,
  viewportFit: 'cover', // Required for notch support
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${syne.variable} ${jetbrains.variable}`}>
        <Navbar />
        <main className="min-h-[calc(100vh-64px)]">{children}</main>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#131722',
              border: '1px solid #232936',
              color: '#E8EDF5',
              borderRadius: '6px',
              fontSize: '13px',
            },
          }}
        />
      </body>
    </html>
  )
}
