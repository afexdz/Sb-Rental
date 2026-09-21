import { useFilters } from '../useFilters'
import { Link } from 'react-router'
import { CalendarDays, Wallet, ArrowUpRight, Building2, Users, Percent, CreditCard, Clock3 } from 'lucide-react'
import { useAdmin } from '../context'
import { booked, financials, money, series, today, type Period } from '../model'
import { StatCards } from '../components/StatCards'
import { Charts } from '../components/Charts'
import { PeriodFilter } from '../components/Filters'
import { PageHeader, Panel } from '../components/UI'
export function Overview() {
  const { data } = useAdmin(), filter = useFilters()
  const period = (['day', 'week', 'month', 'year'].includes(filter.get('periode')) ? filter.get('periode') : 'month') as Period
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(filter.get('date')) ? filter.get('date') : today()
  const finance = financials(data.payments), pendingAgencies = data.agencies.filter(a => a.status === 'pending').length
  return <><PageHeader title="La plateforme, en un regard." description="L’activité de SB Rental, des premières demandes aux paiements confirmés." /><div className="bo-overview-intro"><span className="bo-live"><i /> Données de votre plateforme</span><span>Indicateurs cumulés · Dinar algérien</span></div>
    <StatCards items={[
      { label: 'Chiffre d’affaires réservé', value: money(booked(data.reservations)), note: 'Réservations confirmées, hors annulations', icon: Wallet, accent: true },
      { label: 'Commission SB Rental', value: money(finance.commission), note: 'Encaissée, nette de remboursements · taux 10 %', icon: Percent },
      { label: 'Paiements confirmés', value: money(finance.paid), note: 'Encaissements bruts enregistrés', icon: CreditCard },
      { label: 'Paiements en attente', value: money(finance.pending), note: `${data.payments.filter(p => p.status === 'pending').length} transactions à confirmer`, icon: Clock3 },
    ]} />
    <StatCards label="Communauté et réservations" items={[
      { label: 'Réservations totales', value: data.reservations.length, icon: CalendarDays }, { label: 'Réservations en attente', value: data.reservations.filter(r => r.status === 'request').length, icon: Clock3 }, { label: 'Clients', value: data.profiles.filter(p => p.role === 'client').length, icon: Users }, { label: 'Agences', value: data.profiles.filter(p => p.role === 'agency').length, icon: Building2 },
    ]} />
    <Link className="bo-attention" to="/admin/agences?statut=pending"><span className="bo-attention-icon"><Building2 size={23} /></span><span><strong>{pendingAgencies ? `${pendingAgencies} agence${pendingAgencies > 1 ? 's' : ''} à approuver` : 'Les dossiers agences sont à jour'}</strong><small>{pendingAgencies ? 'Consultez leurs registres de commerce et prenez une décision.' : 'Les nouvelles demandes apparaîtront ici.'}</small></span><ArrowUpRight size={22} /></Link>
    <div className="bo-chart-toolbar"><div><p className="eyebrow">L’ACTIVITÉ DANS LE TEMPS</p><h2>Suivre la trajectoire.</h2></div><PeriodFilter period={period} anchor={anchor} onPeriod={p => filter.set('periode', p)} onAnchor={d => filter.set('date', d)} /></div>
    <Charts points={series(data, period, anchor)} />
    <Panel title="Des chiffres qui ont un sens" note="Les indicateurs ci-dessus sont cumulés. Le filtre de période s’applique aux deux graphiques."><p className="bo-explanation">Le chiffre d’affaires réservé correspond aux locations confirmées, hors demandes et annulations. Les revenus du graphique correspondent aux paiements confirmés moins les remboursements à leur date effective. La commission attendue est de 10 % du prix de location ; la commission encaissée provient uniquement des transactions enregistrées. Aucune estimation de paiement ne remplace une confirmation.</p></Panel>
  </>
}
