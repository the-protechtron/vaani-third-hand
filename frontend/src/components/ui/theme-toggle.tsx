import { motion } from 'motion/react'
import { useTheme } from '../../theme'

/** Light / dark switch. Sun and moon swap with a small spring on the thumb. */
export function ThemeToggle() {
  const theme = useTheme((s) => s.theme)
  const toggle = useTheme((s) => s.toggle)
  const dark = theme === 'dark'

  return (
    <button
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      onClick={toggle}
      className="relative flex h-9 w-[68px] shrink-0 items-center rounded-full border border-border bg-surface-2 px-1 outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`absolute h-7 w-7 rounded-full bg-surface shadow ring-1 ring-border ${dark ? 'right-1' : 'left-1'}`}
      />
      <span className={`relative z-10 flex h-7 w-7 items-center justify-center ${dark ? 'text-muted' : 'text-accent'}`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>
      <span className={`relative z-10 ml-auto flex h-7 w-7 items-center justify-center ${dark ? 'text-accent' : 'text-muted'}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </span>
    </button>
  )
}
