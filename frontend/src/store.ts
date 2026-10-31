import { create } from 'zustand'
import { DEFAULT_MACHINE, getMachine, type Machine } from './machines'

export interface Highlight {
  partId: string
  color: string
  label: string
}

export interface StepCard {
  n: number
  total: number
  instruction: string
  tool?: string
  check?: string
}

export interface TranscriptLine {
  role: 'agent' | 'user' | 'tool'
  text: string
  ts: number
  /** set for streamed speech: later updates with the same id rewrite this line */
  id?: string
  /** which conversation: the tutor call or the separate viva call (missing = tutor/repair) */
  ch?: 'tutor' | 'viva'
}

interface SceneState {
  // --- which machine is on screen ------------------------------------------
  machineId: string
  machine: Machine

  // --- scene the agent controls --------------------------------------------
  focusedPart: string | null
  zoom: number
  explode: number
  highlights: Highlight[]
  step: StepCard | null

  // --- scene state the agent can READ back ---------------------------------
  pointerPart: string | null
  lastUserPointed: string | null

  // --- conversation ---------------------------------------------------------
  transcript: TranscriptLine[]

  // --- actions --------------------------------------------------------------
  setMachine: (id: string) => void
  focus: (partId: string | null, zoom?: number) => void
  setExplode: (v: number) => void
  addHighlight: (h: Highlight) => void
  clearHighlights: () => void
  setStep: (s: StepCard | null) => void
  setPointer: (partId: string | null) => void
  push: (line: TranscriptLine) => void
  clearChannel: (ch: 'tutor' | 'viva') => void
  upsert: (line: TranscriptLine & { id: string }) => void
  reset: () => void
}

const CLEAR = {
  focusedPart: null,
  zoom: 1,
  explode: 0,
  highlights: [] as Highlight[],
  step: null,
  pointerPart: null,
  lastUserPointed: null,
}

export const useScene = create<SceneState>((set) => ({
  machineId: DEFAULT_MACHINE,
  machine: getMachine(DEFAULT_MACHINE),
  ...CLEAR,
  transcript: [],

  // switching machine always clears the scene - a highlight on a printer part
  // makes no sense once you are looking at a scanner
  setMachine: (id) => set({ machineId: id, machine: getMachine(id), ...CLEAR }),

  focus: (partId, zoom = 1) => set({ focusedPart: partId, zoom }),
  setExplode: (v) => set({ explode: Math.max(0, Math.min(1, v)) }),
  addHighlight: (h) =>
    set((s) => ({ highlights: [...s.highlights.filter((x) => x.partId !== h.partId), h] })),
  clearHighlights: () => set({ highlights: [] }),
  setStep: (step) => set({ step }),
  setPointer: (partId) =>
    set((s) => ({ pointerPart: partId, lastUserPointed: partId ?? s.lastUserPointed })),
  push: (line) => set((s) => ({ transcript: [...s.transcript.slice(-80), line] })),
  upsert: (line) =>
    set((s) => {
      const i = s.transcript.findIndex((l) => l.id === line.id)
      if (i < 0) return { transcript: [...s.transcript.slice(-80), line] }
      const next = s.transcript.slice()
      next[i] = { ...line, ts: next[i].ts }
      return { transcript: next }
    }),
  clearChannel: (ch) => set((s) => ({ transcript: s.transcript.filter((l) => (l.ch ?? 'tutor') !== ch) })),
  reset: () => set({ ...CLEAR }),
}))

// Dev only: lets the browser console drive the same store the UI uses.
if (import.meta.env.DEV) (window as unknown as { __scene: typeof useScene }).__scene = useScene
