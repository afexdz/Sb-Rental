import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import { AuthProvider } from './auth/AuthProvider'
const AuthPage = lazy(() => import('./pages/AuthPage').then(module => ({ default: module.AuthPage })))
const AccountPage = lazy(() => import('./pages/AccountPage').then(module => ({ default: module.AccountPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })))
const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })))

function NotFound() {
  return <main className="not-found"><Link className="brand" to="/">SB<span>RENTAL</span></Link><p className="eyebrow">ERREUR 404</p><h1>Un petit détour.</h1><p>Cette page n’existe pas. Reprenons la bonne route.</p><Link to="/" className="button">Retour à l’accueil <ArrowUpRight size={20} /></Link></main>
}

export default function App() {
  return <BrowserRouter><AuthProvider><Suspense fallback={<main className="container account-loading" role="status">Chargement de la page…</main>}><Routes><Route path="/" element={<HomePage />} /><Route path="/inscription" element={<AuthPage key="signup" signup />} /><Route path="/connexion" element={<AuthPage key="login" />} /><Route path="/mon-compte" element={<AccountPage />} /><Route path="/admin/*" element={<AdminPage />} /><Route path="*" element={<NotFound />} /></Routes></Suspense></AuthProvider></BrowserRouter>
}
