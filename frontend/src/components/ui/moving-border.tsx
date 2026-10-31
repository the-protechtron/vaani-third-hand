import React, { useRef } from 'react'
import { motion, useAnimationFrame, useMotionTemplate, useMotionValue, useTransform } from 'motion/react'
import { cn } from '../../lib/utils'

/** Aceternity "Moving Border" button: a glowing dot orbits the button outline. */
export function MovingBorderButton({
  children,
  duration = 3000,
  tone = 'accent',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { duration?: number; tone?: 'accent' | 'danger' }) {
  const glow = tone === 'danger' ? 'bg-[radial-gradient(#ef4444_40%,transparent_60%)]' : 'bg-[radial-gradient(rgb(var(--accent))_40%,transparent_60%)]'
  return (
    <button
      {...props}
      className={cn(
        'relative inline-flex h-10 overflow-hidden rounded-xl bg-transparent p-px text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60',
        className,
      )}
    >
      <div className="absolute inset-0" style={{ borderRadius: 'calc(0.75rem * 0.96)' }}>
        <MovingBorder duration={duration} rx="30%" ry="30%">
          <div className={cn('h-16 w-16 opacity-90', glow)} />
        </MovingBorder>
      </div>
      <span
        className="relative flex h-full w-full items-center justify-center gap-2 rounded-[calc(0.75rem*0.96)] border border-border bg-surface px-5 text-fg backdrop-blur-xl transition-colors hover:bg-surface-2"
      >
        {children}
      </span>
    </button>
  )
}

function MovingBorder({
  children,
  duration = 3000,
  rx,
  ry,
}: {
  children: React.ReactNode
  duration?: number
  rx?: string
  ry?: string
}) {
  const pathRef = useRef<SVGRectElement | null>(null)
  const progress = useMotionValue(0)

  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength()
    if (length) progress.set(((time * (length / duration)) % length))
  })

  const x = useTransform(progress, (v) => pathRef.current?.getPointAtLength(v).x ?? 0)
  const y = useTransform(progress, (v) => pathRef.current?.getPointAtLength(v).y ?? 0)
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`

  return (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="absolute h-full w-full" width="100%" height="100%" aria-hidden>
        <rect fill="none" width="100%" height="100%" rx={rx} ry={ry} ref={pathRef} />
      </svg>
      <motion.div style={{ position: 'absolute', top: 0, left: 0, display: 'inline-block', transform }}>{children}</motion.div>
    </>
  )
}
