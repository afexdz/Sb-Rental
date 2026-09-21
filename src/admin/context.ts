import { createContext, useContext } from 'react'
import type { AdminData } from './types'
export const AdminContext = createContext<{ data: AdminData; refresh: () => void; userId: string } | null>(null)
export function useAdmin() { const context = useContext(AdminContext); if (!context) throw new Error('Contexte admin absent'); return context }
