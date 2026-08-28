/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#040711',
          panel: '#0a0f1d',
          card: '#0f172a',
          border: 'rgba(59, 130, 246, 0.15)',
          cyan: '#00f0ff',
          neonBlue: '#3b82f6',
          emerald: '#00ff9d',
          crimson: '#ff0055',
          amber: '#ffb700',
          purple: '#a855f7'
        }
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace']
      },
      boxShadow: {
        'neon-blue': '0 0 20px rgba(59, 130, 246, 0.35)',
        'neon-cyan': '0 0 20px rgba(0, 240, 255, 0.35)',
        'neon-red': '0 0 20px rgba(255, 0, 85, 0.45)',
        'neon-green': '0 0 20px rgba(0, 255, 157, 0.35)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar': 'radar 4s linear infinite',
      },
      keyframes: {
        radar: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      }
    },
  },
  plugins: [],
}
