import { useRef, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { ShieldCheck, LoaderCircle } from 'lucide-react'
import { useAuth } from '../auth/context'
import { supabase } from '../lib/supabase'
import { authErrorMessage } from '../lib/auth'
import { AdminContext } from '../admin/context'
import { useAdminData } from '../admin/useAdminData'
import { AdminLogin } from '../admin/components/AdminLogin'
import { AdminLayout } from '../admin/components/AdminLayout'
import { Overview } from '../admin/sections/Overview'
import { UsersSection, UserDetail } from '../admin/sections/Users'
import { AgenciesSection, AgencyDetail } from '../admin/sections/Agencies'
import { VehiclesSection, VehicleDetail } from '../admin/sections/Vehicles'
import { ReservationsSection, ReservationDetail } from '../admin/sections/Reservations'
import { FinancesSection, PaymentDetail } from '../admin/sections/Finances'
import { MessagesSection, ConversationDetail } from '../admin/sections/Messages'
import { AuditSection } from '../admin/sections/Audit'
import '../admin/admin.css'
export function AdminPage() {
  const { session, loading } = useAuth()
  if (loading) return <main className="bo-gate" role="status"><LoaderCircle size={20} className="spinner" /> Vérification de la session…</main>
  if (!session) return <AdminLogin />
  return <AdminWorkspace key={session.user.id} userId={session.user.id} />
}
function AdminWorkspace({ userId }: { userId: string }) {
  const location = useLocation()
  const { data, loading, error, denied, refresh } = useAdminData()
  const [logoutError, setLogoutError] = useState(''), lock = useRef(false)
  async function logout() {
    if (lock.current) return
    lock.current = true; setLogoutError('')
    try { const { error } = await supabase!.auth.signOut({ scope: 'local' }); if (error) throw error }
    catch (e) { setLogoutError(authErrorMessage(e)) } finally { lock.current = false }
  }
  if (!data) return <main className="bo-gate"><ShieldCheck size={32} /><h1>{denied ? 'Accès refusé' : error ? 'Back-office indisponible' : 'Chargement du back-office…'}</h1>{denied ? <p>Ce compte n’a pas accès au dashboard administrateur.</p> : error ? <><p className="account-error" role="alert">{error}</p><button className="button" disabled={loading} onClick={refresh}>Réessayer</button></> : <p role="status"><LoaderCircle size={20} className="spinner" /> Vérification de l’accès et chargement des données…</p>}{logoutError && <p role="alert">{logoutError}</p>}<button className="text-button" onClick={() => void logout()}>Se déconnecter</button></main>
  const dependencies: Record<string, string[]> = { utilisateurs: ['profiles', 'reservations'], agences: ['agencies', 'profiles', 'vehicles'], vehicules: ['vehicles', 'profiles', 'agencies'], reservations: ['reservations', 'profiles', 'vehicles', 'agencies', 'payments'], finances: ['payments', 'reservations', 'profiles', 'agencies'], messages: ['conversations', 'messages', 'reads', 'profiles', 'agencies'], journal: ['audit'] }
  const unavailable = (dependencies[location.pathname.split('/')[2]] ?? []).some(key => data.errors?.[key])
  return <AdminContext.Provider value={{ data, refresh, userId }}><AdminLayout loading={loading} error={logoutError} logout={() => void logout()}>{Object.keys(data.errors ?? {}).length > 0 && <div className="account-error" role="alert"><strong>Données partiellement indisponibles</strong>{Object.entries(data.errors ?? {}).map(([key, message]) => <p key={key}>{message}</p>)}<button className="button" disabled={loading} onClick={refresh}>Réessayer</button></div>}{unavailable ? <p role="status">Cette section nécessite les données signalées ci-dessus. Les autres sections restent accessibles.</p> : <Routes>
    <Route index element={<Overview />} /><Route path="utilisateurs" element={<UsersSection />} /><Route path="utilisateurs/:id" element={<UserDetail />} />
    <Route path="agences" element={<AgenciesSection />} /><Route path="agences/:id" element={<AgencyDetail />} />
    <Route path="vehicules" element={<VehiclesSection />} /><Route path="vehicules/:id" element={<VehicleDetail />} />
    <Route path="reservations" element={<ReservationsSection />} /><Route path="reservations/:id" element={<ReservationDetail />} />
    <Route path="finances" element={<FinancesSection />} /><Route path="finances/:id" element={<PaymentDetail />} />
    <Route path="messages" element={<MessagesSection />} /><Route path="messages/:id" element={<ConversationDetail />} />
    <Route path="journal" element={<AuditSection />} /><Route path="*" element={<div className="bo-empty"><h1>Page introuvable</h1><Link className="bo-link" to="/admin">Retour à la vue d’ensemble</Link></div>} />
  </Routes>}</AdminLayout></AdminContext.Provider>
}
