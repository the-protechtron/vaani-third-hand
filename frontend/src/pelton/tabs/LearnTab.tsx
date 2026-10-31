import { EQUATIONS, OBJECTIVES, PELTON_WHEEL, PRINCIPLE, READING_RESULTS, SUBTITLE } from '../content'
import { useLab } from '../store'

const H = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{children}</h3>
)

/** Aim, apparatus, principle and equations: what to know before touching the rig. */
export function LearnTab() {
  const setTab = useLab((s) => s.setTab)
  return (
    <div className="flex flex-col gap-5 text-[13px] leading-relaxed">
      <div>
        <div className="text-[11px] text-muted">{SUBTITLE}</div>
        <h2 className="mt-1 font-serif text-[17px] font-semibold leading-snug">{PELTON_WHEEL.title}</h2>
        <p className="mt-2 rounded-xl border border-accent/30 bg-accent/[0.06] px-3 py-2.5 font-medium">
          <b className="text-accent">Aim · </b>{PELTON_WHEEL.aim}
        </p>
      </div>

      <section>
        <H>Objectives</H>
        <ol className="flex flex-col gap-1.5">
          {OBJECTIVES.map((o, i) => (
            <li key={o} className="flex gap-2.5 border-l-2 border-accent/50 pl-2.5">
              <span className="tabular-nums text-accent">{String(i + 1).padStart(2, '0')}</span>{o}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <H>Apparatus</H>
        <ul className="flex flex-col gap-1.5">
          {PELTON_WHEEL.apparatus.map((a, i) => (
            <li key={a} className="flex items-center gap-2.5 rounded-lg bg-surface-2/70 px-2.5 py-2">
              <span className="tabular-nums text-[11px] text-muted">{String(i + 1).padStart(2, '0')}</span>{a}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <H>Principle</H>
        <div className="flex flex-col gap-2">{PRINCIPLE.map((p) => <p key={p}>{p}</p>)}</div>
      </section>

      <section>
        <H>Equations</H>
        <div className="grid gap-2">
          {EQUATIONS.map((e) => (
            <div key={e.label} className="rounded-lg bg-surface-2/70 p-2.5">
              <div className="text-[11px] font-medium text-muted">{e.label}</div>
              <div className="mt-0.5 font-mono text-[13.5px]">{e.expr}</div>
              <div className="mt-0.5 text-[11px] text-muted">{e.note}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <H>Reading the results</H>
        <p>{READING_RESULTS}</p>
      </section>

      <div className="flex gap-2 border-t border-border pt-3">
        <button onClick={() => setTab('quiz')} className="h-9 flex-1 rounded-lg border border-border bg-surface-2 text-xs font-medium hover:bg-surface">Take the pre-test</button>
        <button onClick={() => setTab('observe')} className="h-9 flex-1 rounded-lg bg-accent text-xs font-semibold text-white hover:opacity-90">Start the experiment →</button>
      </div>
    </div>
  )
}
