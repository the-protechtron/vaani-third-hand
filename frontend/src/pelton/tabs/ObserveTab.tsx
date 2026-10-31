import { useLab } from '../store'
import { downloadCsv, printReport } from '../report'
import { cn } from '../../lib/utils'

const COLS: { label: string; unit: string; get: (r: ReturnType<typeof useLab.getState>['rows'][number]) => string }[] = [
  { label: 'Nozzle', unit: '/8', get: (r) => String(r.nozzleStep) },
  { label: 'T1', unit: 'kg', get: (r) => r.deadWeightKg.toFixed(2) },
  { label: 'T2', unit: 'kg', get: (r) => r.springKg.toFixed(2) },
  { label: 'T', unit: 'kg', get: (r) => r.netLoadKg.toFixed(2) },
  { label: 'N', unit: 'rpm', get: (r) => String(r.speedRpm) },
  { label: 'P1', unit: 'kg/cm²', get: (r) => r.p1.toFixed(3) },
  { label: 'P2', unit: 'kg/cm²', get: (r) => r.p2.toFixed(3) },
  { label: 'Pp', unit: 'kg/cm²', get: (r) => r.pp.toFixed(3) },
  { label: 'BHP', unit: 'kW', get: (r) => r.bhpKw.toFixed(3) },
  { label: 'IHP', unit: 'kW', get: (r) => r.ipKw.toFixed(3) },
  { label: 'η', unit: '%', get: (r) => r.etaPct.toFixed(1) },
]

/** The observation table. Rows come from the Record button or a one-click load sweep. */
export function ObserveTab() {
  const rows = useLab((s) => s.rows)
  const rig = useLab((s) => s.rig)
  const record = useLab((s) => s.record)
  const runSweep = useLab((s) => s.runSweep)
  const removeRow = useLab((s) => s.removeRow)
  const clearRows = useLab((s) => s.clearRows)
  const setActiveRow = useLab((s) => s.setActiveRow)
  const setTab = useLab((s) => s.setTab)
  const activeRow = useLab((s) => s.activeRow)

  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <p className="leading-relaxed text-muted">
        Set the nozzle and the load on the control desk, then <b className="text-fg">record a reading</b>. Repeat for different loads (procedure steps 6 to 9). Three or more rows tick step 9.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={record}
          disabled={!rig.pumpOn}
          className="h-9 rounded-lg bg-accent px-3.5 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Record reading
        </button>
        <button
          onClick={() => { useLab.getState().setRig({ pumpOn: true }); runSweep() }}
          className="h-9 rounded-lg border border-border bg-surface-2 px-3.5 text-xs font-medium hover:bg-surface"
          title="Adds 8 readings from light load up to near stall at the current nozzle opening"
        >
          Auto-run load sweep
        </button>
        {rows.length > 0 && (
          <button onClick={() => downloadCsv()} className="h-9 rounded-lg border border-border bg-surface-2 px-3.5 text-xs font-medium hover:bg-surface" title="Download the table, quiz scores and viva results as a spreadsheet">Export CSV</button>
        )}
        {rows.length > 0 && (
          <button onClick={() => printReport()} className="h-9 rounded-lg border border-border bg-surface-2 px-3.5 text-xs font-medium hover:bg-surface" title="Open a printable report (save as PDF)">Print report</button>
        )}
        {rows.length > 0 && (
          <button onClick={clearRows} className="h-9 rounded-lg px-3 text-xs font-medium text-muted hover:bg-surface-2">Clear table</button>
        )}
      </div>
      {!rig.pumpOn && <p className="rounded-lg bg-amber-500/10 px-2.5 py-2 text-[12px] text-amber-800 dark:text-amber-200">The pump is off. Start it in the control desk (procedure step 2) to take readings.</p>}

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border py-12 text-center text-[13px] text-muted">
          No readings yet.<br />Your table fills in here.
        </div>
      ) : (
        <div className="scroll-thin overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] border-collapse text-right text-[12px] tabular-nums">
            <thead className="bg-surface-2/70">
              <tr>
                <th className="px-2 py-1.5 text-left text-[10.5px] font-semibold text-muted">#</th>
                {COLS.map((c) => (
                  <th key={c.label} className="px-2 py-1.5 font-semibold">
                    {c.label}<div className="text-[9.5px] font-normal text-muted">{c.unit}</div>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  onClick={() => { setActiveRow(i); setTab('calc') }}
                  className={cn('cursor-pointer border-t border-border hover:bg-surface-2/60', activeRow === i && 'bg-accent/[0.06]')}
                  title="Open this row in Calculate"
                >
                  <td className="px-2 py-1.5 text-left text-muted">{i + 1}</td>
                  {COLS.map((c) => <td key={c.label} className="px-2 py-1.5">{c.get(r)}</td>)}
                  <td className="px-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); removeRow(r.id) }}
                      aria-label={`Delete row ${i + 1}`}
                      className="rounded px-1.5 py-0.5 text-muted hover:bg-red-500/10 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
