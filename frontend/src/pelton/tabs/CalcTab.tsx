import { useLab } from '../store'
import { LineChart } from '../ui/LineChart'
import { cn } from '../../lib/utils'

/** Worked formulas for one recorded row, plus the three characteristic graphs. */
export function CalcTab() {
  const rows = useLab((s) => s.rows)
  const activeRow = useLab((s) => s.activeRow)
  const setActiveRow = useLab((s) => s.setActiveRow)

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border py-14 text-center text-[13px] leading-relaxed text-muted">
        Nothing to calculate yet.<br />Record a row and every formula is worked out here, step by step.
      </div>
    )
  }

  const idx = Math.min(activeRow ?? rows.length - 1, rows.length - 1)
  const row = rows[idx]
  const loaded = rows.filter((r) => r.ipKw > 0)

  return (
    <div className="flex flex-col gap-5 text-[13px]">
      <div className="flex flex-wrap gap-1.5">
        {rows.map((r, i) => (
          <button
            key={r.id}
            onClick={() => setActiveRow(i)}
            aria-pressed={i === idx}
            className={cn(
              'h-7 rounded-full border px-3 text-[12px] font-medium tabular-nums transition-colors',
              i === idx ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface-2 text-muted hover:text-fg',
            )}
          >
            Row {i + 1}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          ['Net load T', `${row.netLoadKg.toFixed(2)} kg`],
          ['Speed N', `${row.speedRpm} rpm`],
          ['Brake power', `${row.bhpKw.toFixed(3)} kW`],
          ['Efficiency η', `${row.etaPct.toFixed(1)} %`],
        ].map(([k, v], i) => (
          <div key={k} className={cn('rounded-lg p-2.5', i === 3 ? 'bg-accent/10' : 'bg-surface-2/70')}>
            <div className="text-[11px] text-muted">{k}</div>
            <div className={cn('mt-0.5 text-[16px] font-semibold tabular-nums', i === 3 && 'text-accent')}>{v}</div>
          </div>
        ))}
      </div>

      <ol className="flex flex-col gap-2">
        {row.steps.map((s, i) => (
          <li key={s.key} className={cn('rounded-xl border p-3', s.key === 'eta' ? 'border-accent/40 bg-accent/[0.05]' : 'border-border bg-surface')}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-semibold"><span className="mr-1.5 tabular-nums text-muted">{i + 1}.</span>{s.label}</span>
              <span className="shrink-0 text-[14px] font-semibold tabular-nums">{Number(s.value.toPrecision(4))}<span className="ml-1 text-[11px] font-normal text-muted">{s.unit}</span></span>
            </div>
            <div className="mt-1.5 font-mono text-[12px]">{s.formula}</div>
            <div className="mt-0.5 font-mono text-[11.5px] text-muted">{s.substituted}</div>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Graphs from your table</h3>
        <LineChart title="Efficiency vs BHP" xLabel="BHP (kW)" yLabel="η (%)" peak data={loaded.map((r) => ({ x: r.bhpKw, y: r.etaPct }))} />
        <LineChart title="Brake power vs net load" xLabel="Net load T (kg)" yLabel="BHP (kW)" peak data={rows.map((r) => ({ x: r.netLoadKg, y: r.bhpKw }))} />
        <LineChart title="Efficiency vs net load" xLabel="Net load T (kg)" yLabel="η (%)" peak data={loaded.map((r) => ({ x: r.netLoadKg, y: r.etaPct }))} />
        <LineChart title="Actual discharge vs BHP" xLabel="BHP (kW)" yLabel="Qact (L/s)" data={rows.map((r) => ({ x: r.bhpKw, y: r.qActM3s * 1000 }))} />
      </section>
    </div>
  )
}
