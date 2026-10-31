import { motion } from 'motion/react'
import { useState } from 'react'
import { useLab, type VivaItem } from '../store'
import { useSession } from '../../session'
import { api, learnerName, setLearnerName } from '../../learner'
import { LineChart } from '../ui/LineChart'
import { ChatLines } from '../ui/Chat'
import { useScene } from '../../store'
import { downloadCsv, printReport } from '../report'
import { RichText } from '../../lib/text'
import { cn } from '../../lib/utils'

const KIND: Record<VivaItem['kind'], { label: string; how: string }> = {
  point: { label: 'Click the object', how: 'Click the answer on the 3D rig' },
  highlight: { label: 'Name the part', how: 'Say the name of the glowing part' },
  explain: { label: 'Explain', how: 'Answer out loud' },
  calc: { label: 'Calculation', how: 'Answer out loud' },
  mcq: { label: 'Multiple choice', how: 'Answer out loud' },
}

function Result({ item }: { item: VivaItem }) {
  const state = item.correct === true ? 'right' : item.correct === false ? 'wrong' : 'skipped'
  return (
    <li className={cn(
      'rounded-xl border p-3',
      state === 'right' ? 'border-live/40 bg-live/[0.06]' : state === 'wrong' ? 'border-red-500/40 bg-red-500/[0.05]' : 'border-border bg-surface',
    )}>
      <div className="flex items-start gap-2.5">
        <span className={cn(
          'num-badge mt-px h-5 w-5 shrink-0 rounded-full text-[11px] font-semibold text-white',
          state === 'right' ? 'bg-live' : state === 'wrong' ? 'bg-red-500' : 'bg-muted',
        )}>
          {state === 'right' ? '✓' : state === 'wrong' ? '✕' : '–'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted">
            <span>Q{item.n} · {KIND[item.kind].label}</span>
            <span className={state === 'right' ? 'text-live' : state === 'wrong' ? 'text-red-500' : ''}>
              {state === 'right' ? 'Correct' : state === 'wrong' ? 'Not quite' : 'Skipped'}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-snug"><RichText text={item.question} /></p>
          {(item.answer || item.expected) && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px] leading-snug">
              {item.answer && (<><dt className="text-muted">You</dt><dd><RichText text={item.answer} /></dd></>)}
              {item.expected && state !== 'right' && (<><dt className="text-muted">Answer</dt><dd className="font-medium"><RichText text={item.expected} /></dd></>)}
            </dl>
          )}
          {item.key_points && item.points_total != null && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.key_points.map((kp) => {
                const hit = item.points_hit?.includes(kp)
                return (
                  <span key={kp} className={cn('rounded-full px-2 py-0.5 text-[10.5px] ring-1', hit ? 'bg-live/10 text-live ring-live/30' : 'bg-surface text-muted ring-border')}>
                    {hit ? '✓' : '○'} {kp}
                  </span>
                )
              })}
            </div>
          )}
          {item.feedback && item.feedback !== 'skipped' && <p className="mt-1.5 text-[12px] leading-snug text-muted"><RichText text={item.feedback} /></p>}
        </div>
      </div>
    </li>
  )
}

const when = (t: number) => new Date(t * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

/** Who you are, past attempts and export. Shown with or without a viva in progress. */
function Footer() {
  const attempts = useSession((s) => s.data?.lab?.attempts) ?? []
  const savedName = useSession((s) => s.data?.lab?.name)
  const [name, setName] = useState(learnerName() || savedName || '')
  const save = () => {
    setLearnerName(name)
    void api('/api/lab/name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
  }
  const trend = attempts.map((a, i) => ({ x: i + 1, y: a.pct }))
  return (
    <div className="mt-1 flex flex-col gap-4 border-t border-border pt-4 text-[13px]">
      <div>
        <label htmlFor="learner-name" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">Your name (shown to your teacher)</label>
        <input
          id="learner-name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur())}
          placeholder="e.g. Asha Rao"
          className="h-9 w-full rounded-lg border border-border bg-surface-2/60 px-3 outline-none focus:border-accent"
        />
      </div>

      {attempts.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span>Past attempts</span><span className="font-normal normal-case tracking-normal">best {Math.max(...attempts.map((a) => a.pct))}%</span>
          </h3>
          {attempts.length > 1 && <LineChart xLabel="Attempt" yLabel="Score (%)" data={trend} className="mb-2" />}
          <ul className="flex flex-col gap-1.5">
            {[...attempts].reverse().map((a, k) => (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/50 px-3 py-2">
                <span className="num-badge h-7 min-w-9 shrink-0 rounded-full bg-surface px-2 text-[11px] font-semibold ring-1 ring-border">{a.pct}%</span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block font-medium">Attempt {attempts.length - k} · {a.right}/{a.total} right</span>
                  <span className="block text-[11px] text-muted">{when(a.finished_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-2">
        <button onClick={() => downloadCsv()} className="h-9 flex-1 rounded-lg border border-border bg-surface-2 text-xs font-medium hover:bg-surface">Export CSV</button>
        <button onClick={() => printReport()} className="h-9 flex-1 rounded-lg border border-border bg-surface-2 text-xs font-medium hover:bg-surface">Print report</button>
      </div>
    </div>
  )
}

const STEPS = [
  { t: 'Start the viva', d: 'A new examiner call opens. The tutor chat closes.' },
  { t: 'Five questions', d: 'Each one is new. Answer out loud, or click the part on the 3D rig.' },
  { t: 'Your result', d: 'Score, feedback and every answer are saved here and in your CSV.' },
]

/**
 * The viva is its own call with its own examiner and its own chat. The examiner
 * writes every question fresh; nothing is pre-built here. This tab shows the
 * current question, the small viva chat, and how each answer went.
 */
export function VivaTab({
  sessionOn, callMode, onStart, onEnd,
}: {
  sessionOn: boolean
  callMode: 'repair' | 'pelton' | 'viva'
  onStart: () => void
  onEnd: () => void
}) {
  const viva = useLab((s) => s.viva)
  const requested = useLab((s) => s.vivaRequested)
  const transcript = useScene((s) => s.transcript)
  const chat = transcript.filter((l) => l.ch === 'viva' && l.role !== 'tool')
  const history = viva?.history ?? []
  const current = viva?.current ?? null
  const total = current?.total ?? 5
  const graded = history.filter((h) => h.correct !== null && h.correct !== undefined)
  const right = graded.filter((h) => h.correct).length
  const pct = graded.length ? Math.round((right / graded.length) * 100) : 0
  const inViva = sessionOn && callMode === 'viva'
  const started = !!viva && (history.length > 0 || !!current || viva.finished)

  const reset = () => { void api('/api/lab/reset', { method: 'POST' }) }

  // 1. Not started: a clear way in.
  if (!started && !inViva && !requested) {
    return (
      <div className="flex flex-col gap-5 text-[13px]">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-2/60 p-5 text-center">
          <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-2xl">🎤</span>
          <h2 className="mt-3 font-serif text-[18px] font-semibold">Oral viva</h2>
          <p className="mx-auto mt-1 max-w-[290px] leading-relaxed text-muted">Five fresh questions from a voice examiner. No hints, no labels, no explode.</p>
          <button onClick={onStart} className="mt-4 h-11 w-full rounded-xl bg-accent text-sm font-semibold text-white hover:opacity-90">
            Start the viva
          </button>
          <p className="mt-2 text-[11px] text-muted">Allow the microphone when asked. You can also just say “start the viva” to the tutor.</p>
        </div>
        <ol className="flex flex-col gap-2">
          {STEPS.map((x, i) => (
            <li key={x.t} className="flex gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5">
              <span className="num-badge mt-px h-6 w-6 shrink-0 rounded-full bg-accent/15 text-[11px] font-semibold text-accent">{i + 1}</span>
              <span><b className="block font-medium">{x.t}</b><span className="text-muted">{x.d}</span></span>
            </li>
          ))}
        </ol>
        <Footer />
      </div>
    )
  }

  // 2. Call is connecting / waiting for the student to say ready.
  if (!current && !viva?.finished && history.length === 0) {
    return (
      <div className="flex flex-col gap-4 text-[13px]">
        <div className="rounded-2xl border border-accent/40 bg-accent/[0.05] p-5 text-center">
          <div className="mx-auto flex w-fit gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-2.5 w-2.5 rounded-full bg-accent" animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </div>
          <h2 className="mt-3 font-serif text-[16px] font-semibold">{inViva ? 'Examiner connected' : 'Starting your viva'}</h2>
          <p className="mx-auto mt-1 max-w-[270px] leading-relaxed text-muted">
            {inViva ? 'Say “ready” when you want question one.' : 'Opening a new examiner call. Allow the microphone if asked.'}
          </p>
        </div>
        <ChatWindow lines={chat} />
        {inViva && <button onClick={onEnd} className="h-9 rounded-lg border border-border bg-surface-2 text-xs font-medium hover:bg-surface">Cancel</button>}
      </div>
    )
  }

  // 3. In progress or finished.
  return (
    <div className="flex flex-col gap-3.5 text-[13px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-[16px] font-semibold">{viva?.finished ? 'Viva complete' : 'Viva in progress'}</h2>
          <p className="text-[11.5px] text-muted">{viva?.finished ? 'Everything is saved below.' : 'Answer by voice, or click on the rig when asked.'}</p>
        </div>
        <div className="text-right">
          <div className="font-serif text-[22px] font-semibold leading-none tabular-nums">{right}<span className="text-muted">/{graded.length}</span></div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted">score</div>
        </div>
      </div>

      {current && (
        <motion.section
          key={current.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-accent/50 bg-accent/[0.06] p-4 shadow-sm"
        >
          <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider">
            <span className="text-accent">Question {current.number ?? history.length + 1} of {total}</span>
            <span className="rounded-full bg-surface px-2 py-0.5 normal-case tracking-normal text-fg ring-1 ring-border">{KIND[current.kind].label}</span>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden>
            {Array.from({ length: total }, (_, k) => (
              <span key={k} className={cn('h-1 flex-1 rounded-full', k < history.length ? (history[k]?.correct ? 'bg-live' : 'bg-red-500') : k === history.length ? 'bg-accent' : 'bg-border')} />
            ))}
          </div>
          <p className="mt-3 text-[15px] font-medium leading-snug"><RichText text={current.question} /></p>
          {current.options && current.options.length > 0 && (
            <ol className="mt-3 flex flex-col gap-1.5">
              {current.options.map((o, k) => (
                <li key={k} className="flex items-start gap-2.5 rounded-lg border border-border bg-surface px-3 py-2">
                  <span className="num-badge mt-px h-5 w-5 shrink-0 rounded-full bg-surface-2 text-[10.5px] font-semibold ring-1 ring-border">{'ABCDEF'[k]}</span>
                  <span><RichText text={o} /></span>
                </li>
              ))}
            </ol>
          )}
          <div className={cn(
            'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium',
            current.kind === 'point' ? 'bg-speak/10 text-speak' : 'bg-surface text-muted ring-1 ring-border',
          )}>
            <span className={cn('h-2 w-2 shrink-0 rounded-full', current.kind === 'point' ? 'animate-pulse bg-speak' : 'bg-muted/50')} />
            {KIND[current.kind].how}
          </div>
        </motion.section>
      )}

      {!viva?.finished && <ChatWindow lines={chat} />}

      {viva?.finished && (
        <section className="rounded-2xl border border-accent/40 bg-accent/[0.06] p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Examiner feedback</div>
            <div className="font-serif text-[22px] font-semibold leading-none tabular-nums">{pct}%</div>
          </div>
          {viva.summary && <p className="mt-2 leading-relaxed"><RichText text={viva.summary} /></p>}
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Your answers</h3>
          <ol className="flex flex-col gap-2">
            {[...history].reverse().map((h) => <Result key={h.n} item={h} />)}
          </ol>
        </section>
      )}

      {inViva && <button onClick={onEnd} className="h-9 rounded-lg border border-border bg-surface-2 text-xs font-medium hover:bg-surface">End viva call</button>}

      {viva?.finished && (
        <div className="flex gap-2">
          <button onClick={() => { reset(); onStart() }} className="h-10 flex-1 rounded-xl bg-accent text-xs font-semibold text-white hover:opacity-90">Start another viva</button>
          <button onClick={reset} className="h-10 rounded-xl border border-border bg-surface-2 px-4 text-xs font-medium hover:bg-surface">Clear</button>
        </div>
      )}

      <Footer />
    </div>
  )
}

/** The small viva-only chat: separate from the tutor chat. */
function ChatWindow({ lines }: { lines: ReturnType<typeof useScene.getState>['transcript'] }) {
  return (
    <section aria-label="Viva chat" className="rounded-2xl border border-border bg-surface-2/40">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted">
        <span>Viva chat</span><span className="font-normal normal-case tracking-normal">separate from the tutor</span>
      </div>
      <div className="scroll-thin h-44 overflow-y-auto p-3">
        <ChatLines lines={lines} empty="The examiner’s questions and your answers appear here." />
      </div>
    </section>
  )
}
