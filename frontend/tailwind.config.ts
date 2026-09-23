import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
        colors: {
          background: '#F8FAFC', // Slate 50
          surface: {
            DEFAULT: '#FFFFFF',
            raised: '#F1F5F9',  // Slate 100
          },
          border: {
            DEFAULT: '#CBD5E1', // Slate 300 - Much sharper structural lines
            strong: '#94A3B8',  // Slate 400 - For heavy separation
          },
          text: {
            primary: '#020617', // Slate 950 - Near Pitch Black
            secondary: '#334155', // Slate 700 - Very dark grey for readabilty
            muted: '#64748B', // Slate 500 - Deep enough to read in sunlight
          },
          accent: {
            DEFAULT: '#2563EB', // Blue 600 - Deeper, punchier blue
            hover: '#1D4ED8', // Blue 700
            soft: 'rgba(37, 99, 235, 0.1)',
          },
          success: '#059669', // Emerald 600 - High contrast green
          warn: '#D97706', // Amber 600 - Burnt orange instead of yellow
          error: '#DC2626', // Red 600 - Unmissable red
        },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        md: '6px',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
