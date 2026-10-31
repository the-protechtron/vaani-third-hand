import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import type { TranscriptLine } from '../../store'
import { RichText } from '../../lib/text'
import { cn } from '../../lib/utils'

const Avatar = () => (
  <span className="mb-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-speak text-[10px] font-bold text-white">T</span>
)

/** The conversation bubbles, shared by the Tutor and Viva tabs. */
export function ChatLines({
  lines, streaming, thinking, empty,
}: {
  lines: TranscriptLine[]
  streaming?: boolean
  thinking?: boolean
  empty?: string
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const lastText = lines[lines.length - 1]?.text
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [lines.length, lastText])

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {lines.length === 0 && empty && (
        <div className="m-auto flex max-w-[240px] flex-col items-center gap-2 py-6 text-center leading-relaxed text-muted">
          <span aria-hidden className="text-2xl">💬</span>
          {empty}
        </div>
      )}
      {lines.map((l, i) =>
        l.role === 'tool' ? (
          <div key={i} className="mx-auto rounded-full bg-surface-2 px-3 py-1 text-[11px] text-muted">{l.text}</div>
        ) : (
          <motion.div
            key={l.id ?? i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('flex items-end gap-2', l.role === 'user' && 'justify-end')}
          >
            {l.role === 'agent' && <Avatar />}
            <div
              className={cn(
                'max-w-[84%] rounded-2xl px-3.5 py-2.5 leading-relaxed',
                l.role === 'agent' ? 'rounded-bl-md bg-surface-2 text-fg' : 'rounded-br-md border border-accent/30 bg-accent/15 text-fg',
              )}
            >
              <RichText text={l.text} />
              {streaming && i === lines.length - 1 && (
                <motion.span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 bg-current" animate={{ opacity: [1, 0.15, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
              )}
            </div>
          </motion.div>
        ),
      )}
      {thinking && (
        <div className="flex items-end gap-2">
          <Avatar />
          <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3.5">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-muted" animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
