import { useCallback, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Scene } from './components/Scene'
import { Panel } from './components/Panel'
import { Sidebar } from './components/Sidebar'
import { PeltonLab } from './pelton/PeltonLab'
import { useLab } from './pelton/store'
import { Splitter, usePanelWidth } from './lib/panels'
import { useSessionPolling } from './session'
import { useChatTriggers } from './products'
import { AnimatedTabs } from './components/ui/animated-tabs'
import { GridBackground } from './components/ui/grid-background'
import { MovingBorderButton } from './components/ui/moving-border'
import { Spotlight } from './components/ui/spotlight'
import { ThemeToggle } from './components/ui/theme-toggle'
import { clientTools } from './clientTools'
import { useScene } from './store'
import { MACHINES, MACHINE_IDS } from './machines'
import { useVoiceAgent } from './voiceAgent'
import { cn } from './lib/utils'

const STATUS_LABEL: Record<string, string> = {
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  idle: 'Paused',
}

const QUICKSTART = [
  'Press Start session and allow the microphone',
  'Describe the fault out loud',
  'Hover a part and ask "what is this?"',
]

/** The 4th tab is a different use case: a learning lab, not a repair machine. */
const LAB_TAB = 'pelton'
const TABS = [...MACHINE_IDS.map((id) => ({ id: id as string, label: MACHINES[id].name })), { id: LAB_TAB, label: 'Pelton Wheel' }]

/** Manual explode slider; the agent drives the same value through set_view. */
function ExplodeControl() {
  const explode = useScene((s) => s.explode)
  const setExplode = useScene((s) => s.setExplode)
  const focused = useScene((s) => s.focusedPart)
  const reset = useScene((s) => s.reset)
  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-3 rounded-xl border border-border bg-surface/85 px-3.5 py-2 text-xs backdrop-blur">
      <label htmlFor="explode" className="font-medium text-muted">Explode</label>
      <input
        id="explode"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={explode}
        onChange={(e) => setExplode(Number(e.target.value))}
        className="h-1.5 w-28 cursor-pointer accent-[rgb(var(--accent))] sm:w-36"
        aria-valuetext={`${Math.round(explode * 100)} percent`}
      />
      <span className="w-8 text-right tabular-nums text-fg">{Math.round(explode * 100)}%</span>
      {(explode > 0 || focused) && (
        <button onClick={reset} className="rounded-md px-2 py-1 font-medium text-accent hover:bg-accent/10">Reset view</button>
      )}
    </div>
  )
}

export default function App() {
  const machine = useScene((s) => s.machine)
  const { status, sources, handoff, beginSession, endSession } = useVoiceAgent()
  const [sessionOn, setSessionOn] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [lab, setLab] = useState(false)
  const [callMode, setCallMode] = useState<'repair' | 'pelton' | 'viva'>('repair')
  const left = usePanelWidth('repair-left', 320, 240, 520)
  const right = usePanelWidth('repair-right', 390, 320, 720)
  useSessionPolling()
  useChatTriggers(!lab)

  const live = sessionOn && status !== 'idle'

  const begin = useCallback(async (mode: 'repair' | 'pelton' | 'viva') => {
    setError(null)
    setStarting(true)
    try {
      await beginSession(mode)
      setCallMode(mode)
      setSessionOn(true)
    } catch (e: any) {
      useLab.getState().setVivaRequested(false)
      const msg = String(e?.message ?? e)
      setError(
        /denied|permission|notallowed/i.test(msg)
          ? 'Microphone access was blocked. Allow it in the browser address bar, then try again.'
          : `Could not start the session. ${msg.slice(0, 140)}`,
      )
    } finally {
      setStarting(false)
    }
  }, [beginSession])

  const start = useCallback(() => void begin(lab ? 'pelton' : 'repair'), [begin, lab])

  /**
   * The viva is its own call with its own chat. Whatever call is running ends first,
   * then a fresh examiner call starts, so the tutor chat and the viva chat never mix.
   */
  const startViva = useCallback(async () => {
    const scene = useScene.getState()
    if (sessionOn && callMode !== 'viva') {
      scene.push({ role: 'tool', text: 'Tutor call ended · your viva starts in the Viva tab', ts: Date.now(), ch: 'tutor' })
    }
    endSession()
    setSessionOn(false)
    scene.clearChannel('viva')
    useLab.getState().setVivaRequested(true)
    await begin('viva')
  }, [begin, endSession, sessionOn, callMode])

  const stop = useCallback(() => {
    endSession()
    setSessionOn(false)
    useScene.getState().reset()
  }, [endSession])

  // Manual switch, for setting the stage before you start talking.
  // The agent can also do this itself via the switch_machine tool.
  const pickMachine = useCallback((id: string) => {
    clientTools.switch_machine({ machine: id })
  }, [])

  // A live session is tied to its brief (repair copilot vs lab tutor), so switching use case ends it.
  const pickTab = useCallback((id: string) => {
    const toLab = id === LAB_TAB
    if (toLab !== lab && sessionOn) {
      endSession()
      setSessionOn(false)
    }
    setLab(toLab)
    if (!toLab) pickMachine(id)
  }, [lab, sessionOn, endSession, pickMachine])

  const statusText = starting ? 'Connecting' : sessionOn ? STATUS_LABEL[status] ?? status : 'Session off'

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="h-9 w-9 shrink-0 rounded-xl bg-[conic-gradient(from_210deg,rgb(var(--accent)),#ffd08a,rgb(var(--speak)),rgb(var(--accent)))] shadow-sm"
          />
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold leading-tight tracking-tight">Third Hand</h1>
            <p className="hidden truncate text-xs text-muted sm:block">A voice agent that sees what you are looking at</p>
          </div>
        </div>

        <AnimatedTabs
          className="order-3 w-full sm:order-none sm:mx-auto sm:w-auto"
          tabs={TABS}
          active={lab ? LAB_TAB : machine.id}
          onChange={pickTab}
          label="Machine or lab"
        />

        <div className="ml-auto flex items-center gap-3">
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium"
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full bg-muted/50',
                live && 'bg-live',
                status === 'speaking' && sessionOn && 'animate-pulse-ring bg-speak',
                starting && 'animate-pulse bg-accent',
              )}
            />
            <span className="text-muted">{statusText}</span>
          </div>

          {!lab && (
            <button
              onClick={() => setDrawer(true)}
              className="h-9 shrink-0 rounded-full border border-border bg-surface-2 px-3.5 text-xs font-medium text-fg hover:bg-surface xl:hidden"
            >
              Steps &amp; parts
            </button>
          )}

          <ThemeToggle />

          <MovingBorderButton
            tone={live ? 'danger' : 'accent'}
            onClick={live ? stop : start}
            disabled={starting}
            aria-label={live ? 'End session' : 'Start session'}
          >
            {live ? 'End session' : starting ? 'Connecting…' : sessionOn ? 'Resume' : 'Start session'}
          </MovingBorderButton>
        </div>
      </header>

      <AnimatePresence>
        {error && (
          <motion.div
            role="alert"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-red-500/30 bg-red-500/10"
          >
            <div className="flex items-center justify-between gap-4 px-4 py-2 text-[13px] text-red-600 dark:text-red-300 sm:px-6">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="rounded px-2 py-0.5 font-medium hover:bg-red-500/10" aria-label="Dismiss">
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {lab ? (
        <PeltonLab status={status} sessionOn={sessionOn} callMode={callMode} onStartViva={startViva} onEndCall={stop} />
      ) : (
      <>
      <AnimatePresence>
        {drawer && (
          <motion.div
            className="fixed inset-0 z-40 xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button aria-label="Close steps and parts" className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
            <motion.div
              initial={{ x: -340 }}
              animate={{ x: 0 }}
              exit={{ x: -340 }}
              transition={{ type: 'spring', bounce: 0.1, duration: 0.4 }}
              className="absolute inset-y-0 left-0 flex w-[min(340px,92vw)] flex-col gap-3 bg-bg p-3 shadow-xl"
            >
              <div className="flex items-center justify-between px-1">
                <span className="font-serif text-[15px] font-semibold">Steps &amp; parts</span>
                <button onClick={() => setDrawer(false)} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-2">Close</button>
              </div>
              <Sidebar />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main
        style={{ '--lw': `${left.w}px`, '--rw': `${right.w}px` } as CSSProperties}
        className="grid min-h-0 flex-1 grid-rows-[minmax(280px,52%)_1fr] gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[1fr_390px] lg:grid-rows-1 xl:grid-cols-[var(--lw)_16px_minmax(0,1fr)_16px_var(--rw)] xl:gap-0"
      >
        <div className="hidden min-h-0 xl:flex xl:flex-col">
          <Sidebar />
        </div>
        <Splitter side="left" width={left.w} onChange={left.set} onReset={left.reset} min={left.min} max={left.max} label="Resize the steps and parts panel" />
        <section
          aria-label="3D machine view"
          className="relative min-h-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
        >
          <GridBackground />
          <Spotlight className="-top-40 left-0 text-accent md:-top-20 md:left-40" fill="rgb(var(--accent))" />
          <div className="absolute inset-0">
            <Scene />
          </div>

          <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-border bg-surface/80 px-3.5 py-2.5 backdrop-blur">
            <div className="font-serif text-[15px] font-semibold leading-tight">{machine.name}</div>
            <div className="mt-0.5 text-xs text-muted">{machine.subtitle}</div>
          </div>

          <AnimatePresence>
            {!sessionOn && (
              <motion.ol
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-4 left-4 hidden max-w-sm flex-col gap-1.5 rounded-xl border border-border bg-surface/85 p-3 text-[13px] backdrop-blur sm:flex"
              >
                {QUICKSTART.map((t, i) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <span className="num-badge mt-px h-5 w-5 shrink-0 rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
                      {i + 1}
                    </span>
                    <span className="text-muted">{t}</span>
                  </li>
                ))}
              </motion.ol>
            )}
          </AnimatePresence>

          <ExplodeControl />
        </section>

        <Splitter side="right" width={right.w} onChange={right.set} onReset={right.reset} min={right.min} max={right.max} label="Resize the conversation panel" />
        <Panel sources={sources} handoff={handoff} status={status} sessionOn={sessionOn} />
      </main>
      </>
      )}
    </div>
  )
}
