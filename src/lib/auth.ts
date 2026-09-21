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
export function validateAgency(fields: AuthFields): AuthErrors {
  const errors: AuthErrors = {}
  if (!fields.businessName?.trim() || fields.businessName.trim().length < 2 || fields.businessName.trim().length > 160) errors.businessName = 'Le nom de l’agence doit contenir entre 2 et 160 caractères.'
  if (!fields.rcNumber?.trim() || fields.rcNumber.trim().length < 2 || fields.rcNumber.trim().length > 80) errors.rcNumber = 'Le numéro du registre doit contenir entre 2 et 80 caractères.'
  if (!fields.rcFile) errors.rcFile = 'Ajoutez une photo ou un PDF du registre de commerce.'
  else if (!['application/pdf', 'image/jpeg', 'image/png'].includes(fields.rcFile.type)) errors.rcFile = 'Choisissez un fichier PDF, JPEG ou PNG.'
  else if (fields.rcFile.size === 0 || fields.rcFile.size > 10 * 1024 * 1024) errors.rcFile = 'Choisissez un fichier non vide de 10 Mo maximum.'
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
    case 'user_already_exists': case 'email_exists': return 'Un compte existe déjà avec cet e-mail. Connectez-vous.'
    case 'email_not_confirmed': return 'Confirmez votre adresse e-mail avant de vous connecter.'
    case 'weak_password': return 'Ce mot de passe est trop faible. Utilisez au moins 8 caractères.'
    case 'email_address_invalid': case 'validation_failed': return 'Vérifiez votre adresse e-mail et les informations saisies.'
    case 'over_request_rate_limit': case 'over_email_send_rate_limit': return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.'
    case 'signup_disabled': return 'Les inscriptions sont momentanément indisponibles.'
    default: return 'Impossible de joindre le service. Vérifiez votre connexion et réessayez.'
  }
}
