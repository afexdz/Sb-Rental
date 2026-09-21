interface Env {
  ASSETS: { fetch: typeof fetch }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/health') {
      return Response.json({ status: 'ok', service: 'sb-rental', mode: 'demo' })
    }
    if (pathname.startsWith('/api/')) {
      return Response.json({ error: 'Route introuvable.' }, { status: 404 })
    }
    return env.ASSETS.fetch(request)
  },
}
