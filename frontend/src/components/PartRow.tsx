import { motion } from 'motion/react'
import { cn } from '../lib/utils'
import { inr, stockBadge, type PartCard } from '../session'

/** One replacement part: name, SKU, price, stock, delivery, source, tool + torque. */
export function PartRow({ p, active, onClick, compact }: { p: PartCard; active?: boolean; onClick?: () => void; compact?: boolean }) {
  const stock = stockBadge(p.in_stock)
  const Tag = onClick ? 'button' : 'div'
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="list-none">
      <Tag
        onClick={onClick}
        className={cn(
          'block w-full rounded-xl border bg-surface-2/60 p-3 text-left transition-colors',
          active ? 'border-accent/60 bg-accent/[0.06]' : 'border-border',
          onClick && 'hover:border-accent/40',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold leading-snug">{p.name}</div>
            {p.sku && <div className="mt-0.5 font-mono text-[10.5px] text-muted">{p.sku}</div>}
          </div>
          <div className="shrink-0 text-right">
            <div className="font-serif text-[15px] font-semibold leading-none">{inr(p.price_inr)}</div>
            {p.lead_time_days != null && <div className="mt-1 text-[10.5px] text-muted">{p.lead_time_days} day delivery</div>}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] font-medium">
          {stock && <span className={cn('rounded-full px-2 py-0.5', stock.cls)}>{stock.text}</span>}
          {p.ordered && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">Ordered ✓</span>}
          <span className="rounded-full border border-border px-2 py-0.5 text-muted">Source: {p.source}</span>
        </div>
        {!compact && (p.tool_required || p.torque) && (
          <div className="mt-2 flex flex-col gap-0.5 text-[11.5px] leading-snug text-muted">
            {p.tool_required && <span><b className="font-medium text-fg">Tool</b> · {p.tool_required}</span>}
            {p.torque && <span><b className="font-medium text-fg">Torque</b> · {p.torque}</span>}
          </div>
        )}
      </Tag>
    </motion.li>
  )
}
