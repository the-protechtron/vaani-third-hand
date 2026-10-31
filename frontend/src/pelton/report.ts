import { useLab, type VivaAttempt, type VivaItem } from './store'
import { useSession } from '../session'
import { learnerId, learnerName } from '../learner'
import { cleanText } from '../lib/text'

interface Report {
  name: string
  id: string
  when: string
  rows: ReturnType<typeof useLab.getState>['rows']
  quiz: ReturnType<typeof useLab.getState>['quiz']
  attempts: VivaAttempt[]
  /** a viva that has questions but is not finished yet */
  openViva: VivaItem[]
}

const pctOf = (n?: number, t?: number) => (n != null && t ? `${Math.round((100 * n) / t)}%` : '')
const stamp = (t: number) => new Date(t).toLocaleString()
const resultOf = (i: VivaItem) => (i.correct === true ? 'Correct' : i.correct === false ? 'Incorrect' : 'Skipped')

function collect(attemptsOverride?: VivaAttempt[]): Report {
  const lab = useLab.getState()
  const server = useSession.getState().data?.lab
  return {
    name: server?.name || learnerName() || 'Student',
    id: learnerId(),
    when: new Date().toLocaleString(),
    rows: lab.rows,
    quiz: lab.quiz,
    attempts: attemptsOverride ?? server?.attempts ?? [],
    openViva: server && !server.viva.finished ? server.viva.history : [],
  }
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',')

export function buildCsv(r: Report = collect()): string {
  const out: string[] = [
    csvRow(['Pelton wheel lab report']),
    csvRow(['Student', r.name]), csvRow(['Learner id', r.id]), csvRow(['Exported', r.when]), '',
    csvRow(['SCORE SUMMARY']),
    csvRow(['Item', 'Score', 'Percent']),
    csvRow(['Pre-test', r.quiz.pre ? `${r.quiz.pre.score}/${r.quiz.pre.total}` : 'not taken', pctOf(r.quiz.pre?.score, r.quiz.pre?.total)]),
    csvRow(['Post-test', r.quiz.post ? `${r.quiz.post.score}/${r.quiz.post.total}` : 'not taken', pctOf(r.quiz.post?.score, r.quiz.post?.total)]),
    ...r.attempts.map((a, k) => csvRow([`Viva attempt ${k + 1} (${stamp(a.finished_at * 1000)})`, `${a.right}/${a.total}`, `${a.pct}%`])),
    csvRow(['Viva best', r.attempts.length ? `${Math.max(...r.attempts.map((a) => a.pct))}%` : 'no attempts', '']),
    csvRow(['Viva average', r.attempts.length ? `${Math.round(r.attempts.reduce((n, a) => n + a.pct, 0) / r.attempts.length)}%` : 'no attempts', '']),
    csvRow(['Readings recorded', r.rows.length, '']),
    csvRow(['Peak efficiency in your table', r.rows.length ? `${Math.max(...r.rows.map((x) => x.etaPct))} %` : 'no readings', '']),
    '',
    csvRow(['OBSERVATIONS']),
    csvRow(['Row', 'Nozzle /8', 'T1 kg', 'T2 kg', 'T kg', 'N rpm', 'P1 kg/cm2', 'P2 kg/cm2', 'Pp kg/cm2', 'BHP kW', 'IHP kW', 'Efficiency %']),
    ...r.rows.map((x, i) => csvRow([i + 1, x.nozzleStep, x.deadWeightKg, x.springKg, x.netLoadKg, x.speedRpm, x.p1, x.p2, x.pp, x.bhpKw, x.ipKw, x.etaPct])),
    '',
    csvRow(['QUIZ']),
    csvRow(['Pre-test', r.quiz.pre ? `${r.quiz.pre.score}/${r.quiz.pre.total}` : 'not taken']),
    csvRow(['Post-test', r.quiz.post ? `${r.quiz.post.score}/${r.quiz.post.total}` : 'not taken']),
    '',
    csvRow(['VIVA ATTEMPTS']),
  ]
  if (r.attempts.length === 0 && r.openViva.length === 0) out.push(csvRow(['No viva attempts yet']))
  if (r.openViva.length > 0) {
    out.push(csvRow(['Viva in progress (not finished)']))
    out.push(csvRow(['Q', 'Kind', 'Question', 'Student answer', 'Correct answer', 'Result', 'Feedback']))
    r.openViva.forEach((i) => out.push(csvRow([i.n, i.kind, cleanText(i.question), cleanText(i.answer ?? ''), cleanText(i.expected ?? ''), resultOf(i), cleanText(i.feedback ?? '')])))
    out.push('')
  }
  r.attempts.forEach((a, k) => {
    out.push(csvRow([`Attempt ${k + 1}`, stamp(a.finished_at * 1000), `${a.right}/${a.total}`, `${a.pct}%`, cleanText(a.summary ?? '')]))
    out.push(csvRow(['Q', 'Kind', 'Question', 'Student answer', 'Correct answer', 'Result', 'Feedback']))
    a.items.forEach((i) => out.push(csvRow([i.n, i.kind, cleanText(i.question), cleanText(i.answer ?? ''), cleanText(i.expected ?? ''), resultOf(i), cleanText(i.feedback ?? '')])))
    out.push('')
  })
  return out.join('\r\n')
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const downloadCsv = (r?: Report) => download('pelton-lab-report.csv', '﻿' + buildCsv(r), 'text/csv;charset=utf-8')

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Opens a clean page the student can print or save as PDF. */
export function printReport(r: Report = collect()) {
  const w = window.open('', '_blank')
  if (!w) return false
  const rows = r.rows.map((x, i) => `<tr><td>${i + 1}</td><td>${x.nozzleStep}</td><td>${x.deadWeightKg}</td><td>${x.springKg}</td><td>${x.netLoadKg}</td><td>${x.speedRpm}</td><td>${x.p1}</td><td>${x.p2}</td><td>${x.pp}</td><td>${x.bhpKw}</td><td>${x.ipKw}</td><td>${x.etaPct}</td></tr>`).join('')
  const att = r.attempts.map((a, k) => `<h3>Attempt ${k + 1} · ${a.right}/${a.total} (${a.pct}%) · ${esc(stamp(a.finished_at * 1000))}</h3>${a.summary ? `<p><i>${esc(cleanText(a.summary))}</i></p>` : ''}<table><tr><th>Q</th><th>Question</th><th>Your answer</th><th>Correct answer</th><th>Result</th></tr>${a.items.map((i) => `<tr><td>${i.n}</td><td>${esc(cleanText(i.question))}</td><td>${esc(cleanText(i.answer ?? ''))}</td><td>${esc(cleanText(i.expected ?? ''))}</td><td>${resultOf(i)}</td></tr>`).join('')}</table>`).join('')
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Pelton wheel lab report</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:32px;color:#111}h1{font-size:22px;margin:0}h2{font-size:15px;margin:26px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}h3{font-size:13px;margin:16px 0 4px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#f3f3f3}p{margin:4px 0}@media print{button{display:none}}</style>
<button onclick="print()">Print / Save as PDF</button>
<h1>Pelton wheel lab report</h1><p>${esc(r.name)} · ${esc(r.when)}</p>
<h2>Observations</h2>${r.rows.length ? `<table><tr><th>#</th><th>Nozzle /8</th><th>T1 kg</th><th>T2 kg</th><th>T kg</th><th>N rpm</th><th>P1</th><th>P2</th><th>Pp</th><th>BHP kW</th><th>IHP kW</th><th>η %</th></tr>${rows}</table>` : '<p>No readings recorded.</p>'}
<h2>Score summary</h2><p>Viva attempts: ${r.attempts.length ? r.attempts.map((a, k) => `#${k + 1} ${a.right}/${a.total} (${a.pct}%)`).join(' · ') : 'none'}</p>
<h2>Quiz</h2><p>Pre-test: ${r.quiz.pre ? `${r.quiz.pre.score}/${r.quiz.pre.total}` : 'not taken'}<br>Post-test: ${r.quiz.post ? `${r.quiz.post.score}/${r.quiz.post.total}` : 'not taken'}</p>
<h2>Viva</h2>${att || '<p>No viva attempts yet.</p>'}`)
  w.document.close()
  return true
}
