import { useCallback, useRef, useState } from 'react'
import { cn } from './utils'

const read = (key: string, fallback: number) => {
  try {
    const v = Number(localStorage.getItem(key))
    return Number.isFinite(v) && v > 0 ? v : fallback
  } catch {
    return fallback
  }
}

/** A panel width the user can drag. Remembered in this browser. */
export function usePanelWidth(key: string, initial: number, min: number, max: number) {
  const [w, setW] = useState(() => Math.min(max, Math.max(min, read(`th-w-${key}`, initial))))
  const set = useCallback((n: number) => {
    const v = Math.round(Math.min(max, Math.max(min, n)))
    setW(v)
    try { localStorage.setItem(`th-w-${key}`, String(v)) } catch { /* private mode */ }
  }, [key, min, max])
  return { w, set, reset: () => set(initial), min, max }
}

/**
 * Drag handle between two columns. `side` says which panel it resizes: dragging
 * right grows a left panel and shrinks a right panel. Keyboard: arrow keys, Home resets.
 */
export function Splitter({
  side, width, onChange, onReset, min, max, label,
}: {
  side: 'left' | 'right'
  width: number
  onChange: (n: number) => void
  onReset: () => void
  min: number
  max: number
  label: string
}) {
  const start = useRef<{ x: number; w: number } | null>(null)
  const [drag, setDrag] = useState(false)
  const dir = side === 'left' ? 1 : -1

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, w: width }
        setDrag(true)
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        onChange(start.current.w + dir * (e.clientX - start.current.x))
      }}
      onPointerUp={() => { start.current = null; setDrag(false) }}
      onPointerCancel={() => { start.current = null; setDrag(false) }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onChange(width - dir * 16)
        else if (e.key === 'ArrowRight') onChange(width + dir * 16)
        else if (e.key === 'Home') onReset()
        else return
        e.preventDefault()
      }}
      className="group relative hidden cursor-col-resize touch-none select-none outline-none xl:block"
    >
      <span
        className={cn(
          'absolute inset-y-6 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-border transition-colors',
          'group-hover:bg-accent/60 group-focus-visible:bg-accent',
          drag && 'bg-accent',
        )}
      />
    </div>
  )
}
