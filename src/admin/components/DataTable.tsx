import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
export type Column<T> = { label: string; render: (row: T) => ReactNode; className?: string }
export function EmptyState({ title = 'Aucun résultat', message = 'Aucune donnée ne correspond à cette sélection.' }: { title?: string; message?: string }) {
  return <div className="bo-empty"><span><Inbox size={27} strokeWidth={1.3} /></span><h3>{title}</h3><p>{message}</p></div>
}
export function DataTable<T extends { id: string }>({ rows, columns, label, empty }: { rows: T[]; columns: Column<T>[]; label: string; empty?: string }) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(rows.length / 20)), safePage = Math.min(page, pageCount - 1)
  if (!rows.length) return <EmptyState title={empty ?? 'Aucun résultat'} />
  return <><div className="bo-table-scroll" tabIndex={0} role="region" aria-label={label}><table className="bo-table"><caption className="sr-only">{label}</caption><thead><tr>{columns.map(c => <th key={c.label} scope="col" className={c.className}>{c.label}</th>)}</tr></thead><tbody>{rows.slice(safePage * 20, (safePage + 1) * 20).map(row => <tr key={row.id}>{columns.map(c => <td key={c.label} className={c.className}>{c.render(row)}</td>)}</tr>)}</tbody></table></div><div className="bo-pagination"><span>{safePage * 20 + 1}–{Math.min((safePage + 1) * 20, rows.length)} sur {rows.length}</span><div><button className="bo-icon" aria-label="Page précédente" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft size={17} /></button><span>Page {safePage + 1} / {pageCount}</span><button className="bo-icon" aria-label="Page suivante" disabled={safePage + 1 === pageCount} onClick={() => setPage(safePage + 1)}><ChevronRight size={17} /></button></div></div></>
}
