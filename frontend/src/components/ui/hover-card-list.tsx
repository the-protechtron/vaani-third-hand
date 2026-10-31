import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '../../lib/utils'

/** Aceternity "Card Hover Effect": one soft highlight glides between the items. */
export function HoverCardList<T>({
  items,
  render,
  keyOf,
  className,
}: {
  items: T[]
  render: (item: T, index: number) => ReactNode
  keyOf: (item: T, index: number) => string
  className?: string
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  return (
    <div className={cn('flex flex-col', className)}>
      {items.map((item, i) => {
        const k = keyOf(item, i)
        return (
          <div
            key={k}
            className="relative"
            onMouseEnter={() => setHovered(k)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(k)}
            onBlur={() => setHovered(null)}
          >
            <AnimatePresence>
              {hovered === k && (
                <motion.span
                  layoutId="hover-bg"
                  className="absolute inset-0 rounded-xl bg-surface-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.15 } }}
                  exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.1 } }}
                />
              )}
            </AnimatePresence>
            <div className="relative z-10">{render(item, i)}</div>
          </div>
        )
      })}
    </div>
  )
}
