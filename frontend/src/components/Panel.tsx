import { useEffect, useRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useScene } from '../store'
import { partById } from '../machines'
import type { Handoff, WebSource } from '../voiceAgent'
import { useSession, inr } from '../session'
import { HoverCardList } from './ui/hover-card-list'
import { VoiceBars, type BarsState } from './ui/voice-bars'
import { cn } from '../lib/utils'
import { RichText } from '../lib/text'
import { useProducts } from '../products'

/** The compact domain, e.g. "https://www.creality.com/x" -> "creality.com". */
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Pulls a currency amount out of a snippet/title so the card can show a price pill. */
function priceIn(s: string | undefined): string | null {
  if (!s) return null
  const m = s.match(/[₹$£€]\s?[\d][\d,.]*(?:\s?(?:k|K|cr|Cr|lakh|L))?|Rs\.?\s?[\d][\d,.]*|INR\s?[\d][\d,.]*/i)
  return m ? m[0].replace(/\s+/g, ' ').trim() : null
}

function Card({ title, aside, children, className }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-xl border border-border bg-surface p-3.5 shadow-sm', className)}
    >
      {title && (
        <div className="mb-2.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
          <span>{title}</span>
          {aside}
        </div>
      )}
      {children}
    </motion.section>
  )
}

const HINTS_IDLE = ['"My extruder is clicking"', '"Show me the nozzle"', '"Explode the view"']
const HINTS_PROC = ['"Next step"', '"Where is that part?"', '"How much is the replacement?"', '"Order it"']

export function Panel({
  sources,
  handoff,
  status = 'idle',
  sessionOn = false,
}: {
  sources?: WebSource[]
  handoff?: Handoff | null
  status?: 'idle' | 'listening' | 'thinking' | 'speaking'
  sessionOn?: boolean
}) {
  const s = useSession((x) => x.data)
  const fullTranscript = useScene((x) => x.transcript)
  // scene chatter ("camera -> ...", "explode -> ...") is noise; keep real events
  const transcript = fullTranscript.filter((l) => l.role !== 'tool' || /error|fail|ended|connected|pausing/i.test(l.text))
  const pointer = useScene((x) => x.pointerPart)
  const machine = useScene((x) => x.machine)
  const endRef = useRef<HTMLDivElement>(null)

  // keep the newest line in view
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [transcript.length])

  const recent = useProducts((x) => x.recent)
  const entries = useProducts((x) => x.entries)
  const shown = recent.map((k) => entries[k]).filter((e) => e && e.machine === machine.id)
  const hasCards = !!(handoff || shown.length || (s && s.cart.length) || s?.report || (sources && sources.length))
  const last = transcript[transcript.length - 1]
  // user spoke last and the agent is not talking yet -> it is working on a reply
  const thinking = sessionOn && last?.role === 'user' && status !== 'speaking'
  const barsState: BarsState = !sessionOn ? 'off' : thinking ? 'thinking' : status === 'speaking' ? 'speaking' : 'listening'
  const hints = s?.procedure ? HINTS_PROC : HINTS_IDLE

  return (
    <aside aria-label="Session details" className="flex min-h-0 flex-col gap-3">
      {/* fixed-height strip: always there, so the panel never jumps when you hover */}
      <div
        aria-live="polite"
        className={cn(
          'flex h-11 shrink-0 items-center gap-2.5 rounded-xl border border-dashed px-3.5 text-[13px] transition-colors',
          pointer ? 'border-accent/60 bg-accent/[0.07] text-accent' : 'border-border text-muted',
        )}
      >
        <span className={cn('h-2 w-2 shrink-0 rounded-full', pointer ? 'bg-accent' : 'bg-muted/40')} />
        <span className="truncate">
          {pointer ? (
            <>Pointing at <b className="font-semibold">{partById(machine, pointer)?.label}</b> — try saying “what is this?”</>
          ) : (
            'Hover a part on the model to point at it'
          )}
        </span>
      </div>

      <div className={cn('scroll-thin flex min-h-0 flex-col gap-3 overflow-y-auto pr-0.5', hasCards ? 'max-h-[42%]' : 'hidden')}>
        {handoff && <Card title="Technician handoff">
          {handoff.state === 'loading' && <p className="text-sm text-muted">Preparing the handoff…</p>}
          {handoff.state === 'error' && <p role="alert" className="text-sm text-muted">{handoff.error}</p>}
          {handoff.state === 'ready' && <>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{handoff.summary}</p>
            <button className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
              onClick={() => void navigator.clipboard.writeText(handoff.summary ?? '')}>Copy for technician</button>
          </>}
        </Card>}
        {s && s.cart.length > 0 && (
          <Card title="Parts ordered">
            <div className="flex flex-col gap-1.5 text-[13px]">
              {s.cart.map((c) => (
                <div key={c.order_id} className="flex justify-between gap-3">
                  <span>{c.qty} × {c.name}</span>
                  <span className="shrink-0 text-muted">{inr(c.price_inr)} · {c.eta_days}d</span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 border-t border-border pt-2 text-right text-sm font-semibold">Total {inr(s.cart_total_inr)}</div>
          </Card>
        )}

        {s?.report && (
          <Card title={`Service record ${s.report.session_id}`}>
            <dl className="flex flex-col gap-1.5 text-[13px] leading-relaxed">
              {[['Root cause', s.report.root_cause || '—'], ['Outcome', s.report.outcome], ['Summary', s.report.summary]].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-20 shrink-0 text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {shown.map((e) => (
          <Card
            key={e.key}
            title={`Live products · ${e.label}`}
            aside={e.state === 'ok' ? <span className="num-badge h-5 min-w-5 rounded-full border border-border px-1.5 text-[10px] text-fg">{e.products.length}</span> : null}
          >
            {e.state === 'loading' && (
              <div className="flex flex-col gap-2" aria-label="Searching the web">
                {[0, 1].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />)}
                <span className="text-[11px] text-muted">Searching the web for {e.label}…</span>
              </div>
            )}
            {e.state === 'error' && <p className="text-[12px] text-muted">Live search unavailable right now. {e.error}</p>}
            {e.state === 'ok' && e.products.length === 0 && <p className="text-[12px] text-muted">No shop results found for this part.</p>}
            {e.state === 'ok' && e.products.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {e.products.map((p) => (
                  <li key={p.url}>
                    <a href={p.url} target="_blank" rel="noreferrer" className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-2/50 px-2.5 py-2 hover:border-accent/40">
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[12.5px] font-medium leading-snug">{p.title}</span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="truncate text-[11px] text-speak">{p.domain}</span>
                          {p.price && <span className="rounded-full bg-live/15 px-2 text-[11px] font-semibold text-live">{p.price}</span>}
                        </span>
                      </span>
                      <span aria-hidden className="pt-0.5 text-muted">↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}

        {sources && sources.length > 0 && (
          <Card
            title="Live web"
            aside={<span className="num-badge h-5 min-w-5 rounded-full border border-border px-1.5 text-[10px] text-fg">{sources.length}</span>}
          >
            <HoverCardList
              items={sources.slice(-4)}
              keyOf={(src, i) => `${src.url}-${i}`}
              render={(src, i) => {
                const price = priceIn(src.snippet || src.title)
                return (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-2.5 rounded-xl px-2.5 py-2"
                  >
                    <span className="pt-0.5 font-mono text-[10px] text-muted">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="line-clamp-2 text-[13px] font-medium leading-snug">{src.title || src.url}</span>
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[11px] text-speak">{domainOf(src.url)}</span>
                        {price && <span className="rounded-full bg-live/15 px-2 text-[11px] font-semibold text-live">{price}</span>}
                      </span>
                      {src.snippet && <span className="line-clamp-2 text-xs leading-relaxed text-muted">{src.snippet}</span>}
                    </span>
                    <span aria-hidden className="pt-0.5 text-muted">↗</span>
                  </a>
                )
              }}
            />
          </Card>
        )}
      </div>

      <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5">
          <div className="flex items-center gap-2.5">
            <VoiceBars state={barsState} />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {barsState === 'off' ? 'Conversation' : barsState === 'speaking' ? 'Agent speaking' : barsState === 'thinking' ? 'Thinking' : 'Listening'}
            </span>
          </div>
          {transcript.length > 0 && <span className="text-[11px] text-muted">{transcript.length} messages</span>}
        </div>
        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3.5" aria-live="polite">
          {transcript.slice(-40).map((l, i) =>
            l.role === 'tool' ? (
              <div key={i} className="font-mono text-[11px] leading-relaxed text-muted">› {l.text}</div>
            ) : (
              <div key={i} className={cn('flex flex-col gap-0.5', l.role === 'user' && 'items-end')}>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{l.role === 'agent' ? 'Third Hand' : 'You'}</span>
                <div
                  className={cn(
                    'max-w-[92%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
                    l.role === 'agent' ? 'rounded-tl-sm bg-surface-2' : 'rounded-tr-sm bg-accent/15',
                  )}
                >
                  <RichText text={l.text} />
                </div>
              </div>
            ),
          )}
          {transcript.length === 0 && (
            <div className="m-auto max-w-[220px] text-center text-[13px] leading-relaxed text-muted">
              Start the session and describe the fault. The conversation appears here.
            </div>
          )}
          {thinking && (
            <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-sm bg-surface-2 px-3.5 py-3" aria-label="Third Hand is thinking">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-muted"
                  animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
        {sessionOn && (
          <div className="border-t border-border px-3.5 py-2.5">
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted">Try saying</div>
            <div className="flex flex-wrap gap-1.5">
              {hints.map((h) => (
                <span key={h} className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[12px] text-muted">{h}</span>
              ))}
            </div>
          </div>
        )}
      </section>
    </aside>
  )
}
