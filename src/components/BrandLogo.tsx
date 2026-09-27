import { Link } from 'react-router'

export function BrandLogo({ to = '/', compact = false, surface = false }: { to?: string; compact?: boolean; surface?: boolean }) {
  return <Link to={to} className={`brand brand-logo${compact ? ' brand-logo--compact' : ''}${surface ? ' brand-logo--surface' : ''}`} aria-label="SB Rental, accueil"><img src="/brand/sb-rental-logo-compact.png" alt="SB Rental" width="971" height="512" /></Link>
}
