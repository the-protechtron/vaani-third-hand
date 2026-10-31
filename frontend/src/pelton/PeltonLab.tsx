import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import PeltonScene from './PeltonScene'
import { LabSidebar } from './LabSidebar'
import { ControlDesk } from './ui/ControlDesk'
import { LearnTab } from './tabs/LearnTab'
import { ObserveTab } from './tabs/ObserveTab'
import { CalcTab } from './tabs/CalcTab'
import { QuizTab } from './tabs/QuizTab'
import { VivaTab } from './tabs/VivaTab'
import { TutorTab } from './tabs/TutorTab'
import { PELTON_WHEEL, VIEW_LABEL } from './content'
import { VIEW_NAMES, type ViewName } from './views'
import { readingsFor, useLab, type LabTab } from './store'
import { useSession } from '../session'
import { api } from '../learner'
import { useScene } from '../store'
import { AnimatedTabs } from '../components/ui/animated-tabs'
import { GridBackground } from '../components/ui/grid-background'
import { Spotlight } from '../components/ui/spotlight'
import { VoiceBars, type BarsState } from '../components/ui/voice-bars'
import { RichText } from '../lib/text'
import { Splitter, usePanelWidth } from '../lib/panels'
import { cn } from '../lib/utils'

const TABS: { id: LabTab; label: string }[] = [
  { id: 'learn', label: 'Learn' },
  { id: 'observe', label: 'Observe' },
  { id: 'calc', label: 'Calculate' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'viva', label: 'Viva' },
  { id: 'tutor', label: 'Tutor' },
]
const VALID_TABS = new Set<string>(TABS.map((t) => t.id))

/** One line of what the tutor just said, visible on every tab while a session runs. */
function LiveCaption({ status, sessionOn, channel }: { status: string; sessionOn: boolean; channel: 'tutor' | 'viva' }) {
  const transcript = useScene((s) => s.transcript)
  const last = [...transcript].reverse().find((l) => l.role !== 'tool' && (l.ch ?? 'tutor') === channel)
  if (!sessionOn || !last) return null
  const bars: BarsState = status === 'speaking' ? 'speaking' : last.role === 'user' ? 'thinking' : 'listening'
  return (
    <div className="flex shrink-0 items-start gap-2.5 rounded-xl border border-border bg-surface-2/70 px-3 py-2 text-[12.5px] leading-snug">
      <VoiceBars state={bars} className="mt-0.5 shrink-0" />
      <p className="line-clamp-2 min-w-0">
        <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{last.role === 'agent' ? (channel === 'viva' ? 'Examiner' : 'Tutor') : 'You'}</span>
        <RichText text={last.text} />
      </p>
    </div>
  )
}

/** The learning path as five steps, with where you are and what to do next. */
function FlowBar() {
  const quiz = useLab((s) => s.quiz)
  const rows = useLab((s) => s.rows.length)
  const attempts = useSession((s) => s.data?.lab?.attempts.length ?? 0)
  const setTab = useLab((s) => s.setTab)
  const steps: { label: string; tab: LabTab; done: boolean }[] = [
    { label: 'Learn', tab: 'learn', done: !!quiz.pre || rows > 0 || attempts > 0 },
    { label: 'Pre-test', tab: 'quiz', done: !!quiz.pre },
    { label: 'Experiment', tab: 'observe', done: rows >= 3 },
    { label: 'Post-test', tab: 'quiz', done: !!quiz.post },
    { label: 'Viva', tab: 'viva', done: attempts > 0 },
  ]
  const next = steps.findIndex((x) => !x.done)
  return (
    <ol aria-label="Learning path" className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-xl border border-border bg-surface-2/50 px-2 py-1.5 [scrollbar-width:none]">
      {steps.map((x, i) => (
        <li key={x.label} className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setTab(x.tab)}
            aria-current={i === next ? 'step' : undefined}
            title={x.done ? `${x.label}: done` : i === next ? `Next up: ${x.label}` : x.label}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors',
              x.done ? 'text-live hover:bg-live/10' : i === next ? 'bg-accent/15 text-accent' : 'text-muted hover:text-fg',
            )}
          >
            <span className={cn('num-badge h-4 w-4 rounded-full text-[9px] font-bold', x.done ? 'bg-live text-white' : i === next ? 'bg-accent text-white' : 'bg-surface ring-1 ring-border')}>
              {x.done ? '✓' : i + 1}
            </span>
            {x.label}
          </button>
          {i < steps.length - 1 && <span aria-hidden className="h-px w-3 bg-border" />}
        </li>
      ))}
    </ol>
  )
}

/** The 4th tab: Pelton wheel experiment, for learning. Replaces the repair layout while active. */
export function PeltonLab({
  status, sessionOn, callMode, onStartViva, onEndCall,
}: {
  status: string
  sessionOn: boolean
  callMode: 'repair' | 'pelton' | 'viva'
  onStartViva: () => void
  onEndCall: () => void
}) {
  const rig = useLab((s) => s.rig)
  const stepIndex = useLab((s) => s.stepIndex)
  const forceHighlight = useLab((s) => s.forceHighlight)
  const selected = useLab((s) => s.selected)
  const select = useLab((s) => s.select)
  const explode = useLab((s) => s.explode)
  const setExplode = useLab((s) => s.setExplode)
  const showLabels = useLab((s) => s.showLabels)
  const setShowLabels = useLab((s) => s.setShowLabels)
  const view = useLab((s) => s.view)
  const setView = useLab((s) => s.setView)
  const tab = useLab((s) => s.tab)
  const setTab = useLab((s) => s.setTab)
  const viva = useLab((s) => s.viva)
  const setViva = useLab((s) => s.setViva)
  const labData = useSession((s) => s.data?.lab)
  const transcript = useScene((s) => s.transcript)
  const setVivaRequested = useLab((s) => s.setVivaRequested)

  const left = usePanelWidth('lab-left', 320, 240, 520)
  const right = usePanelWidth('lab-right', 410, 320, 720)

  // ---- mirror what the tutor did on the backend (tab requests + the viva) -------------
  const seenSeq = useRef<number | null>(null)
  useEffect(() => {
    if (!labData) return
    setViva(labData.viva)
    if (seenSeq.current === null) { seenSeq.current = labData.seq; return } // ignore a stale tab request on load
    if (labData.seq !== seenSeq.current) {
      seenSeq.current = labData.seq
      if (labData.tab && VALID_TABS.has(labData.tab)) setTab(labData.tab as LabTab)
    }
  }, [labData, setTab, setViva])

  // Saying "start the viva" to the tutor ends the tutor call and opens the Viva tab with a
  // separate examiner call. Only the tutor chat is listened to: the viva has its own chat.
  const handled = useRef('')
  useEffect(() => {
    if (callMode === 'viva') return
    const last = [...transcript].reverse().find((l) => l.role === 'user' && (l.ch ?? 'tutor') === 'tutor')
    if (!last) return
    const key = `${last.id ?? ''}|${last.text}`
    if (key === handled.current) return
    const t = last.text.toLowerCase()
    if (/viva/.test(t) && /(start|begin|take|give|let'?s|lets|ready|do |conduct|run|quiz|test)/.test(t)) {
      handled.current = key
      setTab('viva')
      setVivaRequested(true)
      if (sessionOn) onStartViva()
    }
  }, [transcript, callMode, sessionOn, setTab, setVivaRequested, onStartViva])

  // ---- the tutor points at the rig: glow + label + camera, explode, view, step ----------
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null)
  const seenScene = useRef<number | null>(null)
  const scene = labData?.scene
  useEffect(() => {
    if (!scene) return
    if (seenScene.current === null) { seenScene.current = scene.seq; return } // ignore a stale scene on load
    if (scene.seq === seenScene.current) return
    seenScene.current = scene.seq
    const lab = useLab.getState()
    if (scene.view) lab.setView(scene.view as ViewName)
    if (scene.step) lab.openStep(scene.step - 1)
    if (scene.explode != null) lab.setExplode(scene.explode)
    if (scene.part_id) {
      lab.setForceHighlight([scene.part_id])
      setFocus((f) => ({ id: scene.part_id!, nonce: (f?.nonce ?? 0) + 1 }))
    }
  }, [scene])
  // moving on (another step, or the camera views) drops the pointer
  useEffect(() => { setFocus(null) }, [stepIndex])

  // ---- during a viva the rig is a test: no labels, no explode, no hints ----------------
  const vivaActive = !!viva?.active && !viva.finished
  useEffect(() => { if (viva?.current) setVivaRequested(false) }, [viva?.current, setVivaRequested])
  useEffect(() => {
    if (!useLab.getState().vivaRequested) return
    const t = setTimeout(() => setVivaRequested(false), 25000) // never leave the spinner up if the agent did not start one
    return () => clearTimeout(t)
  }, [transcript.length, setVivaRequested])
  const current = viva?.current ?? null
  useEffect(() => {
    if (!vivaActive) return
    setShowLabels(false)
    setExplode(0)
    setFocus(null)
    useLab.getState().setForceHighlight(null)
  }, [vivaActive, setShowLabels, setExplode])

  const state = useMemo(() => readingsFor(rig), [rig])
  const step = PELTON_WHEEL.procedure[stepIndex]
  const highlight = vivaActive
    ? current?.kind === 'highlight' && current.part_id ? [current.part_id] : []
    : forceHighlight ?? step?.highlight ?? []

  // Clicking an object answers a "click the part" question. Otherwise it just selects.
  const onSelect = (id: string) => {
    if (vivaActive && current?.kind === 'point') {
      select(id)
      void api('/api/lab/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part_id: id }),
      })
      return
    }
    if (vivaActive) return // other question kinds: selecting would only hint
    select(selected === id ? null : id)
  }

  const cols = { '--lw': `${left.w}px`, '--rw': `${right.w}px` } as CSSProperties

  return (
    <main
      style={cols}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-4 xl:grid xl:grid-cols-[var(--lw)_16px_minmax(0,1fr)_16px_var(--rw)] xl:gap-0 xl:overflow-hidden"
    >
      <div className="flex min-h-[520px] flex-col xl:min-h-0">
        <LabSidebar />
      </div>
      <Splitter side="left" width={left.w} onChange={left.set} onReset={left.reset} min={left.min} max={left.max} label="Resize the procedure panel" />

      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <section aria-label="3D Pelton wheel rig" className="relative min-h-[360px] flex-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <GridBackground />
          <Spotlight className="-top-40 left-0 text-accent md:-top-20 md:left-40" fill="rgb(var(--accent))" />
          <div className="absolute inset-0">
            <PeltonScene
              components={PELTON_WHEEL.components}
              state={state}
              highlight={highlight}
              selected={selected}
              explode={explode}
              showLabels={!vivaActive && (showLabels || !!focus)}
              labelIds={showLabels || !focus ? undefined : [focus.id]}
              focus={vivaActive ? null : focus}
              view={view}
              onSelect={onSelect}
            />
          </div>

          <div className="pointer-events-none absolute left-4 top-4 max-w-[70%] rounded-xl border border-border bg-surface/85 px-3.5 py-2.5 backdrop-blur">
            <div className="font-serif text-[15px] font-semibold leading-tight">Pelton wheel test rig</div>
            {vivaActive ? (
              <div className="mt-0.5 text-xs text-muted"><b className="text-accent">Viva</b> · {current?.kind === 'point' ? 'click the part on the rig' : 'answer out loud'}</div>
            ) : (
              step && <div className="mt-0.5 text-xs text-muted"><b className="text-accent">Step {step.step}</b> · {step.text}</div>
            )}
          </div>

          <AnimatePresence>
            {vivaActive && current?.kind === 'point' && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute left-1/2 top-4 z-10 max-w-[80%] -translate-x-1/2 rounded-full border border-speak/50 bg-surface/95 px-4 py-2 text-center text-[13px] font-medium shadow-lg backdrop-blur"
              >
                <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-speak align-middle" />
                <RichText text={current.question} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label="Camera view" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface/85 p-1 backdrop-blur [scrollbar-width:none]">
              {VIEW_NAMES.map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view.name === v}
                  className={cn('shrink-0 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors', view.name === v ? 'bg-accent/15 text-accent' : 'text-muted hover:text-fg')}
                >
                  {VIEW_LABEL[v]}
                </button>
              ))}
            </div>
            <div
              className={cn('flex items-center gap-3 rounded-xl border border-border bg-surface/85 px-3 py-1.5 text-xs backdrop-blur', vivaActive && 'opacity-50')}
              title={vivaActive ? 'Locked during the viva' : undefined}
            >
              <label className={cn('flex items-center gap-1.5 text-muted', vivaActive ? 'cursor-not-allowed' : 'cursor-pointer')}>
                <input type="checkbox" disabled={vivaActive} checked={showLabels && !vivaActive} onChange={(e) => setShowLabels(e.target.checked)} className="accent-[rgb(var(--accent))]" />
                Labels
              </label>
              <label htmlFor="pelton-explode" className="font-medium text-muted">Explode</label>
              <input id="pelton-explode" type="range" min={0} max={1} step={0.01} disabled={vivaActive} value={explode} onChange={(e) => setExplode(Number(e.target.value))} className="h-1.5 w-24 cursor-pointer accent-[rgb(var(--accent))] disabled:cursor-not-allowed" />
              <span className="w-8 text-right tabular-nums">{Math.round(explode * 100)}%</span>
            </div>
          </div>
        </section>

        <ControlDesk />
      </div>

      <Splitter side="right" width={right.w} onChange={right.set} onReset={right.reset} min={right.min} max={right.max} label="Resize the learning panel" />
      <section aria-label="Learning panel" className="flex min-h-[560px] min-w-0 flex-col gap-3 xl:min-h-0">
        <AnimatedTabs tabs={TABS} active={tab} onChange={(id) => setTab(id as LabTab)} label="Lab section" className="w-full shrink-0 justify-between" />
        <FlowBar />
        {tab !== 'tutor' && <LiveCaption status={status} sessionOn={sessionOn} channel={tab === 'viva' ? 'viva' : 'tutor'} />}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(tab === 'tutor' && 'h-full')}
            >
              {tab === 'learn' && <LearnTab />}
              {tab === 'observe' && <ObserveTab />}
              {tab === 'calc' && <CalcTab />}
              {tab === 'quiz' && <QuizTab />}
              {tab === 'viva' && <VivaTab sessionOn={sessionOn} callMode={callMode} onStart={onStartViva} onEnd={onEndCall} />}
              {tab === 'tutor' && <TutorTab status={status} sessionOn={sessionOn && callMode !== 'viva'} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </main>
  )
}
