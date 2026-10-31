import { motion } from 'motion/react'
import { useScene } from '../../store'
import { VoiceBars, type BarsState } from '../../components/ui/voice-bars'
import { ChatLines } from '../ui/Chat'
import { cn } from '../../lib/utils'

const HINTS = [
  'Explain how a Pelton wheel works',
  'Why does efficiency peak at half the stall load?',
  'What is the next step?',
  'Help me with the calculations',
  'Start the viva',
]

/** The animated "voice" of the tutor: calm when listening, alive when speaking. */
export function TutorOrb({ state, size = 40 }: { state: BarsState; size?: number }) {
  const speaking = state === 'speaking'
  const hue = speaking ? 'from-speak to-accent' : state === 'thinking' ? 'from-accent to-amber-300' : state === 'listening' ? 'from-live to-speak' : 'from-muted/50 to-muted/20'
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size + 8, height: size + 8 }} aria-hidden>
      {state !== 'off' && (
        <motion.span
          className={cn('absolute inset-0 rounded-full bg-gradient-to-br opacity-30 blur-md', hue)}
          animate={{ scale: speaking ? [1, 1.3, 1] : [1, 1.1, 1] }}
          transition={{ duration: speaking ? 0.9 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <motion.span
        className={cn('relative rounded-full bg-gradient-to-br shadow-inner ring-1 ring-white/30', hue)}
        style={{ width: size, height: size }}
        animate={{ scale: speaking ? [1, 1.08, 0.96, 1.05, 1] : state === 'thinking' ? [1, 0.94, 1] : [1, 1.03, 1] }}
        transition={{ duration: speaking ? 0.8 : state === 'thinking' ? 0.9 : 2.4, repeat: state === 'off' ? 0 : Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

/** Voice tutor: the same Vaani agent, running a lab-tutor brief for this experiment. */
export function TutorTab({ status, sessionOn }: { status: string; sessionOn: boolean }) {
  const all = useScene((s) => s.transcript)
  const lines = all.filter((l) => (l.ch ?? 'tutor') === 'tutor' && (l.role !== 'tool' || /error|fail|ended|connected|viva/i.test(l.text)))

  const last = lines[lines.length - 1]
  const thinking = sessionOn && last?.role === 'user' && status !== 'speaking'
  const bars: BarsState = !sessionOn ? 'off' : thinking ? 'thinking' : status === 'speaking' ? 'speaking' : 'listening'
  const title = !sessionOn ? 'Voice tutor is off' : thinking ? 'Thinking…' : status === 'speaking' ? 'Tutor is speaking' : 'Listening'
  const streaming = sessionOn && status === 'speaking' && last?.role === 'agent'

  return (
    <div className="flex h-full min-h-0 flex-col text-[13px]">
      {/* one compact status row; the live caption is hidden on this tab so nothing repeats */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border pb-3">
        <TutorOrb state={bars} />
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[14.5px] font-semibold leading-tight">{title}</div>
          <div className="mt-0.5 truncate text-[11.5px] text-muted">
            {sessionOn ? 'Ask anything, or say “start the viva”.' : 'Press Start session to talk to your tutor.'}
          </div>
        </div>
        <VoiceBars state={bars} />
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto py-3.5 pr-1">
        <ChatLines lines={lines} streaming={streaming} thinking={thinking} empty="Your conversation with the tutor appears here, word by word." />
      </div>

      {sessionOn && (
        <div className="shrink-0 border-t border-border pt-2.5">
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted">Try saying</div>
          <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-1">
            {HINTS.map((h) => <span key={h} className="shrink-0 whitespace-nowrap rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[12px] text-muted">“{h}”</span>)}
          </div>
        </div>
      )}
    </div>
  )
}
