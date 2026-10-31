import { motion } from 'motion/react'
import { cn } from '../../lib/utils'

export interface TabItem {
  id: string
  label: string
}

/** Aceternity "Tabs": the active pill slides between options (shared layoutId). */
export function AnimatedTabs({
  tabs,
  active,
  onChange,
  label,
  className,
}: {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
  label: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-surface-2 p-1 [scrollbar-width:none]', className)}
    >
      {tabs.map((t) => {
        const on = t.id === active
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className="relative shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {on && (
              <motion.span
                layoutId="machine-pill"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                className="absolute inset-0 rounded-full bg-surface shadow-sm ring-1 ring-border"
              />
            )}
            <span className={cn('relative z-10 transition-colors', on ? 'text-fg' : 'text-muted hover:text-fg')}>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
