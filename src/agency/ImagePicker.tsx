import { useEffect, useRef, useState } from 'react'
import { compressImage } from './images'
import { type Asset } from './model'

export function ImagePicker({ id, label, assets, limit, disabled, onChange, onProcessing }: { id: string; label: string; assets: Asset[]; limit: number; disabled: boolean; onChange: (assets: Asset[]) => void; onProcessing: (busy: boolean) => void }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const urls = useRef<string[]>([])
  const working = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; const allocated = urls.current; return () => { mounted.current = false; allocated.forEach(url => URL.revokeObjectURL(url)) } }, [])
  async function select(files: File[]) {
    if (working.current || disabled || !files.length) return
    setError('')
    if (assets.length + files.length > limit) { setError(`Ajoutez au maximum ${limit} ${limit === 1 ? 'logo' : 'photos'}. Retirez une image avant de la remplacer.`); return }
    working.current = true; setBusy(true); onProcessing(true)
    try {
      const additions: Asset[] = []
      for (const source of files) {
        const file = await compressImage(source)
        if (!mounted.current) return
        const url = URL.createObjectURL(file); urls.current.push(url)
        additions.push({ key: crypto.randomUUID(), url, file })
      }
      if (mounted.current) onChange([...assets, ...additions])
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Impossible de préparer cette image.') }
    finally { working.current = false; if (mounted.current) { setBusy(false); onProcessing(false) } }
  }
  return <div className="agency-images">
    <label htmlFor={id}>{label}</label>
    <p id={`${id}-help`} className="field-help">{limit === 1 ? 'Un logo' : '3 photos maximum'} · JPEG, PNG ou WebP. Compression automatique à 1 600 px maximum et moins de 400 Ko avant l’envoi.</p>
    <input id={id} type="file" accept="image/jpeg,image/png,image/webp" multiple={limit > 1} disabled={disabled || busy} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} aria-invalid={!!error} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void select(files) }} />
    {busy && <p role="status">Préparation des images…</p>}
    {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
    <div className="agency-previews">{assets.map((asset, index) => <figure key={asset.key}>
      <img src={asset.url} alt={`${label}, aperçu ${index + 1}`} />
      <figcaption>{asset.file ? `${Math.ceil(asset.file.size / 1024)} Ko · prête à envoyer` : 'Image enregistrée'}</figcaption>
      <button className="text-button" type="button" disabled={disabled || busy} onClick={() => { onChange(assets.filter(item => item.key !== asset.key)); setError('') }} aria-label={`Retirer ${limit === 1 ? 'le logo' : `la photo ${index + 1}`}`}>Retirer</button>
    </figure>)}</div>
  </div>
}
