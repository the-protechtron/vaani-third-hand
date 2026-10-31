import { useState } from 'react'
import { POSTTEST, PRETEST, type QuizQuestion } from '../content'
import { useEffect } from 'react'
import { useLab } from '../store'
import { cn } from '../../lib/utils'

function Quiz({ title, hint, questions, which }: { title: string; hint: string; questions: QuizQuestion[]; which: 'pre' | 'post' }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<Record<number, number>>({})
  const q = questions[i]
  const answered = picked[i] !== undefined
  const score = questions.reduce((n, x, k) => n + (picked[k] === x.answer ? 1 : 0), 0)
  const finished = Object.keys(picked).length === questions.length && i === questions.length - 1 && answered
  const setQuiz = useLab((st) => st.setQuiz)
  const saved = useLab((st) => st.quiz[which])
  useEffect(() => { if (finished) setQuiz(which, score, questions.length) }, [finished, score, which, questions.length, setQuiz])

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <div>
        <h2 className="font-serif text-[16px] font-semibold">{title}</h2>
        <p className="mt-0.5 text-muted">{hint}</p>
      </div>

      <div className="flex items-center gap-1.5" aria-label="Progress">
        {questions.map((x, k) => (
          <span
            key={k}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              picked[k] === undefined ? (k === i ? 'bg-accent/40' : 'bg-border') : picked[k] === x.answer ? 'bg-live' : 'bg-red-500',
            )}
          />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Question {i + 1} of {questions.length}</div>
        <p className="mt-1.5 text-[14px] font-medium leading-snug">{q.q}</p>
        <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="Options">
          {q.options.map((o, k) => {
            const chosen = picked[i] === k
            const right = answered && k === q.answer
            const wrong = answered && chosen && k !== q.answer
            return (
              <button
                key={o}
                role="radio"
                aria-checked={chosen}
                disabled={answered}
                onClick={() => setPicked({ ...picked, [i]: k })}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                  right ? 'border-live/60 bg-live/10' : wrong ? 'border-red-500/60 bg-red-500/10' : 'border-border bg-surface-2/50 hover:bg-surface-2',
                )}
              >
                <span className="num-badge mt-px h-5 w-5 shrink-0 rounded-full bg-surface text-[10.5px] font-semibold ring-1 ring-border">{'ABCD'[k]}</span>
                <span>{o}</span>
              </button>
            )
          })}
        </div>
        {answered && (
          <p className={cn('mt-3 rounded-lg px-3 py-2 leading-relaxed', picked[i] === q.answer ? 'bg-live/10' : 'bg-amber-500/10')}>
            <b>{picked[i] === q.answer ? 'Correct. ' : 'Not quite. '}</b>{q.why}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="tabular-nums text-muted">Score {score}/{questions.length}</span>
        {finished ? (
          <button onClick={() => { setPicked({}); setI(0) }} className="h-9 rounded-lg border border-border bg-surface-2 px-4 text-xs font-medium hover:bg-surface">Try again</button>
        ) : (
          <button
            disabled={!answered}
            onClick={() => setI(Math.min(questions.length - 1, i + 1))}
            className="h-9 rounded-lg bg-accent px-4 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {i === questions.length - 1 ? 'Finish' : 'Next question →'}
          </button>
        )}
      </div>
      {!finished && saved && (
        <p className="text-[12px] text-muted">Last saved score: <b className="text-fg">{saved.score}/{saved.total}</b></p>
      )}
      {finished && (
        <p className="rounded-xl border border-accent/40 bg-accent/[0.06] px-3 py-2.5 font-medium">
          You scored {score} out of {questions.length}. {score === questions.length ? 'Perfect.' : 'Review the explanations above, then try again.'}
        </p>
      )}
    </div>
  )
}

export function QuizTab() {
  const [which, setWhich] = useState<'pre' | 'post'>('pre')
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Quiz" className="flex w-fit gap-1 rounded-full border border-border bg-surface-2 p-1">
        {(['pre', 'post'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={which === k}
            onClick={() => setWhich(k)}
            className={cn('rounded-full px-4 py-1 text-[12.5px] font-medium', which === k ? 'bg-surface text-fg shadow-sm ring-1 ring-border' : 'text-muted')}
          >
            {k === 'pre' ? 'Pre-test' : 'Post-test'}
          </button>
        ))}
      </div>
      {which === 'pre' ? (
        <Quiz key="pre" which="pre" title="Pre-test" hint="Five quick questions before you start. No marks lost: this shows what to focus on." questions={PRETEST} />
      ) : (
        <Quiz key="post" which="post" title="Post-test" hint="Check what the experiment taught you." questions={POSTTEST} />
      )}
    </div>
  )
}
