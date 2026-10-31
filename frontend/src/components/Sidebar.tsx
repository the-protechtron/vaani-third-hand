import { useScene } from '../store'
import { useProducts } from '../products'
import { clientTools } from '../clientTools'
import { useSession, type ProcStep } from '../session'
import { PartRow } from './PartRow'
import { cn } from '../lib/utils'

function focusStep(s: ProcStep, total: number) {
  clientTools.clear_scene()
  clientTools.set_explode({ level: s.explode ?? 0 })
  clientTools.focus_part({ part_id: s.part_id })
  clientTools.highlight_part({ part_id: s.part_id, label: s.part_id.replace(/_/g, ' ') })
  clientTools.show_step({ step_number: s.n, total_steps: total, instruction: s.instruction, tool: s.tool ?? undefined, check: s.check ?? undefined })
}

/** Left rail: the procedure as a checklist, then the replacement parts. */
export function Sidebar() {
  const data = useSession((s) => s.data)
  const activeStep = useScene((s) => s.step?.n)
  const focused = useScene((s) => s.focusedPart)
  const proc = data?.procedure ?? null
  const asked = useProducts((s) => s.partsRequested)
  const parts = asked ? data?.parts ?? [] : []

  return (
    <aside aria-label="Procedure and parts" className="flex min-h-0 flex-1 flex-col gap-3">
      <section className="flex min-h-0 flex-1 basis-0 flex-col rounded-xl border border-border bg-surface p-3.5 shadow-sm">
        <div className="mb-2.5 flex shrink-0 items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
          <span>Procedure</span>
          {proc?.est_minutes ? <span className="font-normal normal-case tracking-normal">~{proc.est_minutes} min</span> : null}
        </div>

        <div className="scroll-thin -mr-1.5 min-h-0 flex-1 overflow-y-auto pr-1.5">
        {!proc ? (
          <p className="py-4 text-center text-[13px] leading-relaxed text-muted">
            Describe the fault out loud. The repair steps appear here, and you can tap a step to see it on the model.
          </p>
        ) : (
          <>
            <h2 className="font-serif text-[15px] font-semibold leading-snug">{proc.title}</h2>
            {proc.safety && (
              <div className="mt-2 line-clamp-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11.5px] leading-snug text-amber-800 dark:text-amber-200" title={proc.safety}>
                <b className="font-semibold">Safety first · </b>{proc.safety}
              </div>
            )}
            <ol className="relative mt-3 flex flex-col gap-1">
              {/* vertical guide line behind the numbered dots */}
              <span aria-hidden className="absolute bottom-3 left-[19px] top-3 w-px bg-border" />
              {proc.steps.map((s) => {
                const on = activeStep === s.n
                const done = activeStep != null && s.n < activeStep
                return (
                  <li key={s.n} className="relative">
                    <button
                      onClick={() => focusStep(s, proc.steps.length)}
                      aria-current={on ? 'step' : undefined}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-lg border px-2 py-2 text-left transition-colors',
                        on ? 'border-accent/50 bg-accent/[0.07]' : 'border-transparent hover:bg-surface-2',
                      )}
                    >
                      <span
                        className={cn(
                          'num-badge relative z-10 h-[22px] w-[22px] shrink-0 rounded-full text-[11px] font-semibold',
                          on ? 'bg-accent text-white' : done ? 'bg-live text-white' : 'bg-surface text-muted ring-1 ring-border',
                        )}
                      >
                        {done ? '✓' : s.n}
                      </span>
                      <span className="min-w-0 flex-1 pt-px">
                        <span className={cn('block text-[12.5px] leading-snug', on ? 'text-fg' : 'text-muted', !on && 'line-clamp-1')}>
                          {s.instruction}
                        </span>
                        {on && s.tool && s.tool.toLowerCase() !== 'none' && (
                          <span className="mt-1 block text-[11.5px] text-muted"><b className="font-medium text-fg">Tool</b> · {s.tool}</span>
                        )}
                        {on && s.check && (
                          <span className="mt-0.5 block text-[11.5px] text-muted"><b className="font-medium text-fg">Done when</b> · {s.check}</span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </>
        )}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 basis-0 flex-col rounded-xl border border-border bg-surface p-3.5 shadow-sm">
        <div className="mb-2.5 flex shrink-0 items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
          <span>Replacement parts</span>
          {parts.length > 0 && <span className="num-badge h-5 min-w-5 rounded-full border border-border px-1.5 text-[10px] text-fg">{parts.length}</span>}
        </div>
        {parts.length === 0 ? (
          <p className="py-4 text-center text-[13px] leading-relaxed text-muted">
            {asked ? 'No replacement parts for this fault yet.' : 'Ask “list the replacement parts” and they appear here with price and stock. Parts you mention show live shop results on the right.'}
          </p>
        ) : (
          <ul className="scroll-thin -mr-1.5 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1.5">
            {parts.map((p) => (
              <PartRow
                key={`${p.machine ?? ''}${p.id}`}
                p={p}
                compact
                active={focused === p.id}
                onClick={() => {
                  clientTools.focus_part({ part_id: p.id })
                  clientTools.highlight_part({ part_id: p.id, label: p.name })
                }}
              />
            ))}
          </ul>
        )}
        {data?.tools_needed && data.tools_needed.length > 0 && (
          <p className="mt-2.5 line-clamp-2 shrink-0 border-t border-border pt-2 text-[11.5px] leading-snug text-muted" title={data.tools_needed.join(' · ')}>
            <b className="font-medium text-fg">Tools needed</b> · {data.tools_needed.join(' · ')}
          </p>
        )}
      </section>
    </aside>
  )
}
