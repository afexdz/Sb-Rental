import { useEffect, useRef } from 'react'
import { ArrowUpRight, MapPin, X } from 'lucide-react'
import type { Vehicle } from '../types/vehicle'
import { formatPrice, rentalDays, type SearchCriteria } from '../lib/search'

export function VehicleDialog({ vehicle, criteria, onClose }: { vehicle: Vehicle | null; criteria: SearchCriteria | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (vehicle) dialog.current?.showModal()
    else dialog.current?.close()
  }, [vehicle])
  useEffect(() => {
    if (!vehicle) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [vehicle])
  const days = criteria ? rentalDays(criteria.start, criteria.end) : 1
  const total = (vehicle?.dailyPrice ?? 0) * days
  return (
    <dialog ref={dialog} className="vehicle-dialog" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }} aria-labelledby="vehicle-dialog-title">
      {vehicle && <div className="dialog-inner">
        <button className="icon-button dialog-close" onClick={onClose} aria-label="Fermer la fiche"><X size={21} /></button>
        <img className="dialog-image" src={vehicle.image} alt={`${vehicle.brand} ${vehicle.model}`} width="1536" height="1024" />
        <div className="dialog-content">
          <span className="eyebrow">{vehicle.category} · {vehicle.year}</span>
          <h2 id="vehicle-dialog-title">{vehicle.brand} {vehicle.model}</h2>
          <p className="vehicle-location"><MapPin size={15} />{vehicle.city} · {vehicle.transmission} · {vehicle.seats} places</p>
          <p className="dialog-description">{vehicle.description}</p>
          <p className="vehicle-location">{vehicle.fuel} · Disponibilité : {vehicle.availability.toLowerCase()} auprès de l’agence</p>
          <div className="estimate">
            <div><span>{criteria ? `Estimation pour ${days} jour${days > 1 ? 's' : ''}` : 'Tarif indicatif pour 1 jour'}</span><strong>{formatPrice(total)} DA</strong></div>
            <div><span>Acompte de 10 % après confirmation</span><span>{formatPrice(total * 0.1)} DA</span></div>
            <div><span>Solde de 90 % à la remise</span><span>{formatPrice(total * 0.9)} DA</span></div>
          </div>
          <p className="demo-notice">Véhicule et tarif de démonstration. Photo réelle du modèle, donnée à titre illustratif ; la finition peut différer. La disponibilité doit être confirmée par l’agence. Le chat et la réservation ne sont pas encore ouverts.</p>
          <p className="photo-credit">Photo : <a href={vehicle.photoCredit.source} target="_blank" rel="noreferrer">{vehicle.photoCredit.author} · Wikimedia Commons</a> · <a href={vehicle.photoCredit.licenseUrl} target="_blank" rel="noreferrer">{vehicle.photoCredit.license}</a>. Version redimensionnée, cadrage d’affichage.</p>
          <button className="button dialog-button" onClick={onClose}>Continuer à explorer <ArrowUpRight size={19} /></button>
        </div>
      </div>}
    </dialog>
  )
}
