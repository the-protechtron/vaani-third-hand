import { useId } from 'react'

export interface Pt { x: number; y: number }

const nice = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2))

/** Small dependency-free line chart. Marks the highest point when `peak` is set. */
export function LineChart({
  title, xLabel, yLabel, data, peak, marker, className,
}: {
  title?: string
  xLabel: string
  yLabel: string
  data: Pt[]
  peak?: boolean
  /** a vertical guide, e.g. the answer a student gave */
  marker?: number
  className?: string
}) {
  const id = useId()
  const W = 340, H = 210, L = 44, R = 14, T = 14, B = 38
  const pts = [...data].sort((a, b) => a.x - b.x)

  if (pts.length < 2) {
    return (
      <div className={className}>
        {title && <div className="mb-1.5 text-[12px] font-semibold">{title}</div>}
        <div className="grid h-[150px] place-items-center rounded-lg border border-dashed border-border text-center text-[12px] text-muted">
          Record at least two readings<br />to see this graph.
        </div>
      </div>
    )
  }

  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const y0 = Math.min(0, ...ys), y1 = Math.max(...ys) * 1.08 || 1
  const sx = (x: number) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R)
  const sy = (y: number) => H - B - ((y - y0) / (y1 - y0 || 1)) * (H - T - B)
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')
  const area = `${path} L${sx(x1)},${H - B} L${sx(x0)},${H - B} Z`
  const best = peak ? pts.reduce((a, b) => (b.y > a.y ? b : a)) : null
  const ticks = [0, 1, 2, 3, 4]

  return (
    <div className={className}>
      {title && <div className="mb-1.5 text-[12px] font-semibold">{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label={title ?? `${yLabel} against ${xLabel}`}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.28" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => {
          const yv = y0 + ((y1 - y0) * t) / 4
          const xv = x0 + ((x1 - x0) * t) / 4
          return (
            <g key={t} className="text-muted" fontSize="9">
              <line x1={L} x2={W - R} y1={sy(yv)} y2={sy(yv)} stroke="rgb(var(--border))" strokeWidth="1" />
              <text x={L - 6} y={sy(yv) + 3} textAnchor="end" fill="currentColor">{nice(yv)}</text>
              <text x={sx(xv)} y={H - B + 14} textAnchor="middle" fill="currentColor">{nice(xv)}</text>
            </g>
          )
        })}
        <path d={area} fill={`url(#${id})`} />
        <path d={path} fill="none" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.6" fill="rgb(var(--surface))" stroke="rgb(var(--accent))" strokeWidth="1.5" />)}
        {marker != null && marker >= x0 && marker <= x1 && (
          <line x1={sx(marker)} x2={sx(marker)} y1={T} y2={H - B} stroke="rgb(var(--speak))" strokeDasharray="4 3" strokeWidth="1.5" />
        )}
        {best && (
          <g>
            <circle cx={sx(best.x)} cy={sy(best.y)} r="5" fill="rgb(var(--accent))" />
            <text x={sx(best.x)} y={sy(best.y) - 9} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="rgb(var(--fg))">
              peak {nice(best.y)}
            </text>
          </g>
        )}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">{xLabel}</text>
        <text x={11} y={(T + H - B) / 2} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))" transform={`rotate(-90 11 ${(T + H - B) / 2})`}>{yLabel}</text>
      </svg>
    </div>
  )
}
