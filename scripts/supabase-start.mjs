import { execFileSync } from 'node:child_process'
const network = 'sb-rental-local'
const option = 'com.docker.network.bridge.host_binding_ipv4'
let inspected
try { inspected = JSON.parse(execFileSync('docker', ['network', 'inspect', network], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))[0] } catch {
  execFileSync('docker', ['network', 'create', '-o', `${option}=127.0.0.1`, network], { stdio: 'inherit' })
}
if (inspected && inspected.Options?.[option] !== '127.0.0.1') throw new Error('Le réseau sb-rental-local doit être limité à 127.0.0.1.')
execFileSync('npx', ['supabase', 'start', '--network-id', network], { stdio: ['ignore', 'pipe', 'inherit'] })
execFileSync('node', ['scripts/supabase-bind-local.mjs'], { stdio: 'inherit' })
const containers = execFileSync('docker', ['ps', '--filter', 'name=supabase_', '--format', '{{.Names}}'], { encoding: 'utf8' }).trim().split('\n').filter(n => n.endsWith('_sb-rental'))
for (const name of containers) {
  const container = JSON.parse(execFileSync('docker', ['inspect', name], { encoding: 'utf8' }))[0]
  for (const bindings of Object.values(container.NetworkSettings.Ports ?? {})) {
    for (const binding of bindings ?? []) {
      if (binding.HostIp !== '127.0.0.1' && binding.HostIp !== '::1') throw new Error(`${name} expose ${binding.HostIp}:${binding.HostPort}. Exécutez npm run supabase:stop puis npm run supabase:start.`)
    }
  }
}
console.log('Ports Supabase vérifiés : accès limité au Mac.')
