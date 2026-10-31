const c = (v) => `rgb(var(--${v}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Krub everywhere; `font-serif` (headings) maps to it too
        sans: ['Krub', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Krub', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        'surface-2': c('surface-2'),
        border: c('border'),
        fg: c('fg'),
        muted: c('muted'),
        accent: c('accent'),
        live: c('live'),
        speak: c('speak'),
      },
      keyframes: {
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgb(var(--speak) / .45)' }, '100%': { boxShadow: '0 0 0 10px rgb(var(--speak) / 0)' } },
        spotlight: { '0%': { opacity: 0, transform: 'translate(-72%, -62%) scale(0.5)' }, '100%': { opacity: 1, transform: 'translate(-50%,-40%) scale(1)' } },
      },
      animation: {
        'pulse-ring': 'pulseRing 1.1s ease-out infinite',
        spotlight: 'spotlight 2s ease .75s 1 forwards',
      },
    },
  },
  plugins: [],
}
