import { useLab, readingsFor } from '../store'
import { netLoadKg } from '../physics'
import { cn } from '../../lib/utils'

function Slider({
  id, label, value, min, max, step, unit, onChange, hint,
}: {
  id: string; label: string; value: number; min: number; max: number; step: number
  unit: string; onChange: (v: number) => void; hint?: string
}) {
  return (
    <div className="min-w-[150px] flex-1">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</label>
        <span className="tabular-nums text-[13px] font-semibold">{value}<span className="ml-0.5 text-[11px] font-normal text-muted">{unit}</span></span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-[rgb(var(--accent))]"
      />
      {hint && <div className="mt-0.5 text-[10.5px] text-muted">{hint}</div>}
    </div>
  )
}

function Gauge({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/60 px-2.5 py-1.5 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="tabular-nums text-[14px] font-semibold leading-tight">{value}</div>
      <div className="text-[9.5px] text-muted">{unit}</div>
    </div>
  )
}

/** The bench: pump, spear, brake weights and the live gauge readouts. */
export function ControlDesk() {
  const rig = useLab((s) => s.rig)
  const setRig = useLab((s) => s.setRig)
  const record = useLab((s) => s.record)
  const rowCount = useLab((s) => s.rows.length)
  const live = readingsFor(rig)
  const net = netLoadKg(rig.deadWeightKg, rig.springKg)

  return (
    <section aria-label="Control desk" className="shrink-0 rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <button
          role="switch"
          aria-checked={rig.pumpOn}
          onClick={() => setRig({ pumpOn: !rig.pumpOn })}
          className={cn(
            'flex h-10 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors',
            rig.pumpOn ? 'border-live/50 bg-live/10 text-live' : 'border-border bg-surface-2 text-fg hover:bg-surface',
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', rig.pumpOn ? 'bg-live' : 'bg-muted/50')} />
          Pump {rig.pumpOn ? 'ON' : 'OFF'}
        </button>

        <Slider id="nozzle" label="Nozzle opening" value={rig.nozzleStep} min={1} max={8} step={1} unit={`/8`} onChange={(v) => setRig({ nozzleStep: v })} hint="Spear position 1/8 to 8/8" />
        <Slider id="t1" label="Dead weights T1" value={rig.deadWeightKg} min={0} max={40} step={0.5} unit=" kg" onChange={(v) => setRig({ deadWeightKg: v })} hint="Load on the hanger" />
        <Slider id="t2" label="Spring balance T2" value={rig.springKg} min={0} max={2} step={0.05} unit=" kg" onChange={(v) => setRig({ springKg: Math.round(v * 100) / 100 })} hint={`Net load T = ${net.toFixed(2)} kg`} />

        <button
          onClick={record}
          disabled={!rig.pumpOn}
          title={rig.pumpOn ? 'Add the current readings to the observation table' : 'Start the pump first'}
          className="h-10 shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Record reading{rowCount ? ` (${rowCount})` : ''}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Gauge label="P1 throat" value={live.p1.toFixed(2)} unit="kg/cm²" />
        <Gauge label="P2 inlet" value={live.p2.toFixed(2)} unit="kg/cm²" />
        <Gauge label="Pp penstock" value={live.pp.toFixed(2)} unit="kg/cm²" />
        <Gauge label="Speed N" value={String(live.speedRpm)} unit="rpm" />
        <Gauge label="Net load T" value={net.toFixed(2)} unit="kg" />
        <Gauge label="Spring T2" value={rig.springKg.toFixed(2)} unit="kg" />
      </div>
    </section>
  )
}
