import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState } from './context'
import { supabase, configurationError } from '../lib/supabase'
import { authErrorMessage } from '../lib/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: !!supabase, error: supabase ? null : configurationError, signedOut: false })
  useEffect(() => {
    if (!supabase) return
    let active = true
    let revision = 0
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      revision++
      if (active) setState({ session, loading: false, error: null, signedOut: event === 'SIGNED_OUT' })
    })
    const current = revision
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && revision === current) setState({ session: data.session, loading: false, error: error ? authErrorMessage(error) : null, signedOut: false })
    }).catch(error => {
      if (active && revision === current) setState({ session: null, loading: false, error: authErrorMessage(error), signedOut: false })
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
