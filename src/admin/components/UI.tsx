import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { labels } from '../model'
export function Badge({ value, label }: { value: string; label?: string }) { return <span className={`bo-badge bo-status-${value}`}>{label ?? labels[value] ?? value}</span> }
export function PageHeader({ title, description, children, eyebrow = 'VOTRE ESPACE DE PILOTAGE' }: { title: string; description: string; children?: ReactNode; eyebrow?: string }) { return <header className="bo-page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{children}</header> }
export function Panel({ title, note, children, action }: { title: string; note?: string; children: ReactNode; action?: ReactNode }) { return <section className="bo-panel"><div className="bo-panel-heading"><div><h2>{title}</h2>{note && <p>{note}</p>}</div>{action}</div>{children}</section> }
export function DetailHeader({ back, title, description }: { back: string; title: string; description: string }) { return <><Link className="bo-back" to={back}><ArrowLeft size={16} /> Retour à la liste</Link><PageHeader title={title} description={description} /></> }
export function InfoList({ items }: { items: [string, ReactNode][] }) { return <dl className="bo-info">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Non renseigné'}</dd></div>)}</dl> }
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) { return <p className={error ? 'account-error' : 'bo-notice'} role={error ? 'alert' : 'status'}>{children}</p> }
