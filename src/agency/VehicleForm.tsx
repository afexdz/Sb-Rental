import { useEffect, useRef, useState, type FormEvent } from 'react'
import { saveVehicle, uploadAsset } from './api'
import { agencyError, availabilities, blankVehicle, categories, validateVehicle, vehicleFields, type AgencyVehicle, type Asset, type Errors, type VehicleFields } from './model'
import { ImagePicker } from './ImagePicker'

export function VehicleForm({ userId, vehicle, onSaved, onCancel, onBusy }: { userId: string; vehicle?: AgencyVehicle; onSaved: (vehicle: AgencyVehicle) => void; onCancel: () => void; onBusy: (busy: boolean) => void }) {
  const [fields, setFields] = useState<VehicleFields>(vehicle ? vehicleFields(vehicle) : blankVehicle)
  const [photos, setPhotos] = useState<Asset[]>(vehicle?.photos.map((url, index) => ({ key: `${index}-${url}`, url })) ?? [])
  const [errors, setErrors] = useState<Errors>({}), [error, setError] = useState('')
  const [busy, setBusy] = useState(false), [processing, setProcessing] = useState(false)
  const operation = useRef(false)
  useEffect(() => { onBusy(busy || processing); return () => onBusy(false) }, [busy, processing, onBusy])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (operation.current || processing) return
    setError(''); const issues = validateVehicle(fields, photos.length); setErrors(issues)
    if (Object.keys(issues).length) { document.getElementById(`vehicle-${Object.keys(issues)[0]}`)?.focus(); return }
    operation.current = true; setBusy(true)
    try {
      const uploaded = [...photos]
      for (let index = 0; index < uploaded.length; index++) {
        uploaded[index] = await uploadAsset(userId, uploaded[index])
        setPhotos([...uploaded])
      }
      onSaved(await saveVehicle(userId, fields, uploaded, vehicle))
    } catch (failure) { setError(agencyError(failure)) }
    finally { operation.current = false; setBusy(false) }
  }
  function field(key: keyof VehicleFields, label: string, max?: number, options?: Record<string, string>) {
    const props = { id: `vehicle-${key}`, value: fields[key], required: key !== 'description', 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `vehicle-${key}-error` : undefined, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setFields({ ...fields, [key]: e.target.value }); setErrors({ ...errors, [key]: '' }) } }
    return <div className={`account-field ${key === 'description' ? 'agency-span' : ''}`}><label htmlFor={props.id}>{label}{props.required ? ' *' : ''}</label>{options ? <select {...props}>{Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select> : key === 'description' ? <textarea {...props} maxLength={max} rows={5} /> : <input {...props} type="text" inputMode={key === 'year' ? 'numeric' : key === 'dailyPrice' ? 'decimal' : 'text'} maxLength={max} />}{errors[key] && <p className="field-error" id={`vehicle-${key}-error`}>{errors[key]}</p>}</div>
  }
  return <section className="agency-panel" aria-labelledby="vehicle-form-title"><h2 id="vehicle-form-title">{vehicle ? 'Modifier le véhicule' : 'Nouveau véhicule'}</h2><p className="agency-muted">{vehicle ? 'Mettez à jour les informations de votre véhicule.' : 'Votre véhicule sera enregistré désactivé. Vous pourrez ensuite le publier.'} Les champs marqués * sont obligatoires.</p>
    <form noValidate onSubmit={submit} aria-busy={busy || processing}>
      <fieldset disabled={busy || processing}><div className="agency-form-grid">{field('brand', 'Marque', 80)}{field('model', 'Modèle', 100)}{field('category', 'Catégorie', undefined, categories)}{field('year', 'Année', 4)}{field('dailyPrice', 'Prix journalier en DZD', 15)}{field('color', 'Couleur', 60)}{field('availability', 'Disponibilité', undefined, availabilities)}{field('description', 'Description du véhicule', 3000)}</div></fieldset>
      <ImagePicker id="vehicle-photos" label="Photos du véhicule" assets={photos} limit={3} disabled={busy} onChange={items => { setPhotos(items); setErrors({ ...errors, photos: '' }) }} onProcessing={setProcessing} />
      {errors.photos && <p role="alert" className="field-error">{errors.photos}</p>}{error && <p role="alert" className="account-error">{error}</p>}
      <div className="agency-actions"><button className="button" disabled={busy || processing}>{busy ? 'Enregistrement…' : 'Enregistrer le véhicule'}</button><button className="text-button" type="button" disabled={busy || processing} onClick={onCancel}>Annuler</button></div>
    </form>
  </section>
}
