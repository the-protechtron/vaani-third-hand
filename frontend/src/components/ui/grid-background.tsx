import { cn } from '../../lib/utils'

/** Aceternity "Grid Background": a faint grid that fades out towards the edges. */
export function GridBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      <div
        className="absolute inset-0 [background-size:36px_36px] [background-image:linear-gradient(to_right,rgb(var(--border)/.7)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--border)/.7)_1px,transparent_1px)]"
      />
      <div className="absolute inset-0 bg-surface [mask-image:radial-gradient(ellipse_at_center,transparent_25%,black)]" />
    </div>
  )
}
