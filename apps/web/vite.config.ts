import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { handleHost } from './host-api.mjs'

function windowsHost(): Plugin {
  return {
    name: 'windows-host',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/host')) return next()
        void handleHost(req, res).catch((error: unknown) => {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Could not read Windows apps.' }))
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), windowsHost()],
})
