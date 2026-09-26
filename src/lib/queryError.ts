/** Actionable diagnostics without printing tokens, SQL details or private values. */
export function queryError(error: unknown, context: string): string {
  const value = error && typeof error === 'object' ? error as { code?: string; message?: string } : {}
  const code = value.code ?? ''
  const hint = ['42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)
    ? 'Schéma Supabase incomplet : appliquez les migrations manquantes au projet utilisé, puis actualisez.'
    : ['42501', 'PGRST301', 'PGRST303'].includes(code)
      ? 'Accès refusé : vérifiez la session, les droits du compte et les politiques RLS.'
      : code === 'P0001' ? value.message || 'Opération refusée par les règles métier.'
        : 'Vérifiez la connexion réseau et la disponibilité de Supabase, puis réessayez.'
  return `${context}. ${hint}${code ? ` (code ${code.replace(/[^A-Za-z0-9]/g, '').slice(0, 20)})` : ''}`
}
