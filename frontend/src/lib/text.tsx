import type { ReactNode } from 'react'

/** Strip markdown the voice agent sometimes emits, keeping the words. */
export function cleanText(s: string): string {
  return s
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')          // headings
    .replace(/`{1,3}/g, '')                        // code ticks
    .replace(/\*\*([^*]+)\*\*/g, '$1')             // **bold**
    .replace(/\*\*/g, '')                          // an unclosed ** while text is still streaming
    .replace(/(^|\s)\*([^*\s][^*]*)\*(?=\s|$)/g, '$1$2') // *italic*
    .replace(/(^|\n)\s*[*•]\s+/g, '$1')            // bullet markers
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Plain text with **bold** rendered as real emphasis. Everything else markdown is stripped. */
export function RichText({ text }: { text: string }): ReactNode {
  const parts = text.replace(/^\s{0,3}#{1,6}\s+/gm, '').replace(/`{1,3}/g, '').split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) =>
        /^\*\*[^*]+\*\*$/.test(p) ? (
          <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p.replace(/\*\*/g, '').replace(/(^|\s)\*([^*\s][^*]*)\*(?=\s|$)/g, '$1$2')}</span>
        ),
      )}
    </>
  )
}
