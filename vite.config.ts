/// <reference types="vitest/config" />
import { appendFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Dev-only diagnostics sink: the app POSTs layout measurements to /__diag
 * on boot so rendering issues on other machines/browsers can be inspected
 * from the dev server side (written to diag.log, gitignored).
 */
function diagEndpoint(): Plugin {
  return {
    name: 'diag-endpoint',
    configureServer(server) {
      server.middlewares.use('/__diag', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          const line = `${new Date().toISOString()} ${body}\n`
          try {
            appendFileSync('diag.log', line)
          } catch {
            // best-effort only
          }
          console.log('[diag]', body)
          res.statusCode = 204
          res.end()
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), diagEndpoint()],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
