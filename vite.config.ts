/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
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

const sourceHash = createHash('sha256')
for (const file of execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n').filter(f=>/\.(ts|tsx|css|json|html)$/.test(f)).sort()) {
  try { sourceHash.update(file); sourceHash.update(readFileSync(file)) } catch { /* deleted source */ }
}
const buildId = execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim() + '-' + sourceHash.digest('hex').slice(0,12)
export default defineConfig({
  define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId) },
  build: process.env.SUMMIT_REVIEW ? { rollupOptions: { input: { main: 'index.html', review: 'scripts/winter-review/index.html' } } } : undefined,
  plugins: [react(), tailwindcss(), diagEndpoint()],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
