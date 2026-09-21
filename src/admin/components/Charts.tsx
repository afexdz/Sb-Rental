import { useId, useState } from 'react'
import { money } from '../model'
type Point = { label: string; reservations: number; revenue: number; commission: number }
export function Charts({ points }: { points: Point[] }) {
  return <div className="bo-charts"><Chart points={points} title="Le rythme des réservations" subtitle="Demandes créées sur la période" keys={['reservations']} /><Chart points={points} title="Revenus & commissions" subtitle="Encaissements nets, selon leur date effective" keys={['revenue', 'commission']} monetary /></div>
}
function Chart({ points, title, subtitle, keys, monetary = false }: { points: Point[]; title: string; subtitle: string; keys: ('reservations' | 'revenue' | 'commission')[]; monetary?: boolean }) {
  const id = useId(), [selected, setSelected] = useState<number | null>(null)
  const values = points.flatMap(p => keys.map(k => p[k]))
  const min = Math.min(0, ...values), max = Math.max(1, ...values), span = max - min
  const x = (i: number) => 52 + i / Math.max(1, points.length - 1) * 508
  const y = (v: number) => 176 - (v - min) / span * 142
  const empty = values.every(v => v === 0)
  const ticks = Array.from(new Set([0, 1, 2, 3].map(i => monetary ? min + span * i / 3 : Math.round(min + span * i / 3))))
  const colors = ['#435e4c', '#c3a36a']
  const names = { reservations: 'Réservations', revenue: 'Revenus nets', commission: 'Commission' }
  const current = selected === null ? null : points[selected]
  return <article className="bo-panel bo-chart"><div className="bo-panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><span className="bo-chart-mark">↗</span></div>
    <div className="bo-chart-legend">{keys.map((key, i) => <span key={key}><i style={{ background: colors[i] }} />{names[key]}</span>)}</div>
    <svg viewBox="0 0 600 220" role="img" aria-labelledby={id}><title id={id}>{title}. {empty ? 'Aucune activité sur cette période.' : points.map(p => `${p.label} : ${keys.map(k => `${names[k]} ${monetary ? money(p[k]) : p[k]}`).join(', ')}`).join('. ')}</title>
      {ticks.map(v => <g key={v}><line x1="52" x2="560" y1={y(v)} y2={y(v)} stroke="#e6e8df" strokeDasharray="3 5" /><text x="44" y={y(v) + 3} textAnchor="end" className="bo-chart-label">{monetary ? new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v / 100) : v}</text></g>)}
      {keys.map((key, n) => <g key={key}>{keys.length === 1 && !empty && <path d={`M ${x(0)},${y(0)} ${points.map((p, i) => `L ${x(i)},${y(p[key])}`).join(' ')} L ${x(points.length - 1)},${y(0)} Z`} fill="#435e4c12" />}<polyline points={points.map((p, i) => `${x(i)},${y(p[key])}`).join(' ')} fill="none" stroke={colors[n]} strokeWidth="2.5" strokeLinejoin="round" /></g>)}
      {points.map((p, i) => <g key={p.label}>{(i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 5) === 0) && <text x={x(i)} y="202" textAnchor="middle" className="bo-chart-label">{p.label}</text>}<rect x={x(i) - 8} y="26" width="16" height="157" fill="transparent" onMouseEnter={() => setSelected(i)} onMouseLeave={() => setSelected(null)} /><circle cx={x(i)} cy={y(p[keys[0]])} r={selected === i ? 4 : 0} fill={colors[0]} /></g>)}
    </svg><p className="bo-chart-caption" aria-live="polite">{current ? `${current.label} · ${keys.map(k => `${names[k]} : ${monetary ? money(current[k]) : current[k]}`).join(' · ')}` : empty ? 'Aucune activité enregistrée sur cette période.' : 'Survolez le graphique ou consultez les valeurs ci-dessous.'}</p>
    <details className="bo-chart-data"><summary>Voir les valeurs</summary><table><thead><tr><th>Période</th>{keys.map(k => <th key={k}>{names[k]}</th>)}</tr></thead><tbody>{points.map(p => <tr key={p.label}><td>{p.label}</td>{keys.map(k => <td key={k}>{monetary ? money(p[k]) : p[k]}</td>)}</tr>)}</tbody></table></details>
  </article>
}
