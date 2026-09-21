import { Search } from 'lucide-react'
import { periodLabels, today, type Period } from '../model'
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="bo-search"><Search size={17} /><span className="sr-only">{placeholder}</span><input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>
}
export function SelectFilter({ label, value, onChange, options, all = 'Tous' }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string>; all?: string }) {
  return <label className="bo-select"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}><option value="">{all}</option>{Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
}
export function PeriodFilter({ period, anchor, onPeriod, onAnchor }: { period: Period; anchor: string; onPeriod: (v: Period) => void; onAnchor: (v: string) => void }) {
  return <div className="bo-period-filter"><div className="bo-segmented" role="group" aria-label="Période">{Object.entries(periodLabels).map(([key, text]) => <button key={key} onClick={() => onPeriod(key as Period)} aria-pressed={period === key}>{text}</button>)}</div><label className="bo-date"><span className="sr-only">Date de référence</span><input type="date" aria-label="Date de référence" value={anchor} onChange={e => onAnchor(e.target.value || today())} /></label></div>
}
