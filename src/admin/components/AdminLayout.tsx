import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { LogOut, Menu, RefreshCw, ShieldCheck } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { navigation } from '../navigation'
import { useAdmin } from '../context'
export function AdminLayout({ children, loading, logout, error }: { children: ReactNode; loading: boolean; logout: () => void; error: string }) {
  const { data, refresh, userId } = useAdmin(), location = useLocation(), [open, setOpen] = useState(false)
  const profile = data.profiles.find(p => p.id === userId)
  const current = navigation.find(n => n.path && location.pathname.startsWith(`/admin${n.path}`)) ?? navigation[0]
  useEffect(() => { document.title = `${current.label} · Administration — SB Rental`; window.scrollTo(0, 0) }, [current.label, location.pathname])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const nav = document.getElementById('admin-navigation')!
    nav.querySelector<HTMLButtonElement>('button')?.focus()
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'Tab') {
        const nodes = Array.from(nav.querySelectorAll<HTMLElement>('a, button'))
        if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus() }
        else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0].focus() }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [open])
  return <div className="bo-shell"><a href="#backoffice-main" className="skip-link">Aller au contenu</a><Sidebar open={open} close={() => setOpen(false)} pending={data.agencies.filter(a => a.status === 'pending').length} /><div className="bo-workspace"><header className="bo-topbar"><div><button className="bo-menu bo-icon" aria-label="Ouvrir la navigation" aria-expanded={open} aria-controls="admin-navigation" onClick={() => setOpen(true)}><Menu size={21} /></button><span className="bo-breadcrumb">Administration <span>/</span> <strong>{current.label}</strong></span></div><div className="bo-topbar-actions"><button className="bo-icon" aria-label="Actualiser les données" disabled={loading} onClick={refresh}><RefreshCw size={17} className={loading ? 'spinner' : ''} /></button><span className="bo-admin-identity"><ShieldCheck size={17} /><span>{profile?.full_name || 'Administrateur'}<small>Accès administrateur</small></span></span><button className="bo-icon" aria-label="Quitter" title="Se déconnecter" onClick={logout}><LogOut size={17} /></button></div></header><main id="backoffice-main" className="bo-main" aria-busy={loading}>{error && <p className="account-error" role="alert">{error}</p>}{loading && <p className="bo-refresh-status" role="status">Actualisation des données…</p>}{children}</main><footer className="bo-footer"><span>SB Rental · Administration</span><span>Données réelles · Accès contrôlé</span></footer></div></div>
}
