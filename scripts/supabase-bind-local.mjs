// Docker Desktop may ignore a network's default bind address when HostIp is empty.
// Recreate only this project's exposed containers with an explicit loopback binding.
// Keep the original container until its replacement is healthy; never remove volumes.
import { execFileSync } from 'node:child_process'
import http from 'node:http'
const context = JSON.parse(execFileSync('docker', ['context', 'inspect'], { encoding: 'utf8' }))[0]
const endpoint = process.env.DOCKER_HOST || context.Endpoints.docker.Host
if (!endpoint.startsWith('unix://')) throw new Error('Ce script nécessite le socket Docker local du Mac.')
function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: endpoint.slice(7), path, method, headers: { 'Content-Type': 'application/json' } }, res => {
      let text = ''; res.on('data', c => { text += c }); res.on('end', () => {
        if (res.statusCode >= 300) reject(new Error(`Docker ${method} ${path}: HTTP ${res.statusCode}`))
        else resolve(text ? JSON.parse(text) : null)
      })
    }); req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined)
  })
}
const names = execFileSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' }).trim().split('\n').filter(n => /^supabase_.*_sb-rental$/.test(n))
for (const name of names) {
  const old = await api('GET', `/containers/${name}/json`)
  const ports = old.HostConfig.PortBindings ?? {}
  if (!Object.values(old.NetworkSettings.Ports ?? {}).flat().some(b => b && !['127.0.0.1', '::1'].includes(b.HostIp))) continue
  for (const bindings of Object.values(ports)) for (const binding of bindings ?? []) binding.HostIp = '127.0.0.1'
  const endpoints = Object.fromEntries(Object.entries(old.NetworkSettings.Networks).map(([network, config]) => [network, { Aliases: config.Aliases, NetworkID: config.NetworkID }]))
  // Preserve every mounted volume, including anonymous volumes, under the same destination.
  const binds = (old.Mounts ?? []).filter(m => ['bind', 'volume'].includes(m.Type)).map(m => `${m.Type === 'volume' ? m.Name : m.Source}:${m.Destination}:${m.RW ? 'rw' : 'ro'}`)
  const backup = `${name}_binding_backup`
  await api('POST', `/containers/${old.Id}/stop?t=30`)
  await api('POST', `/containers/${old.Id}/rename?name=${backup}`)
  let created
  try {
    // Supabase injects gateway configuration into the writable container layer.
    // Preserve that layer locally as well as the separately mounted data volumes.
    const snapshot = await api('POST', `/commit?container=${old.Id}&repo=sb-rental-local/${name}&tag=binding`)
    created = await api('POST', `/containers/create?name=${name}`, { ...old.Config, Image: snapshot.Id, HostConfig: { ...old.HostConfig, Binds: binds, PortBindings: ports }, NetworkingConfig: { EndpointsConfig: endpoints } })
    await api('POST', `/containers/${created.Id}/start`)
    let healthy = false
    for (let i = 0; i < 90; i++) {
      const check = await api('GET', `/containers/${created.Id}/json`)
      if (check.State.Running && (!check.State.Health || check.State.Health.Status === 'healthy')) { healthy = true; break }
      if (!check.State.Running) break
      await new Promise(r => setTimeout(r, 1000))
    }
    if (!healthy) throw new Error(`Le remplacement de ${name} n’est pas sain.`)
    await api('DELETE', `/containers/${old.Id}`)
    console.log(`${name} : ports liés explicitement à 127.0.0.1, volumes conservés.`)
  } catch (error) {
    if (created) await api('DELETE', `/containers/${created.Id}?force=true`)
    await api('POST', `/containers/${old.Id}/rename?name=${name}`)
    await api('POST', `/containers/${old.Id}/start`)
    throw error
  }
}
