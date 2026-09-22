import { supabase } from '../lib/supabase'
import { priceInCents, type AgencyVehicle, type Asset, type Shop, type ShopFields, type VehicleFields } from './model'
const vehicleColumns = 'id,agency_id,brand,model,category,year,daily_price_cents,color,description,availability,active,photos'
export const assetUrl = (path: string) => supabase!.storage.from('agency-assets').getPublicUrl(path).data.publicUrl

export async function loadAgency(userId: string) {
  const { data: profile, error } = await supabase!.from('profiles').select('role,account_status').eq('id', userId).single().retry(false)
  if (error) throw error
  const { data: request, error: requestError } = await supabase!.from('agency_requests').select('status,business_name').eq('profile_id', userId).maybeSingle().retry(false)
  if (requestError) throw requestError
  return { role: profile.role as string, suspended: profile.account_status !== 'active', status: request?.status as string | undefined, name: request?.business_name as string | undefined }
}
export async function loadShop(userId: string): Promise<Shop | null> {
  const { data, error } = await supabase!.from('agency_profiles').select('*').eq('id', userId).maybeSingle().retry(false)
  if (error) throw error
  return data
}
export async function loadVehicles(userId: string): Promise<AgencyVehicle[]> {
  const all: AgencyVehicle[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase!.from('vehicles').select(vehicleColumns).eq('agency_id', userId).order('created_at', { ascending: false }).order('id').range(offset, offset + 499).retry(false)
    if (error) throw error
    all.push(...data)
    if (data.length < 500) return all
  }
}
export async function uploadAsset(userId: string, asset: Asset): Promise<Asset> {
  if (!asset.file || asset.path) return asset
  const path = `${userId}/${crypto.randomUUID()}.${asset.file.type === 'image/webp' ? 'webp' : 'jpg'}`
  const { error } = await supabase!.storage.from('agency-assets').upload(path, asset.file, { contentType: asset.file.type, upsert: false })
  if (error) throw error
  return { ...asset, path }
}
export async function saveShop(userId: string, fields: ShopFields, logo: Asset | null, exists: boolean): Promise<Shop> {
  const payload = { display_name: fields.display_name.trim(), phone: fields.phone.trim(), address: fields.address.trim(), city: fields.city.trim(), description: fields.description.trim(), logo_path: logo?.path ?? null }
  const query = exists ? supabase!.from('agency_profiles').update(payload).eq('id', userId) : supabase!.from('agency_profiles').insert({ ...payload, id: userId })
  const { data, error } = await query.select().single().retry(false)
  if (error) throw error
  return data
}
export async function saveVehicle(userId: string, fields: VehicleFields, photos: Asset[], vehicle?: AgencyVehicle): Promise<AgencyVehicle> {
  const payload = { brand: fields.brand.trim(), model: fields.model.trim(), category: fields.category, year: Number(fields.year), daily_price_cents: priceInCents(fields.dailyPrice), color: fields.color.trim(), description: fields.description.trim(), availability: fields.availability, photos: photos.map(photo => photo.path ? assetUrl(photo.path) : photo.url) }
  const query = vehicle ? supabase!.from('vehicles').update(payload).eq('id', vehicle.id).eq('agency_id', userId) : supabase!.from('vehicles').insert({ ...payload, agency_id: userId, active: false })
  const { data, error } = await query.select(vehicleColumns).single().retry(false)
  if (error) throw error
  return data
}
export async function setVehiclePublished(userId: string, vehicle: AgencyVehicle): Promise<AgencyVehicle> {
  const { data, error } = await supabase!.from('vehicles').update({ active: !vehicle.active }).eq('id', vehicle.id).eq('agency_id', userId).select(vehicleColumns).single().retry(false)
  if (error) throw error
  return data
}
