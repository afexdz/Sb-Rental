import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, CreditCard, Globe2, KeyRound, MapPin, Menu, MessageCircle, Search, X } from 'lucide-react'
import { useAuth } from '../auth/context'
import { SearchForm } from '../components/SearchForm'
import { VehicleCard } from '../components/VehicleCard'
import { VehicleDialog } from '../components/VehicleDialog'
import { categories, categoryLabels, cities, vehicles } from '../data/vehicles'
import { filterVehicles, validateSearch, type SearchCriteria } from '../lib/search'
import type { Vehicle } from '../types/vehicle'

const steps = [
  { icon: Search, title: 'Trouvez votre voiture', text: 'Une ville, des dates, et le véhicule qui vous ressemble.' },
  { icon: MessageCircle, title: 'Parlez à votre agence', text: 'Échangez directement avec l’agence. Elle vous confirme la disponibilité.' },
  { icon: CreditCard, title: 'Réservez avec 10 %', text: 'Après confirmation, versez votre acompte via Chargily Pay.' },
  { icon: KeyRound, title: 'Les clés sont à vous', text: 'Réglez les 90 % restants à la remise du véhicule. Bonne route !' },
]

export function HomePage() {
  const { session, loading } = useAuth()
  useEffect(() => { document.title = 'SB Rental — Location de voitures en Algérie' }, [])
  const [params, setParams] = useSearchParams()
  const [category, setCategory] = useState('Tous')
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const resultsRef = useRef<HTMLElement>(null)
  const initial = { city: params.get('ville') ?? '', start: params.get('depart') ?? '', end: params.get('retour') ?? '' }
  const hasSearch = params.has('ville') || params.has('depart') || params.has('retour')
  const searchError = hasSearch ? validateSearch(initial) ?? (!cities.includes(initial.city) ? 'Cette ville ne figure pas dans notre sélection.' : null) : null
  const activeSearch = hasSearch && !searchError ? initial : null
  const results = filterVehicles(vehicles, activeSearch?.city ?? '', category)
  const paramsKey = params.toString()

  useEffect(() => {
    if (hasSearch && !searchError) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [paramsKey, hasSearch, searchError])

  useEffect(() => {
    if (!menuOpen) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [menuOpen])

  function search(criteria: SearchCriteria) {
    setCategory('Tous')
    setParams({ ville: criteria.city, depart: criteria.start, retour: criteria.end })
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function resetSearch() { setCategory('Tous'); setParams({}) }

  return <>
    <a href="#main" className="skip-link">Aller au contenu</a>
    <header className="site-header container">
      <Link className="brand" to="/" aria-label="SB Rental, accueil">SB<span>RENTAL</span><i aria-hidden="true" /></Link>
      <nav className="desktop-nav" aria-label="Navigation principale"><a href="#vehicules">Nos véhicules</a><a href="#comment-ca-marche">Comment ça marche <ArrowUpRight size={13} /></a></nav>
      <div className="header-right"><span className="locale"><Globe2 size={16} /> Algérie <span className="locale-divider">/</span> FR</span><Link to={session ? "/mon-compte" : "/connexion"} className="header-cta">{loading ? "Mon espace" : session ? "Mon compte" : "Se connecter"} <ArrowUpRight size={18} /></Link></div>
      <button className="icon-button menu-toggle" aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      {menuOpen && <nav id="mobile-nav" className="mobile-nav" aria-label="Navigation mobile"><a href="#vehicules" onClick={() => setMenuOpen(false)}>Nos véhicules <ArrowUpRight size={18} /></a><a href="#comment-ca-marche" onClick={() => setMenuOpen(false)}>Comment ça marche <ArrowUpRight size={18} /></a><a href="#rechercher" onClick={() => setMenuOpen(false)}>Trouver ma voiture <ArrowUpRight size={18} /></a><Link to={session ? "/mon-compte" : "/connexion"} onClick={() => setMenuOpen(false)}>{session ? "Mon compte" : "Se connecter"} <ArrowUpRight size={18} /></Link></nav>}
    </header>

    <main id="main">
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow"><span className="status-dot" /> L’ALGÉRIE, À VOTRE RYTHME</div>
          <h1 id="hero-title">À vous<br /><em>la route.</em></h1>
          <p className="hero-description">Le bon véhicule. La bonne agence.<br />Et toute la liberté d’aller plus loin.</p>
          <a href="#vehicules" className="hero-link"><span className="circle-arrow"><ArrowDown size={18} /></span> Trouvez votre prochaine escapade</a>
          <div className="hero-coordinate"><span className="tiny-line" /> 36°45′ N &nbsp; 03°03′ E <span>LE DÉPART D’UNE BELLE HISTOIRE</span></div>
        </div>
        <div className="hero-visual">
          <img src="/images/coastal-drive.jpg" alt="Coupé argenté sur une route côtière méditerranéenne, visuel d’inspiration" width="1536" height="1024" fetchPriority="high" />
          <div className="visual-topline"><span>LES ÉCHAPPÉES SB</span><span>ÉDITION 01 — MÉDITERRANÉE</span></div>
          <div className="visual-caption"><span>Moins de contraintes.<br /><em>Plus d’horizons.</em></span><span className="visual-round"><ArrowUpRight size={25} /></span></div>
          <div className="image-index" aria-hidden="true"><span>01</span><i /><span>SB</span></div>
        </div>
        <span className="hero-side-label" aria-hidden="true">LA LIBERTÉ A UN POINT DE DÉPART</span>
      </section>

      <div className="search-section container"><SearchForm key={paramsKey} initial={initial} onSearch={search} />{searchError && <p className="form-error" role="alert">{searchError} Modifiez votre recherche.</p>}</div>
      <div className="promise-strip container"><div><MessageCircle size={18} /><span>Un contact direct avec l’agence</span></div><span className="strip-star" aria-hidden="true">✳</span><div><CreditCard size={18} /><span>10 % pour réserver, après confirmation</span></div><span className="strip-star" aria-hidden="true">✳</span><div><KeyRound size={18} /><span>Le reste à la remise des clés</span></div></div>

      <section className="fleet-section container" id="vehicules" ref={resultsRef} aria-labelledby="fleet-title">
        <div className="section-heading"><div><p className="eyebrow">01 / LA SÉLECTION SB</p><h2 id="fleet-title">À chaque envie, <em>sa voiture.</em></h2></div><p className="section-description">Pour la ville, les retrouvailles<br />ou les routes qui n’attendent que vous.</p></div>
        <div className="fleet-toolbar"><div className="category-filters" role="group" aria-label="Catégorie de véhicule">{categories.map(item => <button className={`filter-button ${category === item ? 'active' : ''}`} key={item} onClick={() => setCategory(item)} aria-pressed={category === item}>{categoryLabels[item]}{category === item && <span className="filter-dot" />}</button>)}</div><span className="demo-label"><span /> COLLECTION DÉMO</span></div>
        {activeSearch && <div className="search-summary"><p><MapPin size={16} />{activeSearch.city}<span>du {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(`${activeSearch.start}T12:00:00`))} au {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${activeSearch.end}T12:00:00`))}</span></p><button className="text-button" onClick={resetSearch}>Effacer la recherche <X size={15} /></button></div>}
        <p className="sr-only" role="status">{results.length} véhicule{results.length !== 1 ? 's' : ''} de démonstration affiché{results.length !== 1 ? 's' : ''}.</p>
        {results.length > 0 ? <div className="vehicle-grid">{results.map(vehicle => <VehicleCard key={vehicle.id} vehicle={vehicle} onSelect={setSelectedVehicle} />)}</div> : <div className="empty-state"><Search size={30} strokeWidth={1.25} /><h3>D’autres horizons vous attendent.</h3><p>Aucun véhicule de démonstration ne correspond à cette sélection.<br />Essayez Alger, Oran ou une autre catégorie.</p><button className="button" onClick={resetSearch}>Voir tous les véhicules <ArrowRight size={18} /></button></div>}
        <div className="fleet-footnote"><p>Véhicules et tarifs de démonstration. Disponibilité à confirmer auprès de l’agence.</p><a href="#rechercher">Changer de destination <ArrowUpRight size={16} /></a></div>
      </section>

      <section className="how-section" id="comment-ca-marche" aria-labelledby="how-title"><div className="container">
        <div className="section-heading"><div><p className="eyebrow">02 / SIMPLE, DU DÉPART À L’ARRIVÉE</p><h2 id="how-title">La route est belle.<br /><em>La location aussi.</em></h2></div><div className="how-aside"><span className="how-stamp"><Check size={19} /></span><p>Vous choisissez.<br />L’agence confirme.<br /><strong>Vous prenez la route.</strong></p></div></div>
        <div className="steps-grid">{steps.map((step, index) => <article className="step" key={step.title}><div className="step-top"><step.icon size={24} strokeWidth={1.4} /><span>0{index + 1}</span></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
        <p className="journey-note">Le parcours de réservation sera disponible prochainement.</p>
      </div></section>
    </main>
    <footer className="site-footer container"><div className="footer-main"><Link className="brand" to="/" aria-label="SB Rental, accueil">SB<span>RENTAL</span><i aria-hidden="true" /></Link><p>D’ici, allez partout.</p><a href="#rechercher">Votre prochaine route commence ici <ArrowUpRight size={18} /></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} SB Rental</span><span>Pensé en Algérie. Pour vos envies d’ailleurs.</span><a href="#main">Retour en haut <ChevronDown size={14} className="rotate-arrow" /></a></div></footer>
    <VehicleDialog vehicle={selectedVehicle} criteria={activeSearch} onClose={() => setSelectedVehicle(null)} />
  </>
}
