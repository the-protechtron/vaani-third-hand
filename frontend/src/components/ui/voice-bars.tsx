import { motion } from 'motion/react'
import { cn } from '../../lib/utils'

export type BarsState = 'off' | 'listening' | 'thinking' | 'speaking'

const HEIGHTS = [0.45, 0.8, 0.6, 1, 0.55, 0.85, 0.5]

/** Small live equaliser: calm when listening, lively when the agent speaks. */
export function VoiceBars({ state, className }: { state: BarsState; className?: string }) {
  const color = state === 'speaking' ? 'bg-speak' : state === 'listening' ? 'bg-live' : state === 'thinking' ? 'bg-accent' : 'bg-muted/40'
  return (
    <div aria-hidden className={cn('flex h-6 items-center gap-[3px]', className)}>
      {HEIGHTS.map((h, i) => (
        <motion.span
          key={i}
          className={cn('w-[3px] rounded-full', color)}
          style={{ height: 24 }}
          animate={
            state === 'speaking'
              ? { scaleY: [0.2, h, 0.3, h * 0.8, 0.2] }
              : state === 'thinking'
                ? { scaleY: [0.2, 0.5, 0.2], opacity: [0.5, 1, 0.5] }
                : state === 'listening'
                  ? { scaleY: [0.16, 0.28, 0.16] }
                  : { scaleY: 0.14 }
          }
          transition={
            state === 'off'
              ? { duration: 0.2 }
              : { duration: state === 'speaking' ? 0.9 : 1.6, repeat: Infinity, delay: i * 0.08, ease: 'easeInOut' }
          }
        />
      ))}
    </div>
  )
}
