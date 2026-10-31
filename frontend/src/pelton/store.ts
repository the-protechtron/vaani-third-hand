import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PELTON_WHEEL, STEP_VIEW, type RigState } from './content'
import { calculate, simulate, stallLoadKg, sweep, type CalcResult } from './physics'
import type { ViewName } from './views'

export interface ObservationRow extends CalcResult {
  id: number
  nozzleStep: number
  deadWeightKg: number
  springKg: number
  p1: number
  p2: number
  pp: number
  speedRpm: number
}

export type LabTab = 'learn' | 'observe' | 'calc' | 'quiz' | 'viva' | 'tutor'

/** One viva question, written by the tutor agent. Kept by the backend and mirrored here. */
export interface VivaItem {
  id?: number
  n?: number
  kind: 'explain' | 'point' | 'highlight' | 'calc' | 'mcq'
  question: string
  part_id?: string | null
  answer?: string | null
  expected?: string | null
  correct?: boolean | null
  feedback?: string | null
  key_points?: string[] | null
  number?: number
  total?: number
  options?: string[] | null
  points_hit?: string[]
  points_total?: number
  at?: number
}
export interface VivaAttempt {
  id: string
  finished_at: number
  right: number
  total: number
  pct: number
  summary: string | null
  items: VivaItem[]
}
export interface QuizScore { score: number; total: number; at: number }
export interface VivaState {
  active: boolean
  finished: boolean
  summary: string | null
  current: VivaItem | null
  history: VivaItem[]
  last_click: { clicked: string; correct: boolean | null; expected?: string } | null
}

interface Rig {
  pumpOn: boolean
  nozzleStep: number
  deadWeightKg: number
  springKg: number
}

interface LabState {
  rig: Rig
  stepIndex: number
  manualDone: Record<number, boolean>
  selected: string | null
  /** parts the viva or a step wants lit, overriding the current step's */
  forceHighlight: string[] | null
  explode: number
  showLabels: boolean
  view: { name: ViewName; nonce: number }
  rows: ObservationRow[]
  activeRow: number | null
  tab: LabTab
  viva: VivaState | null
  /** the student just asked for a viva; the first question has not arrived yet */
  vivaRequested: boolean
  quiz: { pre: QuizScore | null; post: QuizScore | null }

  setRig: (r: Partial<Rig>) => void
  openStep: (i: number) => void
  toggleStep: (i: number) => void
  select: (id: string | null) => void
  setForceHighlight: (ids: string[] | null) => void
  setExplode: (v: number) => void
  setShowLabels: (v: boolean) => void
  setView: (name: ViewName) => void
  record: () => void
  runSweep: () => void
  removeRow: (id: number) => void
  clearRows: () => void
  setActiveRow: (i: number | null) => void
  setTab: (t: LabTab) => void
  setViva: (v: VivaState | null) => void
  setVivaRequested: (v: boolean) => void
  setQuiz: (which: 'pre' | 'post', score: number, total: number) => void
  reset: () => void
}

const INITIAL_RIG: Rig = { pumpOn: false, nozzleStep: 8, deadWeightKg: 0, springKg: 1 }
let rowId = 0

/** What the gauges show for a given rig setting. */
export function readingsFor(rig: Rig): RigState {
  const r = simulate(rig)
  return { ...rig, speedRpm: r.speedRpm, p1: r.p1, p2: r.p2, pp: r.pp, springKg: rig.springKg }
}

const toRow = (rig: Rig, r: ReturnType<typeof simulate>): ObservationRow => ({
  id: ++rowId,
  nozzleStep: rig.nozzleStep,
  deadWeightKg: rig.deadWeightKg,
  springKg: rig.springKg,
  p1: r.p1,
  p2: r.p2,
  pp: r.pp,
  speedRpm: r.speedRpm,
  ...calculate({ deadWeightKg: rig.deadWeightKg, springKg: rig.springKg, p1: r.p1, p2: r.p2, pp: r.pp, speedRpm: r.speedRpm }),
})

export const useLab = create<LabState>()(persist((set, get) => ({
  rig: INITIAL_RIG,
  stepIndex: 0,
  manualDone: {},
  selected: null,
  forceHighlight: null,
  explode: 0,
  showLabels: false,
  view: { name: 'iso', nonce: 0 },
  rows: [],
  activeRow: null,
  tab: 'learn',
  viva: null,
  vivaRequested: false,
  quiz: { pre: null, post: null },

  setRig: (r) => set((s) => ({ rig: { ...s.rig, ...r } })),

  // Opening a step flies the camera to it and applies any set-up it needs (pump on).
  openStep: (i) => {
    const step = PELTON_WHEEL.procedure[i]
    if (!step) return
    set((s) => ({
      stepIndex: i,
      selected: null,
      forceHighlight: null,
      rig: step.setup?.pumpOn ? { ...s.rig, pumpOn: true } : s.rig,
      view: { name: STEP_VIEW[i] ?? 'iso', nonce: s.view.nonce + 1 },
    }))
  },
  toggleStep: (i) => set((s) => ({ manualDone: { ...s.manualDone, [i]: !s.manualDone[i] } })),

  select: (id) => set({ selected: id }),
  setForceHighlight: (ids) => set({ forceHighlight: ids }),
  setExplode: (v) => set({ explode: Math.max(0, Math.min(1, v)) }),
  setShowLabels: (v) => set({ showLabels: v }),
  setView: (name) => set((s) => ({ view: { name, nonce: s.view.nonce + 1 } })),

  record: () => {
    const { rig, rows } = get()
    if (!rig.pumpOn) return
    const r = simulate(rig)
    set({ rows: [...rows, toRow(rig, r)], activeRow: rows.length })
  },

  // A full load sweep at the current nozzle opening, as 8 recorded rows.
  runSweep: () => {
    const { rig } = get()
    const data = sweep(rig.nozzleStep, 8)
    const rows = data.map((d) => toRow({ ...rig, deadWeightKg: d.deadWeightKg, springKg: d.springKg, pumpOn: true }, {
      p1: d.p1, p2: d.p2, pp: d.pp, speedRpm: d.speedRpm, springKg: d.springKg,
    }))
    set({ rows: [...get().rows, ...rows], activeRow: get().rows.length })
  },

  removeRow: (id) => set((s) => ({ rows: s.rows.filter((r) => r.id !== id), activeRow: null })),
  clearRows: () => set({ rows: [], activeRow: null }),
  setActiveRow: (i) => set({ activeRow: i }),
  setTab: (tab) => set({ tab }),
  setViva: (viva) => set({ viva }),
  setVivaRequested: (vivaRequested) => set({ vivaRequested }),
  setQuiz: (which, score, total) => set((s) => ({ quiz: { ...s.quiz, [which]: { score, total, at: Date.now() } } })),

  reset: () =>
    set({
      rig: INITIAL_RIG, stepIndex: 0, manualDone: {}, selected: null, forceHighlight: null,
      explode: 0, rows: [], activeRow: null,
    }),
}), {
  // What a student would hate to lose on reload: their table, progress and scores.
  name: 'th-lab-v1',
  partialize: (s) => ({ rows: s.rows, manualDone: s.manualDone, stepIndex: s.stepIndex, rig: s.rig, quiz: s.quiz }),
  onRehydrateStorage: () => (state) => { rowId = Math.max(0, ...(state?.rows ?? []).map((r) => r.id)) },
}))

export { stallLoadKg }

// Dev only: lets the browser console (and tests) drive the same store the UI uses.
if (import.meta.env.DEV) (window as unknown as { __lab: typeof useLab }).__lab = useLab
