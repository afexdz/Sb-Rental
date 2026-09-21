import { ArrowUpRight, Fuel, MapPin, Settings2, UsersRound } from 'lucide-react'
import type { Vehicle } from '../types/vehicle'
import { formatPrice } from '../lib/search'

export function VehicleCard({ vehicle, onSelect }: { vehicle: Vehicle; onSelect: (vehicle: Vehicle) => void }) {
  return (
    <article className="vehicle-card">
      <button className="vehicle-image-button" onClick={() => onSelect(vehicle)} aria-label={`Découvrir ${vehicle.brand} ${vehicle.model}`}>
        <span className="category-badge">{vehicle.category}</span>
        <img src={vehicle.image} alt={`${vehicle.brand} ${vehicle.model}, photo du modèle`} loading="lazy" width="1536" height="1024" />
        <span className="image-arrow"><ArrowUpRight size={21} /></span>
      </button>
      <div className="vehicle-info">
        <div className="vehicle-heading"><h3>{vehicle.brand} <span>{vehicle.model}</span></h3><span className="vehicle-year">{vehicle.year}</span></div>
        <p className="vehicle-location"><MapPin size={14} /> {vehicle.city}<span className="vehicle-availability">Disponibilité {vehicle.availability.toLowerCase()}</span></p>
        <div className="vehicle-specs"><span><Settings2 size={15} />{vehicle.transmission}</span><span><Fuel size={15} />{vehicle.fuel}</span><span><UsersRound size={15} />{vehicle.seats} places</span></div>
        <div className="vehicle-bottom"><p><strong>{formatPrice(vehicle.dailyPrice)} <span>DA</span></strong><span className="per-day"> / jour</span></p><button className="text-button" onClick={() => onSelect(vehicle)}>Découvrir <ArrowUpRight size={16} /></button></div>
      </div>
    </article>
  )
}
