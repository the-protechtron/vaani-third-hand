import { PELTON_WHEEL, autoDone } from './content'
import { useLab, readingsFor } from './store'
import { cn } from '../lib/utils'

const labelOf = (id: string) => PELTON_WHEEL.components.find((c) => c.id === id)?.label ?? id

/** Left rail of the lab: the nine-step procedure, then the parts of the rig. 50/50, each scrolls. */
export function LabSidebar() {
  const stepIndex = useLab((s) => s.stepIndex)
  const manualDone = useLab((s) => s.manualDone)
  const rig = useLab((s) => s.rig)
  const rowCount = useLab((s) => s.rows.length)
  const openStep = useLab((s) => s.openStep)
  const toggleStep = useLab((s) => s.toggleStep)
  const selected = useLab((s) => s.selected)
  const select = useLab((s) => s.select)
  const setForce = useLab((s) => s.setForceHighlight)
  const vivaOn = useLab((s) => !!s.viva?.active && !s.viva.finished)

  const live = readingsFor(rig)
  const steps = PELTON_WHEEL.procedure
  const done = steps.map((_, i) => !!manualDone[i] || autoDone(i, live, rowCount))
  const doneCount = done.filter(Boolean).length
  const current = steps[stepIndex]

  return (
    <aside aria-label="Procedure and components" className="flex min-h-0 flex-1 flex-col gap-3">
      <section className="flex min-h-0 flex-1 basis-0 flex-col rounded-xl border border-border bg-surface p-3.5 shadow-sm">
        <div className="mb-2.5 flex shrink-0 items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
          <span>Procedure</span>
          <span className="font-normal normal-case tracking-normal">{doneCount}/{steps.length} done</span>
        </div>
        <div className="mb-2.5 h-1 shrink-0 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>

        <ol className="scroll-thin relative -mr-1.5 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1.5">
          <span aria-hidden className="absolute bottom-3 left-[19px] top-3 w-px bg-border" />
          {steps.map((s, i) => {
            const on = i === stepIndex
            return (
              <li key={s.step} className="relative">
                <div
                  className={cn(
                    'flex items-start gap-3 rounded-lg border px-2 py-2 transition-colors',
                    on ? 'border-accent/50 bg-accent/[0.07]' : 'border-transparent hover:bg-surface-2',
                  )}
                >
                  <button
                    onClick={() => toggleStep(i)}
                    aria-label={`Mark step ${s.step} ${done[i] ? 'not done' : 'done'}`}
                    aria-pressed={done[i]}
                    className={cn(
                      'num-badge relative z-10 h-[22px] w-[22px] shrink-0 rounded-full text-[11px] font-semibold',
                      on ? 'bg-accent text-white' : done[i] ? 'bg-live text-white' : 'bg-surface text-muted ring-1 ring-border',
                    )}
                  >
                    {done[i] ? '✓' : s.step}
                  </button>
                  <button
                    onClick={() => openStep(i)}
                    aria-current={on ? 'step' : undefined}
                    className="min-w-0 flex-1 pt-px text-left"
                  >
                    <span className={cn('block text-[12.5px] leading-snug', on ? 'text-fg' : 'text-muted', !on && 'line-clamp-2')}>{s.text}</span>
                    {on && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {s.highlight.map((id) => (
                          <span key={id} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] text-muted ring-1 ring-border">{labelOf(id)}</span>
                        ))}
                      </span>
                    )}
                  </button>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="mt-2.5 flex shrink-0 gap-2 border-t border-border pt-2.5">
          <button
            onClick={() => openStep(Math.max(0, stepIndex - 1))}
            disabled={stepIndex === 0}
            className="h-8 flex-1 rounded-lg border border-border bg-surface-2 text-xs font-medium hover:bg-surface disabled:opacity-40"
          >
            ← Previous
          </button>
          <button
            onClick={() => { toggleStep(stepIndex); setForce(null); openStep(Math.min(steps.length - 1, stepIndex + 1)) }}
            disabled={stepIndex === steps.length - 1}
            className="h-8 flex-1 rounded-lg bg-accent text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
            title={current ? `Done with step ${current.step}, go to the next` : undefined}
          >
            Done · Next →
          </button>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 basis-0 flex-col rounded-xl border border-border bg-surface p-3.5 shadow-sm">
        <div className="mb-2.5 flex shrink-0 items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
          <span>Components</span>
          <span className="num-badge h-5 min-w-5 rounded-full border border-border px-1.5 text-[10px] text-fg">{PELTON_WHEEL.components.length}</span>
        </div>
        <ul className="scroll-thin -mr-1.5 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1.5">
          {PELTON_WHEEL.components.map((c, i) => {
            const on = selected === c.id
            return (
              <li key={c.id}>
                <button
                  onClick={() => select(on ? null : c.id)}
                  disabled={vivaOn}
                  title={vivaOn ? 'Locked during the viva' : undefined}
                  aria-pressed={on}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-lg border px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    on ? 'border-speak/50 bg-speak/[0.07]' : 'border-transparent hover:bg-surface-2',
                  )}
                >
                  <span className={cn('num-badge mt-px h-[20px] w-[20px] shrink-0 rounded-full text-[10px] font-semibold', on ? 'bg-speak text-white' : 'bg-surface-2 text-muted ring-1 ring-border')}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium leading-snug">{c.label}</span>
                    {on && (
                      <span className="mt-1 block text-[11.5px] leading-snug text-muted">
                        {c.description}
                        {c.specs.length > 0 && <span className="mt-1 block text-fg">{c.specs.join(' · ')}</span>}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </aside>
  )
}
