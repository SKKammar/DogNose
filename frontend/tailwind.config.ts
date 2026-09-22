import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0E14', // Deep Onyx
        surface: '#111620',    // Matte Charcoal
        border: '#1E2736',     // Hairline separator
        accent: {
          blue: '#4F9CF9',     // Electric Cobalt
          'blue-dark': '#3B8AE8', // Darker blue for active state
          green: '#34D399',    // Safety Green
          red: '#EF4444',      // Error
          amber: '#F59E0B',    // Warn
        },
        text: {
          primary: '#F3F4F6',  // High contrast white/gray
          secondary: '#9CA3AF',// Calm reading text
          muted: '#6B7280',    // Technical meta text
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        sans: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        brutalist: '4px 4px 0px 0px rgba(0,0,0,1)', // Solid, harsh shadow
        none: 'none',
      },
      borderRadius: {
        'sm': '2px',
        'DEFAULT': '4px', // Hard, barely rounded corners
      }
    }
  },
  plugins: [],
}
export default config
