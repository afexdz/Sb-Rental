import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }))
const url = status.API_URL
const key = status.PUBLISHABLE_KEY || status.ANON_KEY
if (!url || !key || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw new Error('Configuration Supabase locale introuvable.')
if (!key.startsWith('sb_publishable_')) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
  if (claims.role !== 'anon') throw new Error('Une clé publique anon est requise.')
}
let env = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : ''
for (const [name, value] of Object.entries({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key })) {
  const line = `${name}=${value}`
  const pattern = new RegExp(`^${name}=.*$`, 'm')
  env = pattern.test(env) ? env.replace(pattern, line) : `${env}${env && !env.endsWith('\n') ? '\n' : ''}${line}\n`
}
writeFileSync('.env.local', env, { mode: 0o600 })
console.log('.env.local configuré avec l’URL locale et la clé publique uniquement.')
