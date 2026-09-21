import { useCallback, useEffect, useRef, useState } from 'react'
import { readAdminData } from './api'
import type { AdminData } from './types'
export function useAdminData() {
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const current = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController(); current.current = controller
    void readAdminData(controller.signal).then(result => {
      if (controller.signal.aborted) return
      setData(result); setDenied(!result); setError('')
    }).catch(() => { if (!controller.signal.aborted) { setData(null); setError('Impossible de charger le back-office. Vérifiez Supabase et les migrations, puis réessayez.') } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision])
  const refresh = useCallback(() => { current.current?.abort(); setLoading(true); setError(''); setRevision(v => v + 1) }, [])
  return { data, loading, denied, error, refresh }
}
