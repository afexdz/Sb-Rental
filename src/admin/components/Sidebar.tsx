import { navigation } from '../navigation'
import { NavLink, Link } from 'react-router'
import { ArrowUpRight, X } from 'lucide-react'
export function Sidebar({ open, close, pending }: { open: boolean; close: () => void; pending: number }) {
  return <><button className={`bo-overlay ${open ? 'is-open' : ''}`} tabIndex={open ? 0 : -1} aria-label="Fermer la navigation" onClick={close} /><aside id="admin-navigation" className={`bo-sidebar ${open ? 'is-open' : ''}`}>
    <div className="bo-brand-row"><Link to="/admin" className="brand">SB<span>RENTAL</span><i /></Link><button className="bo-mobile-close bo-icon" aria-label="Fermer le menu" onClick={close}><X size={20} /></button></div>
    <p className="bo-sidebar-caption">ESPACE ADMINISTRATEUR</p>
    <nav aria-label="Administration">{navigation.map(item => <NavLink key={item.path} to={`/admin${item.path}`} end={!item.path} onClick={close} className={({ isActive }) => `bo-nav-link ${isActive ? 'is-active' : ''}`}><item.icon size={18} strokeWidth={1.6} /><span>{item.label}</span>{item.path === '/agences' && pending > 0 && <b>{pending}</b>}</NavLink>)}</nav>
    <div className="bo-sidebar-foot"><span className="bo-online-dot" /> Administration privée<p>Chaque décision compte.</p><Link to="/">Voir le site public <ArrowUpRight size={15} /></Link></div>
  </aside></>
}
