export const categories = { city: 'Citadine', compact: 'Compacte', sedan: 'Berline', suv: 'SUV', utility: 'Utilitaire', luxury: 'Luxe' }
export const availabilities = { available: 'Disponible', rented: 'En location', maintenance: 'Maintenance' }
export type ShopFields = { display_name: string; phone: string; address: string; city: string; description: string }
export type Shop = ShopFields & { id: string; slug: string; logo_path: string | null; created_at: string; updated_at: string }
export type AgencyVehicle = { id: string; agency_id: string; brand: string; model: string; category: string; year: number | null; daily_price_cents: number; color: string; description: string; availability: string; active: boolean; photos: string[] }
export type VehicleFields = { brand: string; model: string; category: string; year: string; dailyPrice: string; color: string; description: string; availability: string }
export type Errors = Record<string, string>
export type Asset = { key: string; url: string; file?: File; path?: string }
export const blankVehicle: VehicleFields = { brand: '', model: '', category: 'city', year: '', dailyPrice: '', color: '', description: '', availability: 'available' }
export const MAX_IMAGE_BYTES = 400 * 1024
export const MAX_IMAGE_EDGE = 1600

export function priceInCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 9000000000000 ? amount : null
}
export function validateShop(fields: ShopFields): Errors {
  const errors: Errors = {}
  if (fields.display_name.trim().length < 2 || fields.display_name.trim().length > 160) errors.display_name = 'Indiquez un nom de boutique de 2 à 160 caractères.'
  if (fields.phone.trim() && !/^\+?[\d () .-]{6,30}$/.test(fields.phone.trim())) errors.phone = 'Indiquez un numéro de téléphone valide (6 à 30 caractères).'
  if (fields.address.trim().length > 250) errors.address = 'L’adresse est limitée à 250 caractères.'
  if (!fields.city.trim() || fields.city.trim().length > 100) errors.city = 'Indiquez une ville de 1 à 100 caractères.'
  if (fields.description.trim().length > 3000) errors.description = 'La description est limitée à 3 000 caractères.'
  return errors
}
export function validateVehicle(fields: VehicleFields, photoCount: number): Errors {
  const errors: Errors = {}
  if (!fields.brand.trim() || fields.brand.trim().length > 80) errors.brand = 'Indiquez une marque de 1 à 80 caractères.'
  if (!fields.model.trim() || fields.model.trim().length > 100) errors.model = 'Indiquez un modèle de 1 à 100 caractères.'
  if (!Object.hasOwn(categories, fields.category)) errors.category = 'Choisissez une catégorie valide.'
  if (!/^\d{4}$/.test(fields.year) || Number(fields.year) < 1950 || Number(fields.year) > 2200) errors.year = 'Indiquez une année entre 1950 et 2200.'
  if (priceInCents(fields.dailyPrice) === null) errors.dailyPrice = 'Indiquez un prix positif en DZD, avec au maximum deux décimales.'
  if (!fields.color.trim() || fields.color.trim().length > 60) errors.color = 'Indiquez une couleur de 1 à 60 caractères.'
  if (fields.description.trim().length > 3000) errors.description = 'La description est limitée à 3 000 caractères.'
  if (!Object.hasOwn(availabilities, fields.availability)) errors.availability = 'Choisissez une disponibilité valide.'
  if (!Number.isInteger(photoCount) || photoCount < 0 || photoCount > 3) errors.photos = 'Ajoutez au maximum 3 photos par véhicule.'
  return errors
}
export function vehicleFields(vehicle: AgencyVehicle): VehicleFields {
  return { brand: vehicle.brand, model: vehicle.model, category: vehicle.category, year: vehicle.year?.toString() ?? '', dailyPrice: (vehicle.daily_price_cents / 100).toFixed(2), color: vehicle.color, description: vehicle.description, availability: vehicle.availability }
}
export function resizedDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Dimensions d’image invalides.')
  const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) }
}
export function imageIssue(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choisissez une image JPEG, PNG ou WebP.'
  if (!file.size || file.size > 20 * 1024 * 1024) return 'Chaque image source doit peser entre 1 octet et 20 Mo.'
  return null
}
export function agencyError(error: unknown): string {
  const code = (error as { code?: string })?.code
  if (code === '42501' || code === 'PGRST116') return 'Accès refusé ou dossier modifié. Actualisez la page pour vérifier votre accès agence.'
  if (code === '23505') return 'Cette boutique existe déjà. Actualisez la page avant de réessayer.'
  if (code === '23514') return 'Vérifiez les champs et la limite de 3 photos, puis réessayez.'
  return 'Enregistrement impossible. Vérifiez votre connexion et votre accès agence, puis réessayez. Votre saisie est conservée.'
}
