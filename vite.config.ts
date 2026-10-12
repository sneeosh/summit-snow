/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, rmSync } from 'node:fs'
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

const isReview = !!process.env.SUMMIT_REVIEW

/** Review builds stamp a source checksum so captures can be matched to code. */
function reviewBuildId(): string {
  if (!isReview) return 'local'
  try {
    const sourceHash = createHash('sha256')
    for (const file of execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n').filter(f=>/\.(ts|tsx|css|json|html)$/.test(f)).sort()) {
      try { sourceHash.update(file); sourceHash.update(readFileSync(file)) } catch { /* deleted source */ }
    }
    return execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim() + '-' + sourceHash.digest('hex').slice(0,12)
  } catch {
    return 'unknown'
  }
}
const buildId = reviewBuildId()

/** Showcase fixtures live in public/winter-review for the review bench; keep them out of production dist. */
function stripReviewFixtures(): Plugin {
  return {
    name: 'strip-review-fixtures',
    apply: 'build',
    closeBundle() {
      if (!isReview) rmSync('dist/winter-review', { recursive: true, force: true })
    },
  }
}
export default defineConfig({
  define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId) },
  build: isReview ? { rollupOptions: { input: { main: 'index.html', review: 'scripts/winter-review/index.html' } } } : undefined,
  plugins: [react(), tailwindcss(), diagEndpoint(), stripReviewFixtures()],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
