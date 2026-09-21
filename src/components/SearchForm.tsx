import { useState, type SubmitEvent } from 'react'
import { ArrowUpRight, CalendarDays, ChevronDown, MapPin } from 'lucide-react'
import { cities } from '../data/vehicles'
import { localDate, nextDate, validateSearch, type SearchCriteria } from '../lib/search'

interface Props { initial: SearchCriteria; onSearch: (criteria: SearchCriteria) => void }

export function SearchForm({ initial, onSearch }: Props) {
  const [criteria, setCriteria] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const today = localDate()

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = validateSearch(criteria)
    setError(message)
    if (!message) onSearch(criteria)
  }

  return (
    <div className="search-wrapper" id="rechercher">
      <form className="search-form" onSubmit={submit} aria-label="Rechercher un véhicule" noValidate>
        <label className="search-field city-field">
          <MapPin size={21} strokeWidth={1.5} />
          <span className="field-content">
            <span className="field-label">Votre destination</span>
            <span className="select-wrap">
              <select aria-label="Ville de départ" value={criteria.city} onChange={e => setCriteria({ ...criteria, city: e.target.value })}>
                <option value="">Choisir une ville</option>
                {cities.map(city => <option key={city}>{city}</option>)}
              </select>
              <ChevronDown size={15} />
            </span>
          </span>
        </label>
        <label className="search-field">
          <CalendarDays size={20} strokeWidth={1.5} />
          <span className="field-content">
            <span className="field-label">Date de départ</span>
            <input aria-label="Date de départ" type="date" min={today} value={criteria.start} onChange={e => {
              const start = e.target.value
              setCriteria({ ...criteria, start, end: start && criteria.end && criteria.end <= start ? nextDate(start) : criteria.end })
            }} />
          </span>
        </label>
        <label className="search-field">
          <CalendarDays size={20} strokeWidth={1.5} />
          <span className="field-content">
            <span className="field-label">Date de retour</span>
            <input aria-label="Date de retour" type="date" min={criteria.start ? nextDate(criteria.start) : nextDate(today)} value={criteria.end} onChange={e => setCriteria({ ...criteria, end: e.target.value })} />
          </span>
        </label>
        <button className="button search-button" type="submit">Trouver ma voiture <ArrowUpRight size={21} /></button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="search-note">Une envie de partir ? Commencez par choisir votre ville.</p>
    </div>
  )
}
