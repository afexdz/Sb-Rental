import type { LucideIcon } from 'lucide-react'
export type Stat = { label: string; value: string | number; note?: string; icon?: LucideIcon; accent?: boolean }
export function StatCards({ items, label = 'Statistiques' }: { items: Stat[]; label?: string }) {
  return <section className="bo-stats" aria-label={label}>{items.map((s, i) => <article key={s.label} className={`bo-stat ${s.accent ? 'bo-stat-accent' : ''}`} style={{ animationDelay: `${i * 25}ms` }}><div><span>{s.label}</span>{s.icon && <s.icon size={19} strokeWidth={1.5} />}</div><strong>{s.value}</strong>{s.note && <small>{s.note}</small>}</article>)}</section>
}
