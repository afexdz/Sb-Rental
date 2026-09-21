import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
export type AuthState = { session: Session | null; loading: boolean; error: string | null; signedOut: boolean }
export const AuthContext = createContext<AuthState>({ session: null, loading: true, error: null, signedOut: false })
export function useAuth() { return useContext(AuthContext) }
