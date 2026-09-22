import { useEffect, useRef, useState, type FormEvent } from 'react'
import { assetUrl, saveShop, uploadAsset } from './api'
import { agencyError, validateShop, type Asset, type Errors, type Shop, type ShopFields } from './model'
import { ImagePicker } from './ImagePicker'

export function ShopForm({ userId, shop, name, onSaved, onBusy }: { userId: string; shop: Shop | null; name: string; onSaved: (shop: Shop) => void; onBusy: (busy: boolean) => void }) {
  const [fields, setFields] = useState<ShopFields>(shop ?? { display_name: name, phone: '', address: '', city: '', description: '' })
  const [logos, setLogos] = useState<Asset[]>(shop?.logo_path ? [{ key: shop.logo_path, path: shop.logo_path, url: assetUrl(shop.logo_path) }] : [])
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false), [processing, setProcessing] = useState(false)
  const operation = useRef(false)
  useEffect(() => { onBusy(busy || processing); return () => onBusy(false) }, [busy, processing, onBusy])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (operation.current || processing) return
    setError(''); setNotice('')
    const issues = validateShop(fields); setErrors(issues)
    if (Object.keys(issues).length) { document.getElementById(`shop-${Object.keys(issues)[0]}`)?.focus(); return }
    operation.current = true; setBusy(true)
    try {
      const logo = logos[0] ? await uploadAsset(userId, logos[0]) : null
      if (logo) setLogos([logo]) // Preserve successful uploads for a retry if the row save fails.
      const saved = await saveShop(userId, fields, logo, !!shop)
      onSaved(saved); setFields(saved)
      setLogos(saved.logo_path ? [{ key: saved.logo_path, path: saved.logo_path, url: assetUrl(saved.logo_path) }] : [])
      setNotice('Votre boutique a bien été enregistrée.')
    } catch (failure) { setError(agencyError(failure)) }
    finally { operation.current = false; setBusy(false) }
  }
  function field(key: keyof ShopFields, label: string, max: number, required = false, autocomplete = 'off') {
    const props = { id: `shop-${key}`, value: fields[key], maxLength: max, required, 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `shop-${key}-error` : undefined, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setFields({ ...fields, [key]: e.target.value }); setErrors({ ...errors, [key]: '' }); setNotice('') } }
    return <div className={`account-field ${key === 'description' ? 'agency-span' : ''}`}><label htmlFor={props.id}>{label}{required ? ' *' : ''}</label>{key === 'description' ? <textarea {...props} rows={5} /> : <input {...props} type={key === 'phone' ? 'tel' : 'text'} autoComplete={autocomplete} />}{errors[key] && <p id={`shop-${key}-error`} className="field-error">{errors[key]}</p>}</div>
  }
  return <section className="agency-panel" aria-labelledby="shop-title"><h2 id="shop-title">Ma boutique</h2><p className="agency-muted">Présentez votre agence avec des informations à jour. Les champs marqués * sont obligatoires.</p>
    <form noValidate onSubmit={submit} aria-busy={busy || processing}>
      <fieldset disabled={busy || processing}>
        <div className="agency-form-grid">{field('display_name', 'Nom de boutique', 160, true, 'organization')}{field('phone', 'Téléphone', 30, false, 'tel')}{field('address', 'Adresse', 250, false, 'street-address')}{field('city', 'Ville', 100, true, 'address-level2')}{field('description', 'Description de la boutique', 3000)}</div>
      </fieldset>
      <ImagePicker id="shop-logo" label="Logo de la boutique" assets={logos} limit={1} disabled={busy} onChange={items => { setLogos(items); setNotice('') }} onProcessing={setProcessing} />
      {error && <p role="alert" className="account-error">{error}</p>}{notice && <p role="status" className="account-notice">{notice}</p>}
      <button className="button" disabled={busy || processing}>{busy ? 'Enregistrement…' : 'Enregistrer ma boutique'}</button>
    </form>
  </section>
}
