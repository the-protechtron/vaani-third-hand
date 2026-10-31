import { useCallback, useEffect, useState } from 'react'
import { RichText, cleanText } from './lib/text'
import { ThemeToggle } from './components/ui/theme-toggle'
import { LineChart } from './pelton/ui/LineChart'
import type { VivaAttempt } from './pelton/store'
import { cn } from './lib/utils'

interface Row { id: string; name: string | null; attempts: number; best_pct: number | null; last_pct: number | null; last_at: number | null }
interface Detail extends Row { attempts_full: VivaAttempt[] }

const KEY = 'th-teacher-key'
const getKey = () => { try { return sessionStorage.getItem(KEY) ?? '' } catch { return '' } }
const when = (t: number | null) => (t ? new Date(t * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—')

const csvCell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

/** Teacher view: every learner's viva attempts. Protected by a shared key (TEACHER_KEY in backend/.env). */
export default function TeacherView() {
  const [key, setKey] = useState(getKey())
  const [input, setInput] = useState(getKey())
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<Detail | null>(null)

  const load = useCallback(async (k: string) => {
    setError('')
    try {
      const r = await fetch(`/api/teacher/learners?key=${encodeURIComponent(k)}`)
      if (r.status === 401) { setRows(null); setError('Wrong teacher key.'); return }
      if (!r.ok) throw new Error(String(r.status))
      setRows((await r.json()).learners)
      try { sessionStorage.setItem(KEY, k) } catch { /* ignore */ }
      setKey(k)
    } catch (e: any) {
      setError(`Could not load: ${e?.message ?? e}`)
    }
  }, [])

  useEffect(() => { if (key) void load(key) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const show = async (id: string) => {
    const r = await fetch(`/api/teacher/learner/${id}?key=${encodeURIComponent(key)}`)
    if (r.ok) setOpen(await r.json())
  }

  const exportAll = () => {
    if (!rows) return
    const lines = [['Name', 'Learner id', 'Attempts', 'Best %', 'Last %', 'Last attempt'].join(',')]
    rows.forEach((r) => lines.push([r.name ?? '', r.id, r.attempts, r.best_pct ?? '', r.last_pct ?? '', when(r.last_at)].map(csvCell).join(',')))
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'pelton-viva-class.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-[17px] font-semibold leading-tight">Teacher view</h1>
          <p className="text-xs text-muted">Pelton wheel lab · viva results</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="#" className="text-xs font-medium text-accent hover:underline">← Back to the lab</a>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:p-6">
        {!rows ? (
          <form
            onSubmit={(e) => { e.preventDefault(); void load(input) }}
            className="mx-auto mt-10 flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm"
          >
            <h2 className="font-serif text-[16px] font-semibold">Enter the teacher key</h2>
            <p className="text-[13px] text-muted">Set as TEACHER_KEY in <code>backend/.env</code>. The default is <code>teacher</code>, so change it.</p>
            <input type="password" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Teacher key" className="h-10 rounded-lg border border-border bg-surface-2/60 px-3 outline-none focus:border-accent" autoFocus />
            {error && <p role="alert" className="text-[13px] text-red-500">{error}</p>}
            <button className="h-10 rounded-lg bg-accent text-sm font-semibold text-white hover:opacity-90">Open</button>
          </form>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-[16px] font-semibold">{rows.length} learner{rows.length === 1 ? '' : 's'}</h2>
              <div className="flex gap-2">
                <button onClick={() => load(key)} className="h-8 rounded-lg border border-border bg-surface-2 px-3 text-xs font-medium hover:bg-surface">Refresh</button>
                <button onClick={exportAll} className="h-8 rounded-lg border border-border bg-surface-2 px-3 text-xs font-medium hover:bg-surface">Export class CSV</button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
              <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
                <thead className="bg-surface-2/70 text-[11px] uppercase tracking-wider text-muted">
                  <tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Attempts</th><th className="px-3 py-2">Best</th><th className="px-3 py-2">Last</th><th className="px-3 py-2">Last attempt</th></tr>
                </thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted">No learners yet.</td></tr>}
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => show(r.id)} className="cursor-pointer border-t border-border hover:bg-surface-2/60">
                      <td className="px-3 py-2 font-medium">{r.name || <span className="text-muted">Unnamed · {r.id}</span>}</td>
                      <td className="px-3 py-2 tabular-nums">{r.attempts}</td>
                      <td className="px-3 py-2 tabular-nums">{r.best_pct ?? '—'}{r.best_pct != null && '%'}</td>
                      <td className="px-3 py-2 tabular-nums">{r.last_pct ?? '—'}{r.last_pct != null && '%'}</td>
                      <td className="px-3 py-2 text-muted">{when(r.last_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {open && (
              <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-[16px] font-semibold">{open.name || `Learner ${open.id}`}</h3>
                    <p className="text-xs text-muted">{open.attempts} attempt{open.attempts === 1 ? '' : 's'} · best {open.best_pct ?? '—'}%</p>
                  </div>
                  <button onClick={() => setOpen(null)} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2">Close</button>
                </div>
                {open.attempts_full.length > 1 && (
                  <LineChart className="mt-3 max-w-md" xLabel="Attempt" yLabel="Score (%)" data={open.attempts_full.map((a, i) => ({ x: i + 1, y: a.pct }))} />
                )}
                <div className="mt-3 flex flex-col gap-4">
                  {[...open.attempts_full].reverse().map((a, k) => (
                    <div key={a.id}>
                      <div className="flex items-center justify-between text-[13px] font-semibold">
                        <span>Attempt {open.attempts_full.length - k} · {a.right}/{a.total} ({a.pct}%)</span>
                        <span className="text-[11px] font-normal text-muted">{when(a.finished_at)}</span>
                      </div>
                      {a.summary && <p className="mt-1 text-[12.5px] italic text-muted">{cleanText(a.summary)}</p>}
                      <ol className="mt-2 flex flex-col gap-1.5">
                        {a.items.map((i) => (
                          <li key={i.n} className="flex gap-2.5 rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-[12.5px]">
                            <span className={cn('num-badge mt-px h-5 w-5 shrink-0 rounded-full text-[11px] font-semibold text-white', i.correct === true ? 'bg-live' : i.correct === false ? 'bg-red-500' : 'bg-muted')}>{i.correct === true ? '✓' : i.correct === false ? '✕' : '–'}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block"><RichText text={i.question} /></span>
                              <span className="block text-muted">
                                {i.answer ? <>Answer: <RichText text={i.answer} /></> : 'No answer'}
                                {i.expected && i.correct !== true && <> · Correct: <RichText text={i.expected} /></>}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
