import { useSearchParams } from 'react-router'
export function useFilters() {
  const [params, setParams] = useSearchParams()
  const set = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); return next }, { replace: true })
  return { query: params.get('q') ?? '', get: (key: string) => params.get(key) ?? '', set, key: params.toString() }
}
