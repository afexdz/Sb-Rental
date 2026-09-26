import { supabase } from '../lib/supabase'
import { queryError } from '../lib/queryError'
export async function rpc<T = void>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase!.rpc(name, args)
  if (error) throw new Error(queryError(error, 'Opération impossible'))
  return data as T
}
export async function viewPassport(path: string) {
  const tab = window.open('about:blank', '_blank')
  if (!tab) throw new Error('Autorisez l’ouverture du passeport dans un nouvel onglet.')
  tab.opener = null
  try {
    const { data, error } = await supabase!.storage.from('client-passports').createSignedUrl(path, 60)
    if (error) throw error
    tab.location.href = data.signedUrl
  } catch (e) { tab.close(); throw new Error(queryError(e, 'Passeport privé inaccessible')) }
}
