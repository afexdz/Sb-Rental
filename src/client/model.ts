export type Verification = { client_id: string; first_name: string; last_name: string; phone: string; contact_email: string; passport_path: string | null; status: 'pending' | 'verified'; submitted_at: string | null }
export function passportError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return 'Choisissez un passeport au format PDF, JPEG ou PNG.'
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) return 'Choisissez un fichier non vide de 10 Mo maximum.'
  return null
}
export function profileError(first: string, last: string, phone: string, email: string, hasPassport: boolean): string | null {
  if (![first, last].every(value => value.trim().length > 0 && value.trim().length <= 50)) return 'Indiquez votre nom et votre prénom (50 caractères maximum chacun).'
  if (!/^\+?[0-9 ()-]{6,30}$/.test(phone.trim())) return 'Indiquez un numéro de téléphone valide.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Indiquez une adresse e-mail valide.'
  if (!hasPassport) return 'Téléversez votre passeport pour terminer votre profil.'
  return null
}
