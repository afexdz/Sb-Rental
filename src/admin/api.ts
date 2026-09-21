import { supabase } from '../lib/supabase'
import type { AdminData } from './types'
const columns = {
  profiles: 'id,email,full_name,role,account_status,created_at',
  agency_requests: 'id,profile_id,business_name,rc_number,document_path,status,admin_note,created_at,reviewed_at',
  vehicles: 'id,agency_id,brand,model,category,year,daily_price_cents,active,availability,photos,description,created_at',
  reservations: 'id,reference,client_id,agency_id,vehicle_id,start_date,end_date,total_cents,deposit_cents,commission_cents,status,admin_note,created_at,updated_at',
  payments: 'id,reservation_id,kind,source,chargily_reference,amount_cents,commission_cents,refunded_cents,refunded_commission_cents,agency_transferred_cents,status,confirmed_at,refunded_at,created_at,updated_at,admin_note',
  conversations: 'id,client_id,agency_id,reservation_id,subject,status,created_at',
  conversation_messages: 'id,conversation_id,sender_id,body,created_at',
  conversation_admin_reads: 'conversation_id,admin_id,last_read_at',
  admin_audit_logs: 'id,admin_id,admin_email,action,entity_type,entity_id,before_data,after_data,created_at',
} as const
async function rows<T>(table: keyof typeof columns, signal: AbortSignal): Promise<T[]> {
  const all: T[] = []
  for (let offset = 0; ; offset += 500) {
    const order = table === 'conversation_admin_reads' ? 'conversation_id' : 'id'
    const result = await supabase!.from(table).select(columns[table]).order(order).range(offset, offset + 499).abortSignal(signal).retry(false)
    if (result.error) throw new Error(`Impossible de charger ${table}.`)
    all.push(...result.data as unknown as T[])
    if (result.data.length < 500) return all
  }
}
export async function readAdminData(signal: AbortSignal): Promise<AdminData | null> {
  const { data: allowed, error } = await supabase!.rpc('is_admin').abortSignal(signal)
  if (error) throw error
  if (!allowed) return null
  const [profiles, agencies, vehicles, reservations, payments, conversations, messages, reads, audit] = await Promise.all([
    rows<AdminData['profiles'][number]>('profiles', signal), rows<AdminData['agencies'][number]>('agency_requests', signal), rows<AdminData['vehicles'][number]>('vehicles', signal), rows<AdminData['reservations'][number]>('reservations', signal), rows<AdminData['payments'][number]>('payments', signal), rows<AdminData['conversations'][number]>('conversations', signal), rows<AdminData['messages'][number]>('conversation_messages', signal), rows<AdminData['reads'][number]>('conversation_admin_reads', signal), rows<AdminData['audit'][number]>('admin_audit_logs', signal),
  ])
  return { profiles, agencies, vehicles, reservations, payments, conversations, messages, reads, audit }
}
export async function adminMutation(name: string, args: Record<string, unknown>) {
  const { error } = await supabase!.rpc(name, args)
  if (error) throw new Error(error.code === '42501' ? 'Accès refusé. Reconnectez-vous avec un compte administrateur.' : error.code === 'P0001' ? error.message : 'Opération impossible. Vérifiez votre connexion et réessayez.')
}
export async function openDocument(path: string) {
  const tab = window.open('about:blank', '_blank')
  if (!tab) throw new Error('Autorisez l’ouverture d’un nouvel onglet pour consulter le registre.')
  tab.opener = null
  try {
    const { data, error } = await supabase!.storage.from('agency-documents').createSignedUrl(path, 300)
    if (error) throw error
    tab.location.href = data.signedUrl
  } catch { tab.close(); throw new Error('Impossible d’ouvrir ce registre. Réessayez.') }
}
