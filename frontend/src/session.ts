import { useEffect } from 'react'
import { create } from 'zustand'
import { api } from './learner'

export interface PartCard {
  id: string; name: string; sku?: string; price_inr?: number; in_stock?: number
  lead_time_days?: number; tool_required?: string; torque?: string; source: string
  ordered?: boolean; machine?: string; service_interval?: string; safety?: string; notes?: string
}
export interface ProcStep {
  n: number; part_id: string; explode: number; instruction: string; tool?: string | null; check?: string | null
}
export interface Procedure {
  title: string; safety?: string; est_minutes?: number; steps: ProcStep[]
}
export interface CartLine {
  order_id: string; part_id: string; name: string; sku: string
  qty: number; price_inr: number; eta_days: number
}
export interface SessionState {
  session_id: string
  cart: CartLine[]
  cart_total_inr: number
  procedure_title: string | null
  procedure: Procedure | null
  parts: PartCard[]
  tools_needed: string[]
  report: any | null
  /** Pelton lab tutor state: tab requests and the viva (see backend `SESSION["lab"]`). */
  lab?: {
    seq: number
    tab: string | null
    viva: import('./pelton/store').VivaState
    name: string | null
    attempts: import('./pelton/store').VivaAttempt[]
    scene: { seq: number; part_id: string | null; label: string | null; explode: number | null; view: string | null; step: number | null }
  }
}

interface Store {
  data: SessionState | null
  set: (d: SessionState) => void
}

export const useSession = create<Store>((set) => ({ data: null, set: (data) => set({ data }) }))

/** Polls the backend so anything the agent does via SERVER tools shows up. Mount once. */
export function useSessionPolling() {
  const set = useSession((s) => s.set)
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const r = await api('/api/session')
        if (r.ok && alive) set(await r.json())
      } catch { /* backend not up yet */ }
    }
    tick()
    const h = setInterval(tick, 800)
    return () => { alive = false; clearInterval(h) }
  }, [set])
}

// ---- shared formatting ------------------------------------------------------
export const inr = (n?: number) => (n == null ? '—' : `₹${n.toLocaleString('en-IN')}`)

export function stockBadge(n?: number) {
  if (n == null) return null
  if (n === 0) return { text: 'Out of stock', cls: 'bg-red-500/15 text-red-600 dark:text-red-300' }
  if (n <= 3) return { text: `Only ${n} left`, cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' }
  return { text: `${n} in stock`, cls: 'bg-live/15 text-live' }
}
