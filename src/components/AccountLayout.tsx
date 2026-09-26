import { Link } from 'react-router'
import { ArrowLeft, ArrowUpRight, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

export function AccountLayout({ children, title, auth = false }: { children: ReactNode; title: string; auth?: boolean }) {
  useEffect(() => { document.title = `${title} — SB Rental`; window.scrollTo(0, 0) }, [title])
  return <div className={auth ? 'account-shell auth-shell' : 'account-shell'}>
    <a href="#account-main" className="skip-link">Aller au contenu</a>
    <header className="site-header container account-header"><Link className="brand" to="/" aria-label="SB Rental, accueil">SB<span>RENTAL</span><i aria-hidden="true" /></Link><Link className="text-button" to="/"><ArrowLeft size={16} /> Retour à l’accueil</Link></header>
    <main id="account-main" className="account-layout container">
      <aside className="account-story"><img src="/images/coastal-drive.jpg" alt="" /><div className="account-story-top"><span>LES ÉCHAPPÉES SB</span><ArrowUpRight size={22} /></div><div className="account-story-copy"><p className="eyebrow">VOTRE PROCHAINE ESCALE</p><h2>La liberté<br />commence <em>ici.</em></h2><p>Un espace à vous.<br />Et toutes les routes devant vous.</p></div></aside>
      <section className="account-panel" aria-label={title}>{children}</section>
    </main>
    <footer className="account-footer container"><span>© {new Date().getFullYear()} SB Rental · Pensé en Algérie.</span><span><ShieldCheck size={16} /> Votre espace personnel</span></footer>
  </div>
}
