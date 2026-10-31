import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { useScene } from './store'
import { useSession } from './session'

export interface LiveProduct { title: string; url: string; domain: string; snippet: string; price: string | null }
export interface ProductEntry {
  key: string
  machine: string
  partId: string
  label: string
  state: 'loading' | 'ok' | 'error'
  products: LiveProduct[]
  error?: string
}

interface Store {
  entries: Record<string, ProductEntry>
  /** most recently mentioned first */
  recent: string[]
  partsRequested: boolean
  put: (e: ProductEntry) => void
  touch: (key: string) => void
  setPartsRequested: (v: boolean) => void
}

export const useProducts = create<Store>((set) => ({
  entries: {},
  recent: [],
  partsRequested: false,
  put: (e) => set((s) => ({ entries: { ...s.entries, [e.key]: e } })),
  touch: (key) => set((s) => ({ recent: [key, ...s.recent.filter((k) => k !== key)].slice(0, 3) })),
  setPartsRequested: (partsRequested) => set({ partsRequested }),
}))

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** "list the parts", "what parts do I need", "show replacement parts": the student asks for the list. */
const ASKS_FOR_PARTS = /(\bparts?\b|spares?|replacements?)/
const ASKS_VERB = /(list|show|what|which|give|display|need|require|tell me|any)/

async function load(machine: string, partId: string, label: string) {
  const key = `${machine}/${partId}`
  const cur = useProducts.getState().entries[key]
  useProducts.getState().touch(key)
  if (cur && (cur.state === 'ok' || cur.state === 'loading')) return
  const base = { key, machine, partId, label, products: [] as LiveProduct[] }
  useProducts.getState().put({ ...base, state: 'loading' })
  try {
    const r = await fetch(`/api/products/${machine}/${partId}`)
    const d = await r.json()
    if (!r.ok || !d.ok) throw new Error(d.error ?? d.detail ?? `error ${r.status}`)
    useProducts.getState().put({ ...base, state: 'ok', products: d.products ?? [] })
  } catch (e: any) {
    useProducts.getState().put({ ...base, state: 'error', error: String(e?.message ?? e).slice(0, 120) })
  }
}

const STOP = new Set(['with', 'assembly', 'metal', 'unit', 'system', 'main', 'left', 'right', 'front', 'rear'])

/** Words that identify exactly one part of this machine ("nozzle", "chiller", "cryostat"). */
function distinctiveWords(parts: { id: string; label: string; selectable?: boolean }[]): Map<string, string> {
  const owners = new Map<string, Set<string>>()
  for (const p of parts) {
    if (p.selectable === false) continue
    for (const w of norm(p.label).split(' ')) {
      if (w.length < 4 || STOP.has(w)) continue
      if (!owners.has(w)) owners.set(w, new Set())
      owners.get(w)!.add(p.id)
    }
  }
  const out = new Map<string, string>()
  owners.forEach((ids, w) => { if (ids.size === 1) out.set(w, [...ids][0]) })
  return out
}

/**
 * Watches the conversation (repair tabs). Whenever a part of the machine on screen is named,
 * by you or by the agent, its live shop results are fetched from the web. A separate, spoken
 * request ("list the parts") is what reveals the replacement-parts list.
 * Each new line is handled once; a machine switch never replays old lines.
 */
export function useChatTriggers(enabled: boolean) {
  const transcript = useScene((s) => s.transcript)
  const machine = useScene((s) => s.machine)
  const procTitle = useSession((s) => s.data?.procedure_title)
  const handled = useRef(new Set<string>())

  // a new machine or a new procedure starts with the list hidden again
  useEffect(() => { useProducts.getState().setPartsRequested(false) }, [machine.id, procTitle])

  useEffect(() => {
    // a line is handled again whenever its text grows (agent speech streams in), never twice for the same text
    const fresh = transcript.filter((l, i) => {
      const k = `${l.id ?? i}|${l.text}`
      if (handled.current.has(k)) return false
      handled.current.add(k)
      return true
    })
    if (handled.current.size > 400) handled.current = new Set()
    if (!enabled) return

    const m = useScene.getState().machine
    const words = distinctiveWords(m.parts)
    for (const line of fresh) {
      if (line.role === 'tool') continue
      const text = norm(line.text)
      if (!text) continue

      if (line.role === 'user' && ASKS_FOR_PARTS.test(text) && ASKS_VERB.test(text)) {
        useProducts.getState().setPartsRequested(true)
      }

      const hit = new Set<string>()
      for (const p of m.parts) {
        if (p.selectable === false) continue
        const label = norm(p.label)
        if (label.length >= 4 && (` ${text} `).includes(` ${label} `)) hit.add(p.id)
        if (p.aliases) {
          for (const a of p.aliases) {
            const an = norm(a)
            if (an.length >= 3 && (` ${text} `).includes(` ${an} `)) hit.add(p.id)
          }
        }
      }
      for (const w of text.split(' ')) { const id = words.get(w); if (id) hit.add(id) }
      let n = 0
      for (const id of hit) {
        if (n++ >= 2) break
        const part = m.parts.find((p) => p.id === id)
        if (part) void load(m.id, id, part.label)
      }
    }
  }, [transcript, enabled])
}
