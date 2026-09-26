export type AuthRole = 'client' | 'agency'
export type AuthFields = {
  email: string
  password: string
  confirmation: string
  fullName: string
  role?: AuthRole
  businessName?: string
  rcNumber?: string
  rcFile?: File | null
}
export type AuthErrors = Partial<Record<keyof AuthFields, string>>
export const duplicateEmailMessage = 'Impossible de créer ce compte avec ces informations. Vérifiez l’adresse e-mail ou utilisez la connexion.'
export const duplicateRcMessage = 'Ce registre de commerce est déjà associé à une autre agence. Vérifiez le numéro saisi.'
export function normalizeRcNumber(value: string): string {
  return value.normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '')
}
export function isObfuscatedSignup(user: { identities?: unknown[] } | null): boolean {
  return !user || user.identities?.length === 0
}
export function agencyRequestErrorMessage(error: { code?: string; message?: string }): string {
  return error.code === '23505' && error.message?.includes('agency_requests_rc_normalized_key')
    ? duplicateRcMessage
    : 'Le registre est envoyé, mais la demande n’a pas pu être enregistrée. Réessayez pour terminer.'
}
export function validateAgency(fields: AuthFields, hasExistingDocument = false): AuthErrors {
  const errors: AuthErrors = {}
  if (!fields.businessName?.trim() || fields.businessName.trim().length < 2 || fields.businessName.trim().length > 160) errors.businessName = 'Le nom de l’agence doit contenir entre 2 et 160 caractères.'
  if (!fields.rcNumber?.trim() || normalizeRcNumber(fields.rcNumber).length < 2 || fields.rcNumber.trim().length > 80) errors.rcNumber = 'Le numéro du registre doit contenir entre 2 et 80 caractères.'
  if (!fields.rcFile && !hasExistingDocument) errors.rcFile = 'Ajoutez une photo ou un PDF du registre de commerce.'
  else if (fields.rcFile && !['application/pdf', 'image/jpeg', 'image/png'].includes(fields.rcFile.type)) errors.rcFile = 'Choisissez un fichier PDF, JPEG ou PNG.'
  else if (fields.rcFile && (fields.rcFile.size === 0 || fields.rcFile.size > 10 * 1024 * 1024)) errors.rcFile = 'Choisissez un fichier non vide de 10 Mo maximum.'
  return errors
}
export function validateAuth(fields: AuthFields, signup: boolean): AuthErrors {
  const errors: AuthErrors = {}
  if (!fields.email.trim()) errors.email = 'Indiquez votre adresse e-mail.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) errors.email = 'Saisissez une adresse e-mail valide.'
  if (!fields.password) errors.password = 'Indiquez votre mot de passe.'
  else if (signup && fields.password.length < 8) errors.password = 'Utilisez au moins 8 caractères.'
  if (signup) {
    if (!fields.fullName.trim()) errors.fullName = 'Indiquez votre nom complet.'
    else if (fields.fullName.trim().length > 100) errors.fullName = 'Le nom doit contenir au maximum 100 caractères.'
    if (fields.confirmation !== fields.password || !fields.confirmation) errors.confirmation = 'Les mots de passe doivent être identiques.'
    if (fields.role === 'agency') {
      Object.assign(errors, validateAgency(fields))
    }
  }
  return errors
}
export function authErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
  switch (code) {
    case 'invalid_credentials': return 'E-mail ou mot de passe incorrect.'
    case 'user_already_exists': case 'email_exists': return duplicateEmailMessage
    case 'email_not_confirmed': return 'Confirmez votre adresse e-mail avant de vous connecter.'
    case 'weak_password': return 'Ce mot de passe est trop faible. Utilisez au moins 8 caractères.'
    case 'email_address_invalid': case 'validation_failed': return 'Vérifiez votre adresse e-mail et les informations saisies.'
    case 'over_request_rate_limit': case 'over_email_send_rate_limit': return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.'
    case 'signup_disabled': return 'Les inscriptions sont momentanément indisponibles.'
    default: return 'Impossible de joindre le service. Vérifiez votre connexion et réessayez.'
  }
}
