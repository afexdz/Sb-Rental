import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Never accept a privileged key, even if accidentally configured in Vite.
function isPublicKey(key: string) {
  if (key.startsWith('sb_publishable_')) return true
  try { return JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon' } catch { return false }
}
export const supabase = url && publicKey && isPublicKey(publicKey)
  ? createClient(url, publicKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }) } })
  : null
export const configurationError = 'Le service de connexion n’est pas configuré. Veuillez réessayer plus tard.'
